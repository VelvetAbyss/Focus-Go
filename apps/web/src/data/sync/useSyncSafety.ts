import { liveQuery } from 'dexie'
import { useEffect, useState } from 'react'
import { readSyncSafety, type SyncSafety } from './safety'

export const useSyncSafety = () => {
  const [safety, setSafety] = useState<SyncSafety | null>(null)
  const [failed, setFailed] = useState(false)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const watch = () => { subscription = liveQuery(() => readSyncSafety()).subscribe({
      next: value => { setSafety(value); setFailed(false) },
      error: () => { setSafety(null); setFailed(true); retryTimer = setTimeout(watch, 5000) },
    }) }
    watch()
    const onNetwork = () => setOnline(navigator.onLine)
    window.addEventListener('online', onNetwork)
    window.addEventListener('offline', onNetwork)
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => {
      subscription?.unsubscribe()
      clearTimeout(retryTimer)
      window.removeEventListener('online', onNetwork)
      window.removeEventListener('offline', onNetwork)
      clearInterval(timer)
    }
  }, [])
  return { safety, failed, online, now }
}
