import { clearAuth, fetchAuthProfile, getAuth, setAuth } from '../store/auth'
import { consumePendingCheckout, startPremiumCheckout } from '../features/payments/paymentFlow'
import { clearAuthRedirectParams, finishBetterAuthCookieSession, hasAuthRedirectParams } from './authRuntime'
import { getPlatform } from '../platform'

const completePendingCheckout = async () => {
  const pendingCheckout = consumePendingCheckout()
  if (!pendingCheckout) return false
  await startPremiumCheckout(pendingCheckout)
  return true
}

// Desktop session restore. The HttpOnly cookie is a dropped third-party cookie
// under the tauri:// origin, so instead we restore the Bearer token from the OS
// keychain and validate it against the profile endpoint. The persisted `user`
// hint (localStorage, no token) supplies display fields; if it is missing we
// synthesize a minimal user from the profile so `useIsLoggedIn` resolves true.
const bootstrapDesktopSession = async () => {
  const platform = getPlatform()
  const token = await platform.loadAuthToken()
  if (!token) {
    if (getAuth()) clearAuth()
    return
  }
  const profile = await fetchAuthProfile(token)
  if (!profile) {
    // Token expired/revoked — drop it so the user sees a clean login.
    await platform.clearAuthToken()
    clearAuth()
    return
  }
  const hint = getAuth() ?? {}
  setAuth({
    ...hint,
    accessToken: token,
    user: hint.user ?? { id: profile.id, email: profile.email },
    plan: profile.plan,
    entitlement: profile.entitlement,
    expiresAt: profile.expiresAt,
    isLifetime: profile.isLifetime,
    isAdmin: profile.isAdmin,
    ...(profile.country_code != null ? { country_code: profile.country_code } : {}),
  })
}

// On every page load, exchange the HttpOnly better-auth cookie for a fresh
// in-memory access token. We no longer trust an `accessToken` stored in
// localStorage — that field is gone — so the cookie is the single source of
// truth for authentication state.
export const bootstrapAuth = async () => {
  // Desktop: token-based session restore from the OS keychain (no cookie).
  if (getPlatform().isDesktop) {
    try {
      await bootstrapDesktopSession()
      if (await completePendingCheckout()) return false
    } catch {
      if (getAuth()) clearAuth()
    }
    return true
  }

  const isAuthRedirect = hasAuthRedirectParams()
  try {
    await finishBetterAuthCookieSession()
    if (isAuthRedirect) clearAuthRedirectParams()
    if (await completePendingCheckout()) return false
  } catch {
    // No active session cookie. Only emit a clear if there's prior state to
    // drop (avoids spurious re-renders for first-time visitors).
    if (isAuthRedirect) clearAuthRedirectParams()
    if (getAuth()) clearAuth()
  }
  return true
}
