import { prepareAppUpdate } from './updateLifecycle'

const CHECK_INTERVAL_MS = 120_000
const IDLE_MS = 30_000
const RELOAD_GUARD = 'focusgo:last-auto-updated-release'
const isRelease = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{7,40}$/i.test(value)

/** Only injected into production web HTML; desktop and Vite development omit it. */
export const startWebUpdates = (release: string, reload = () => window.location.reload()) => {
  if (!isRelease(release)) return () => {}
  let stopped = false
  let checking = false
  let applying = false
  let composing = false
  let lastActivity = Date.now()
  let target: string | null = null
  let ready: string | null = null
  let registration: ServiceWorkerRegistration | undefined
  const workers = navigator.serviceWorker
  const activity = () => { lastActivity = Date.now() }
  const compositionStart = () => { composing = true; activity() }
  const compositionEnd = () => { composing = false; activity() }
  const safeToReload = () => !stopped && navigator.onLine !== false && document.visibilityState === 'visible'
    && !composing && Date.now() - lastActivity >= IDLE_MS
    && !document.activeElement?.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')
    && !document.querySelector('[role="dialog"],dialog[open],[aria-busy="true"]')

  const apply = async () => {
    if (!ready || applying || !safeToReload()) return
    const next = ready
    // A stale CDN response or failed worker must never create a reload loop.
    try { if (sessionStorage.getItem(RELOAD_GUARD) === next) return } catch { return }
    applying = true
    try {
      await prepareAppUpdate()
      if (next !== ready || !safeToReload()) return
      sessionStorage.setItem(RELOAD_GUARD, next)
      reload()
    } catch (error) {
      console.warn('[updates] postponed until local saves finish', error)
    } finally { applying = false }
  }
  const controllerChanged = () => {
    const script = workers?.controller?.scriptURL
    if (!script || !target) return
    if (new URL(script, location.origin).searchParams.get('v') !== target) return
    ready = target
    void apply()
  }
  const register = async (version: string) => {
    if (!workers) return
    registration = await workers.register(`/sw.js?v=${version}`, { scope: '/', updateViaCache: 'none' })
    controllerChanged()
  }
  const check = async () => {
    if (stopped || checking || navigator.onLine === false || document.visibilityState !== 'visible') return
    checking = true
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 10_000)
    try {
      const response = await fetch(`/release.json?check=${Date.now()}`, { cache: 'no-store', signal: abort.signal })
      if (!response.ok) return
      const manifest = await response.json() as { version?: unknown }
      if (stopped || !isRelease(manifest.version) || manifest.version === release) return
      target = manifest.version
      ready = null
      if (workers) await register(target)
      else ready = target
    } catch {
      // Offline, failed deployments and partial worker downloads leave the current app usable.
    } finally {
      clearTimeout(timeout)
      checking = false
    }
  }
  const resume = () => { void check(); void apply() }
  const events = ['pointerdown', 'keydown', 'input'] as const
  events.forEach(name => window.addEventListener(name, activity, true))
  window.addEventListener('compositionstart', compositionStart, true)
  window.addEventListener('compositionend', compositionEnd, true)
  window.addEventListener('focus', resume)
  window.addEventListener('online', resume)
  document.addEventListener('visibilitychange', resume)
  workers?.addEventListener('controllerchange', controllerChanged)
  const checkTimer = setInterval(() => { void check() }, CHECK_INTERVAL_MS)
  const idleTimer = setInterval(() => { void apply() }, 1000)
  // Catch versions installed by another tab, as well as releases made while this tab stays open.
  void register(release).then(() => registration?.update()).catch(() => {})
  void check()
  return () => {
    stopped = true
    clearInterval(checkTimer)
    clearInterval(idleTimer)
    events.forEach(name => window.removeEventListener(name, activity, true))
    window.removeEventListener('compositionstart', compositionStart, true)
    window.removeEventListener('compositionend', compositionEnd, true)
    window.removeEventListener('focus', resume)
    window.removeEventListener('online', resume)
    document.removeEventListener('visibilitychange', resume)
    workers?.removeEventListener('controllerchange', controllerChanged)
  }
}

const release = document.querySelector<HTMLMetaElement>('meta[name="focusgo-release"]')?.content
if (release) startWebUpdates(release)
