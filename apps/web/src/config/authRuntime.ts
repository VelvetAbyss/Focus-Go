import { authClient } from './authClient'
import { fetchAuthProfile, getAuth, setAuth } from '../store/auth'
import { bindLocalAccountOwner, LOCAL_ACCOUNT_OWNER_KEY } from './accountOwnership'
import { getPlatform } from '../platform'

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
  isSupporter: boolean
  cloudSync?: { usedBytes: number; payloadBytes: number; blobBytes: number; limitBytes: number }
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
  if (!profile) throw new Error('Unable to validate account session.')
  const previousId = getAuth()?.user?.id
  const nextId = (user as BetterAuthUser).id
  if (!localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY) && previousId && previousId !== nextId) {
    throw new Error('请先退出当前账号再切换账号。')
  }
  bindLocalAccountOwner(String(profile.id))
  const nextAuth = {
    accessToken: token,
    user,
    isSupporter: profile?.isSupporter ?? false,
    cloudSync: profile?.cloudSync,
    isAdmin: profile?.isAdmin ?? false,
  } satisfies StoredAuth
  setAuth(nextAuth)
  // Desktop: persist the Bearer token to the OS keychain so the session survives
  // a restart (the in-memory token and third-party cookie do not). No-op on web.
  void getPlatform().saveAuthToken(token)
  return nextAuth
}

export const finishBetterAuthCookieSession = async () => {
  const session = await authClient.getSession()
  return finishBetterAuthSession(session?.session?.token, session?.user)
}
