import { useSyncExternalStore } from 'react'

export const AUTH_CHANGED_EVENT = 'focusgo:auth-changed'

export const getAuth = () => {
  const raw = localStorage.getItem('auth')
  return raw ? JSON.parse(raw) : null
}

export const setAuth = (value: unknown) => {
  localStorage.setItem('auth', JSON.stringify(value))
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const clearAuth = () => {
  localStorage.removeItem('auth')
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export const subscribeAuth = (listener: () => void) => {
  const handle = () => listener()
  window.addEventListener(AUTH_CHANGED_EVENT, handle)
  window.addEventListener('storage', handle)
  return () => {
    window.removeEventListener(AUTH_CHANGED_EVENT, handle)
    window.removeEventListener('storage', handle)
  }
}

export const isPro = (): boolean => {
  return true
}

// Returns a boolean — safe for useSyncExternalStore (primitive comparison)
export const useIsLoggedIn = () =>
  useSyncExternalStore(subscribeAuth, () => getAuth()?.user != null, () => false)

export const useAuthPlan = () =>
  useSyncExternalStore(subscribeAuth, () => 'premium', () => 'premium')

export const upgradeToPremium = async (): Promise<boolean> => {
  const auth = getAuth()
  if (!auth?.accessToken) return false
  try {
    const res = await fetch(`${import.meta.env.VITE_API_BASE}/user/upgrade`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    })
    if (!res.ok) return false
    setAuth({ ...auth, plan: 'premium' })
    return true
  } catch {
    return false
  }
}
