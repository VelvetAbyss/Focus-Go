import { clearAuth, fetchAuthProfile, setAuth } from '../store/auth'
import { consumePendingCheckout, startPremiumCheckout } from '../features/payments/paymentFlow'
import { clearAuthRedirectParams, finishBetterAuthCookieSession, hasAuthRedirectParams } from './authRuntime'

const completePendingCheckout = async () => {
  const pendingCheckout = consumePendingCheckout()
  if (!pendingCheckout) return false
  await startPremiumCheckout(pendingCheckout)
  return true
}

const restoreStoredAuth = async () => {
  const existing = localStorage.getItem('auth')
  if (!existing) return false
  try {
    const parsed = JSON.parse(existing)
    const accessToken = parsed?.accessToken
    if (!accessToken) return false
    const profile = await fetchAuthProfile(accessToken)
    if (!profile) throw new Error('profile unavailable')
    setAuth({
      accessToken,
      user: parsed.user,
      plan: profile.plan,
      entitlement: profile.entitlement,
      expiresAt: profile.expiresAt,
      isLifetime: profile.isLifetime,
      isAdmin: profile.isAdmin,
    })
    return true
  } catch (err) {
    console.warn('Token validation failed, clearing auth:', err)
    clearAuth()
    return false
  }
}

export const bootstrapAuth = async () => {
  const isAuthRedirect = hasAuthRedirectParams()
  const restoredStoredAuth = await restoreStoredAuth()
  if (restoredStoredAuth) {
    if (await completePendingCheckout()) return false
    if (!isAuthRedirect) return true
  }

  if (isAuthRedirect || !restoredStoredAuth) {
    try {
      await finishBetterAuthCookieSession()
      clearAuthRedirectParams()
      if (await completePendingCheckout()) return false
    } catch {
      // No active Better Auth cookie.
    }
  }

  return true
}
