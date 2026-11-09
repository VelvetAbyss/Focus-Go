import { useSyncExternalStore } from 'react'
import { authClient } from '../../config/authClient'
import { getAuth, setAuth, subscribeAuth } from '../../store/auth'
import { getPlatform } from '../../platform'
import { fetchApi } from '../../shared/apiBase'

export const SYNC_AUTH_REQUIRED = 'Sync paused: please sign in again. Local changes are preserved.'
export class SyncAuthError extends Error {
  constructor() { super(SYNC_AUTH_REQUIRED); this.name = 'SyncAuthError' }
}
export const isSyncAuthError = (error: unknown): boolean => {
  if (error instanceof SyncAuthError) return true
  const wrapped = error as { message?: string; parameters?: { errors?: unknown[] } } | null
  return wrapped?.message === SYNC_AUTH_REQUIRED || Boolean(wrapped?.parameters?.errors?.some(isSyncAuthError))
}

let blocked: { token: string | undefined; accountId: string } | undefined
let lastCheckedToken: string | undefined
let lastCheckedAt = 0
let pending: Promise<void> | undefined
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
export const isSyncAuthRequired = () => Boolean(blocked && getAuth()?.user?.id === blocked.accountId && getAuth()?.accessToken === blocked.token)
export const pauseSyncForAuth = () => {
  const auth = getAuth()
  blocked = auth?.user?.id ? { token: auth.accessToken, accountId: auth.user.id } : undefined
  notify()
}
export const useSyncAuthRequired = () => useSyncExternalStore(listener => {
  listeners.add(listener)
  const unsubscribe = subscribeAuth(listener)
  return () => { listeners.delete(listener); unsubscribe() }
}, isSyncAuthRequired, () => false)

// Recovery runs between cycles, never halfway through applying a response. A
// different cookie account must not claim this device's pending local changes.
export const ensureSyncSession = async (force = false) => {
  if (isSyncAuthRequired()) throw new SyncAuthError()
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sync paused while offline')
  const original = getAuth()
  const token = original?.accessToken as string | undefined
  const accountId = original?.user?.id
  if (!accountId) throw new SyncAuthError()
  if (!force && token && lastCheckedToken === token && Date.now() - lastCheckedAt < 300_000) return
  if (pending) return pending
  const check = async () => {
    let session = await authClient.getSession()
    // Bearer fallback also supports platforms where cookies are unavailable.
    // The auth library validates AND renews it; revoked/expired tokens stay invalid.
    if (!session?.session?.token && token) session = await authClient.getSession(token)
    if (getAuth()?.accessToken !== token || getAuth()?.user?.id !== accountId) throw new Error('Sync account changed')
    const renewedToken = session?.session?.token
    if (!renewedToken || !session?.user) throw new SyncAuthError()
    const response = await fetchApi('/user/profile', { signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${renewedToken}` } })
    if (response.status === 401 || response.status === 403) throw new SyncAuthError()
    if (!response.ok) throw new Error('Unable to check sync session. Please retry.')
    const profile = await response.json()
    if (getAuth()?.accessToken !== token || getAuth()?.user?.id !== accountId) throw new Error('Sync account changed')
    if (String(profile.id) !== String(accountId)) throw new SyncAuthError()
    lastCheckedToken = renewedToken
    lastCheckedAt = Date.now()
    if (renewedToken !== token) {
      setAuth({ ...original, accessToken: renewedToken })
      await getPlatform().saveAuthToken(renewedToken)
    }
  }
  pending = check().catch(error => {
    if (getAuth()?.accessToken !== token || getAuth()?.user?.id !== accountId) throw new Error('Sync account changed')
    if (error?.status === 401 || error?.status === 403) throw new SyncAuthError()
    throw error
  }).finally(() => { pending = undefined })
  return pending
}
