import { clearAuth, getAuth } from '../store/auth'
import { consumePendingCheckout, startPremiumCheckout } from '../features/payments/paymentFlow'
import { clearAuthRedirectParams, finishBetterAuthCookieSession, hasAuthRedirectParams } from './authRuntime'

const completePendingCheckout = async () => {
  const pendingCheckout = consumePendingCheckout()
  if (!pendingCheckout) return false
  await startPremiumCheckout(pendingCheckout)
  return true
}

// On every page load, exchange the HttpOnly better-auth cookie for a fresh
// in-memory access token. We no longer trust an `accessToken` stored in
// localStorage — that field is gone — so the cookie is the single source of
// truth for authentication state.
export const bootstrapAuth = async () => {
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
