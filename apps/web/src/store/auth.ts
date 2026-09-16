import { useSyncExternalStore } from 'react'
import { isLocalhostRuntime } from '../shared/env/localhost'
import { fetchApi } from '../shared/apiBase'

import { LOCAL_DATA_OWNER_KEY } from './authOwnership'

export const AUTH_CHANGED_EVENT = 'focusgo:auth-changed'

export type AuthProfile = {
  id: string
  email: string | null
  isSupporter: boolean
  cloudSync: { usedBytes: number; payloadBytes: number; blobBytes: number; limitBytes: number }
  isAdmin: boolean
}

// Access token lives in memory only — never in localStorage — so an XSS payload
// cannot exfiltrate it from persistent storage. The cookie session (HttpOnly,
// set by better-auth) is the long-lived source of truth; on every page load
// bootstrapAuth() exchanges that cookie for a fresh in-memory token.
let inMemoryAuth: Record<string, unknown> | null = null

// Keys safe to persist for instant UI prehydration before bootstrap completes.
// Notably excludes `accessToken`.
const HINT_KEYS = [
  'user', 'isSupporter', 'cloudSync', 'isAdmin',
] as const

let hintRaw: string | null = null
let cachedHint: Record<string, unknown> | null = null
const readHint = (): Record<string, unknown> | null => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem('auth')
  if (raw === hintRaw) return cachedHint
  hintRaw = raw
  cachedHint = null
  try {
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      cachedHint = Object.fromEntries(HINT_KEYS.filter((key) => parsed[key] !== undefined).map((key) => [key, parsed[key]]))
    }
  } catch { /* A corrupt hint must not prevent session recovery. */ }
  return cachedHint
}

const persistHint = (value: Record<string, unknown> | null) => {
  if (typeof localStorage === 'undefined') return
  if (!value) { localStorage.removeItem('auth'); return }
  const hint: Record<string, unknown> = {}
  for (const k of HINT_KEYS) {
    if (value[k] !== undefined) hint[k] = value[k]
  }
  localStorage.setItem('auth', JSON.stringify(hint))
}

// Loose record shape preserved for the many call sites that read ad-hoc
// fields (accessToken, user.name, country_code, etc.). Migrate callers to a
// typed accessor over time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getAuth = (): any => inMemoryAuth ?? readHint()

export const setAuth = (value: unknown) => {
  const next = (value && typeof value === 'object') ? (value as Record<string, unknown>) : null
  const nextId = (next?.user as { id?: unknown } | undefined)?.id
  if (typeof localStorage !== 'undefined' && typeof nextId === 'string') {
    const previousId = (getAuth()?.user as { id?: unknown } | undefined)?.id
    const owner = localStorage.getItem(LOCAL_DATA_OWNER_KEY) ?? (typeof previousId === 'string' ? previousId : null)
    if (owner && owner !== nextId) {
      throw new Error('Local data belongs to another account. Sign back into that account and export or clear its local data before switching accounts.')
    }
    localStorage.setItem(LOCAL_DATA_OWNER_KEY, nextId)
  }
  inMemoryAuth = next
  persistHint(inMemoryAuth)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const clearAuth = () => {
  inMemoryAuth = null
  if (typeof localStorage !== 'undefined') localStorage.removeItem('auth')
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const subscribeAuth = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  const handle = (event: Event) => {
    if (event instanceof StorageEvent && (event.key === 'auth' || event.key === null)) inMemoryAuth = null
    listener()
  }
  window.addEventListener(AUTH_CHANGED_EVENT, handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}

// Returns a boolean — safe for useSyncExternalStore (primitive comparison)
export const useIsLoggedIn = () =>
  useSyncExternalStore(subscribeAuth, () => getAuth()?.user != null, () => false)

export const fetchAuthProfile = async (accessToken?: string): Promise<AuthProfile | null> => {
  try {
    const res = await fetchApi('/user/profile', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    return await res.json() as AuthProfile
  } catch {
    return null
  }
}

export const useIsAdmin = () =>
  useSyncExternalStore(subscribeAuth, () => isLocalhostRuntime() || Boolean(getAuth()?.isAdmin), () => false)

export const useCloudSyncQuota = () =>
  useSyncExternalStore(
    subscribeAuth,
    () => (getAuth()?.cloudSync as AuthProfile['cloudSync'] | undefined) ?? null,
    () => null,
  )

export const refreshAuthProfile = async () => {
  const auth = getAuth()
  const accessToken = typeof auth?.accessToken === 'string' ? auth.accessToken : null
  if (!accessToken) return null
  try {
    const profile = await fetchAuthProfile(accessToken)
    if (!profile || getAuth()?.accessToken !== accessToken) return null
    setAuth({
      ...auth,
      isSupporter: profile.isSupporter,
      cloudSync: profile.cloudSync,
      isAdmin: profile.isAdmin,
    })
    return profile
  } catch {
    return null
  }
}
