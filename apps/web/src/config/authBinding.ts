const KEY = 'focusgo:desktop-auth-pending'
const TTL = 10 * 60 * 1000
type PendingLogin = { state: string; verifier: string; createdAt: number }

export const beginDesktopLogin = async (callback: string) => {
  const random = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) => n.toString(16).padStart(2, '0')).join('')
  const pending: PendingLogin = { state: random(), verifier: random(), createdAt: Date.now() }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pending.verifier)))
  const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  sessionStorage.setItem(KEY, JSON.stringify(pending))
  const url = new URL(callback)
  url.searchParams.set('state', pending.state)
  url.searchParams.set('code_challenge', challenge)
  return url.href
}

export const consumeDesktopLogin = (state: string | null): PendingLogin | null => {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  let pending: PendingLogin
  try { pending = JSON.parse(raw) as PendingLogin } catch { sessionStorage.removeItem(KEY); return null }
  if (typeof pending.state !== 'string' || typeof pending.verifier !== 'string'
      || !Number.isFinite(pending.createdAt) || Date.now() - pending.createdAt > TTL || pending.createdAt > Date.now()) {
    sessionStorage.removeItem(KEY)
    return null
  }
  if (!state || state !== pending.state) return null
  sessionStorage.removeItem(KEY)
  return pending
}
