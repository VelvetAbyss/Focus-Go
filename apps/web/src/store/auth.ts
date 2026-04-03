import { useSyncExternalStore } from 'react'
import { isLocalhostRuntime } from '../shared/env/localhost'

export const AUTH_CHANGED_EVENT = 'focusgo:auth-changed'

export type AuthPlan = 'free' | 'premium'

export type AuthProfile = {
  id: string
  email: string | null
  plan: AuthPlan
  expiresAt: string | null
}

export const getAuth = () => {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem('auth')
  return raw ? JSON.parse(raw) : null
}

export const setAuth = (value: unknown) => {
  if (typeof localStorage === 'undefined' || typeof window === 'undefined') return
  localStorage.setItem('auth', JSON.stringify(value))
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const clearAuth = () => {
  if (typeof localStorage === 'undefined' || typeof window === 'undefined') return
  localStorage.removeItem('auth')
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
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

export const fetchAuthProfile = async (accessToken: string): Promise<AuthProfile | null> => {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/user/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return null
    return await res.json() as AuthProfile
  } catch {
    return null
  }
}

export const refreshAuthProfile = async () => {
  const auth = getAuth()
  if (!auth?.accessToken) return null
  try {
    const profile = await fetchAuthProfile(auth.accessToken)
    if (!profile) return null
    setAuth({ ...auth, plan: profile.plan, expiresAt: profile.expiresAt })
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
