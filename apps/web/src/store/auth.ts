import { useSyncExternalStore } from 'react'
import { isLocalhostRuntime } from '../shared/env/localhost'
import { fetchApi } from '../shared/apiBase'

export const AUTH_CHANGED_EVENT = 'focusgo:auth-changed'

export type AuthPlan = 'free' | 'premium'

export type AuthProfile = {
  id: string
  email: string | null
  plan: AuthPlan
  entitlement?: 'free' | 'pro' | 'lifetime'
  expiresAt: string | null
  isLifetime?: boolean
  isAdmin: boolean
  /** ISO 3166-1 alpha-2 country code from IP geolocation, e.g. 'CN', 'US'. null = not yet detected. */
  country_code?: string | null
}

// Access token lives in memory only — never in localStorage — so an XSS payload
// cannot exfiltrate it from persistent storage. The cookie session (HttpOnly,
// set by better-auth) is the long-lived source of truth; on every page load
// bootstrapAuth() exchanges that cookie for a fresh in-memory token.
let inMemoryAuth: Record<string, unknown> | null = null

// Keys safe to persist for instant UI prehydration before bootstrap completes.
// Notably excludes `accessToken`.
const HINT_KEYS = [
  'user', 'plan', 'entitlement', 'expiresAt', 'isLifetime', 'isAdmin', 'country_code',
] as const

const readHint = (): Record<string, unknown> | null => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem('auth')
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
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

// Returned as `any` to preserve the prior loose shape consumed across the app.
// Keep this until callers migrate to a typed accessor.
export const getAuth = (): any => inMemoryAuth ?? readHint()

export const setAuth = (value: unknown) => {
  inMemoryAuth = (value && typeof value === 'object') ? (value as Record<string, unknown>) : null
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
  const handle = () => listener()
  window.addEventListener(AUTH_CHANGED_EVENT, handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}

export const isPro = (): boolean => {
  return isLocalhostRuntime() || getAuth()?.plan === 'premium'
}

// Returns a boolean — safe for useSyncExternalStore (primitive comparison)
export const useIsLoggedIn = () =>
  useSyncExternalStore(subscribeAuth, () => getAuth()?.user != null, () => false)

export const useAuthPlan = () =>
  useSyncExternalStore(subscribeAuth, () => (isLocalhostRuntime() ? 'premium' : (getAuth()?.plan ?? 'free')), () => 'free')


export const fetchAuthProfile = async (accessToken?: string): Promise<AuthProfile | null> => {
  try {
    const res = await fetchApi('/user/profile', {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })
    if (!res.ok) return null
    return await res.json() as AuthProfile
  } catch {
    return null
  }
}

export const useIsAdmin = () =>
  useSyncExternalStore(subscribeAuth, () => isLocalhostRuntime() || Boolean(getAuth()?.isAdmin), () => false)

export const refreshAuthProfile = async () => {
  const auth = getAuth()
  const accessToken = typeof auth?.accessToken === 'string' ? auth.accessToken : null
  if (!accessToken) return null
  try {
    const profile = await fetchAuthProfile(accessToken)
    if (!profile) return null
    setAuth({
      ...auth,
      plan: profile.plan,
      entitlement: profile.entitlement,
      expiresAt: profile.expiresAt,
      isLifetime: profile.isLifetime,
      isAdmin: profile.isAdmin,
      // Persist country_code so MembershipPage and other consumers can read it
      // without an extra fetch. Only overwrite when the server returns a value.
      ...(profile.country_code != null ? { country_code: profile.country_code } : {}),
    })
    return profile
  } catch {
    return null
  }
}

export const upgradeToPremium = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  window.location.assign('/premium')
  return true
}
