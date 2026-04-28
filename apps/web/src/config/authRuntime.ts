import { authClient } from './authClient'
import { fetchAuthProfile, setAuth } from '../store/auth'

export type BetterAuthUser = {
  id: string
  name?: string | null
  email?: string | null
  username?: string | null
  displayUsername?: string | null
  image?: string | null
}

export type StoredAuth = {
  accessToken: string
  user: unknown
  plan: 'free' | 'premium'
  entitlement?: 'free' | 'pro' | 'lifetime'
  expiresAt: string | null
  isLifetime?: boolean
  isAdmin: boolean
}

const AUTH_REDIRECT_PARAMS = ['auth', 'error', 'error_description', 'state']

export const getGoogleAuthCallbackURL = (origin = window.location.origin) => {
  const url = new URL('/', origin)
  url.searchParams.set('auth', 'google')
  return url.toString()
}

export const hasAuthRedirectParams = (location: Location = window.location) => {
  const params = new URLSearchParams(location.search)
  return AUTH_REDIRECT_PARAMS.some((key) => params.has(key))
}

export const clearAuthRedirectParams = (location: Location = window.location) => {
  if (!hasAuthRedirectParams(location)) return
  const url = new URL(location.href)
  AUTH_REDIRECT_PARAMS.forEach((key) => url.searchParams.delete(key))
  window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`)
}

export const finishBetterAuthSession = async (token?: string, user?: unknown): Promise<StoredAuth> => {
  if (!token || !user) throw new Error('Missing session in auth response.')
  const profile = await fetchAuthProfile(token)
  const nextAuth = {
    accessToken: token,
    user,
    plan: profile?.plan ?? 'free',
    entitlement: profile?.entitlement,
    expiresAt: profile?.expiresAt ?? null,
    isLifetime: profile?.isLifetime,
    isAdmin: profile?.isAdmin ?? false,
  } satisfies StoredAuth
  setAuth(nextAuth)
  return nextAuth
}

export const finishBetterAuthCookieSession = async () => {
  const session = await authClient.getSession()
  return finishBetterAuthSession(session?.session?.token, session?.user)
}
