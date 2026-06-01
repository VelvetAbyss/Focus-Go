import { useEffect } from 'react'
import { authClient } from './authClient'
import { finishBetterAuthSession } from './authRuntime'
import { getPlatform } from '../platform'

// focusgo://auth-callback?code=<one-time-code>
const AUTH_CALLBACK_HOST = 'auth-callback'

const handleAuthDeepLink = async (raw: string): Promise<void> => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return
  }
  if (url.protocol !== 'focusgo:') return
  if (url.host && url.host !== AUTH_CALLBACK_HOST) return

  const error = url.searchParams.get('error')
  if (error) {
    console.warn('[desktop-auth] sign-in failed:', error)
    return
  }
  const code = url.searchParams.get('code')
  if (!code) return

  try {
    // Exchange the one-time code for a Bearer token + user, then finish the
    // session (which also persists the token to the OS keychain).
    const { token, user } = await authClient.exchangeDesktopCode(code)
    await finishBetterAuthSession(token, user)
  } catch (err) {
    console.warn('[desktop-auth] code exchange failed:', err)
  }
}

/**
 * Desktop-only: listen for the focusgo:// OAuth callback (live + cold-start) and
 * complete Google sign-in. No-op on web. Mount once near the app root.
 */
export const useDesktopAuthDeepLink = (): void => {
  useEffect(() => {
    const platform = getPlatform()
    if (!platform.isDesktop) return
    return platform.onDeepLink((url) => void handleAuthDeepLink(url))
  }, [])
}
