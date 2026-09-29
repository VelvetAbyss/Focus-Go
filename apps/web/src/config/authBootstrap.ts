import { fetchAuthProfile, getAuth, setAuth } from '../store/auth'
import { clearAuthRedirectParams, finishBetterAuthCookieSession, hasAuthRedirectParams } from './authRuntime'
import { getPlatform } from '../platform'

// Desktop session restore. The HttpOnly cookie is a dropped third-party cookie
// under the tauri:// origin, so instead we restore the Bearer token from the OS
// keychain and validate it against the profile endpoint. The persisted `user`
// hint (localStorage, no token) supplies display fields; if it is missing we
// synthesize a minimal user from the profile so `useIsLoggedIn` resolves true.
const bootstrapDesktopSession = async () => {
  const platform = getPlatform()
  const token = await platform.loadAuthToken()
  if (!token) {
    if (getAuth()?.user) throw new Error('Session unavailable. Your local data is preserved.')
    return
  }
  const profile = await fetchAuthProfile(token)
  if (!profile) {
    throw new Error('Unable to verify your session. Your local data is preserved.')
  }
  const hint = getAuth() ?? {}
  setAuth({
    ...hint,
    accessToken: token,
    user: hint.user ?? { id: profile.id, email: profile.email },
    isSupporter: profile.isSupporter,
    cloudSync: profile.cloudSync,
    isAdmin: profile.isAdmin,
  })
}

// On every page load, exchange the HttpOnly better-auth cookie for a fresh
// in-memory access token. We no longer trust an `accessToken` stored in
// localStorage — that field is gone — so the cookie is the single source of
// truth for authentication state.
export const bootstrapAuth = async () => {
  // Desktop: token-based session restore from the OS keychain (no cookie).
  if (getPlatform().isDesktop) {
    await bootstrapDesktopSession()
    return true
  }

  const isAuthRedirect = hasAuthRedirectParams()
  await finishBetterAuthCookieSession()
  if (isAuthRedirect) clearAuthRedirectParams()
  return true
}
