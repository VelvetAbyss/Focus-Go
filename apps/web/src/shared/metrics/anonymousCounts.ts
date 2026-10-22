const PREFERENCE = 'focusgo.anonymous-counts.enabled'
const FIRST_SUCCESS = 'focusgo.anonymous-counts.first-success'
const ENDPOINT = 'https://api.nestflow.art/api/public-counts'
const CHANGE_EVENT = 'focusgo-anonymous-counts-change'
const PAGES = ['/', '/zh/', '/features/pomodoro/', '/zh/features/pomodoro/', '/features/local-first/', '/zh/features/local-first/', '/guides/task-to-focus/', '/zh/guides/task-to-focus/', '/privacy/', '/zh/privacy/', '/terms/', '/zh/terms/']

type CounterRuntime = {
  origin: string
  storage: Pick<Storage, 'getItem' | 'setItem'>
  privacySignal: () => boolean
  send: (body: string) => Promise<boolean>
}

export function createAnonymousCounter(runtime: CounterRuntime) {
  let pending = false
  let preferenceOverride: boolean | undefined
  const enabled = () => {
    try { return !runtime.privacySignal() && (preferenceOverride ?? (runtime.storage.getItem(PREFERENCE) !== 'false')) }
    catch { return false }
  }
  const send = async (event: string, page: string, language: string) => {
    if (!enabled()) return false
    try { return await runtime.send(JSON.stringify({ event, page, language })) }
    catch { return false }
  }
  return {
    enabled,
    setEnabled(value: boolean) {
      try { runtime.storage.setItem(PREFERENCE, String(value)); preferenceOverride = undefined }
      catch { preferenceOverride = value }
    },
    async website(event: 'website_view' | 'app_open', page: string) {
      if (runtime.origin !== 'https://nestflow.art' || !PAGES.includes(page)) return false
      return send(event, page, page.startsWith('/zh/') ? 'zh-CN' : 'en')
    },
    async firstSuccess(language: string) {
      if (runtime.origin !== 'https://app.nestflow.art' || !enabled() || pending) return
      try {
        if (runtime.storage.getItem(FIRST_SUCCESS) === 'true') return
        pending = true
        if (await send('first_success', 'app', language === 'zh' || language === 'zh-CN' ? 'zh-CN' : 'en')) runtime.storage.setItem(FIRST_SUCCESS, 'true')
      } catch { /* counting must never break a successful local save */ }
      finally { pending = false }
    },
  }
}

let counter: ReturnType<typeof createAnonymousCounter> | undefined
function browserCounter() {
  if (typeof window === 'undefined') return undefined
  try {
    counter ??= createAnonymousCounter({
      origin: location.origin,
      storage: localStorage,
      privacySignal: () => navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
      send: async body => {
        if (!['https://nestflow.art', 'https://app.nestflow.art'].includes(location.origin)) return false
        const response = await fetch(ENDPOINT, { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', keepalive: true, headers: { 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(3000) })
        return response.ok
      },
    })
    return counter
  } catch { return undefined }
}

export const anonymousCountsEnabled = () => browserCounter()?.enabled() ?? false
export function setAnonymousCountsEnabled(enabled: boolean) {
  browserCounter()?.setEnabled(enabled)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}
export function subscribeAnonymousCounts(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => { window.removeEventListener(CHANGE_EVENT, listener); window.removeEventListener('storage', listener) }
}
export function recordFirstSuccessfulUse() {
  try {
    const record = () => browserCounter()?.firstSuccess(document.documentElement.lang)
    if (navigator.locks) void navigator.locks.request('focusgo-anonymous-first-success', record).catch(() => undefined)
    else void record()
  } catch { /* non-blocking */ }
}

function initializeWebsiteCounts() {
  const controls = document.querySelectorAll<HTMLButtonElement>('[data-anonymous-counts-control]')
  if (!controls.length) return
  const update = () => controls.forEach(button => {
    const enabled = anonymousCountsEnabled()
    button.disabled = false
    button.setAttribute('aria-pressed', String(enabled))
    button.textContent = document.documentElement.lang.startsWith('zh') ? `匿名计数：${enabled ? '开启' : '关闭'}` : `Anonymous counts: ${enabled ? 'on' : 'off'}`
  })
  controls.forEach(button => button.addEventListener('click', () => setAnonymousCountsEnabled(!anonymousCountsEnabled())))
  subscribeAnonymousCounts(update); update()
  void browserCounter()?.website('website_view', location.pathname)
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null
    if (link instanceof HTMLAnchorElement && link.origin === 'https://app.nestflow.art' && link.pathname === '/') void browserCounter()?.website('app_open', location.pathname)
  })
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeWebsiteCounts, { once: true })
  else initializeWebsiteCounts()
}
