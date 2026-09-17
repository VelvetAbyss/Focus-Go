import { LOCAL_DATA_OWNER_KEY } from '../store/authOwnership'
import { getPlatform } from '../platform'
import { useEffect, useState, type ReactNode } from 'react'
import { bootstrapAuth } from './authBootstrap'
import { getAuth } from '../store/auth'
import StorageModeChooser from './StorageModeChooser'
import { readStorageMode, type StorageMode } from '../data/storageMode'

// Share an in-flight restore across StrictMode's effect replay.
let pending: Promise<boolean> | null = null
const restore = () => {
  if (!pending) pending = bootstrapAuth().finally(() => { pending = null })
  return pending
}

export default function StartupGate({ children }: { children: ReactNode }) {
  useEffect(() => { void getPlatform().showAppWindow() }, [])
  // Check for updates from the gate, not from the app behind it. The first-run
  // chooser and the "session unavailable" screen both render instead of <App/>,
  // and someone stuck on the latter is precisely who a newer build might
  // unstick — gating the check behind a healthy boot strands them.
  useEffect(() => {
    const timer = window.setTimeout(() => void getPlatform().checkForUpdates(), 5000)
    return () => window.clearTimeout(timer)
  }, [])
  const [mode, setMode] = useState<StorageMode | null>(() => readStorageMode())
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'checking' | 'ready' | 'error'>('checking')
  const [localOnly, setLocalOnly] = useState(false)
  const english = typeof navigator !== 'undefined' && !navigator.language.startsWith('zh')
  useEffect(() => {
    let active = true
    // Local-only devices have no session to restore: skip the profile round-trip
    // entirely so the app is interactive without ever touching the network. They
    // do still need the first-run workspace, and it has to be written before the
    // shell mounts — once the sidebar timer persists its focus settings, the
    // seeder sees a non-empty database and skips forever.
    if (mode === 'local') {
      void import('../data/seed')
        .then(({ seedDatabase }) => seedDatabase())
        .catch((error) => { console.warn('[seed] local seed failed:', error) })
        .finally(() => { if (active) setStatus('ready') })
      return () => { active = false }
    }
    if (mode === null) return
    void restore().then(() => { if (active) setStatus('ready') }, () => { if (active) setStatus('error') })
    return () => { active = false }
  }, [attempt, mode])
  if (mode === null) return <StorageModeChooser onChoose={setMode} />
  if (status === 'ready') return children
  const retry = () => { setStatus('checking'); setLocalOnly(false); setAttempt((value) => value + 1) }
  if (localOnly) return <>
    <aside className="startup-notice" role="status">
      {english ? 'Local workspace · Cloud session unavailable' : '本地工作区 · 云端会话尚未恢复'}
      <button type="button" onClick={retry}>{english ? 'Retry connection' : '重新连接'}</button>
    </aside>
    {children}
  </>
  return <main className="startup-screen" aria-busy={status === 'checking'}>
    <h1>Focus &amp; Go</h1>
    <p role="status">{status === 'checking'
      ? (english ? 'Opening your workspace…' : '正在打开工作区…')
      : (english ? 'Unable to restore your session. Your local data has been kept.' : '暂时无法恢复会话，你的本地数据已保留。')}</p>
    {status === 'error' && <div className="startup-actions">
      <button type="button" onClick={retry}>{english ? 'Try again' : '重试'}</button>
      {(getAuth()?.user || !localStorage.getItem(LOCAL_DATA_OWNER_KEY)) && <button type="button" onClick={() => setLocalOnly(true)}>
        {getAuth()?.user ? (english ? 'Open existing local workspace' : '打开原账户的本地工作区') : (english ? 'Open local workspace' : '打开本地工作区')}
      </button>}
    </div>}
  </main>
}
