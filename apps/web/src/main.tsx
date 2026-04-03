import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './shared/theme/tokens.css'
import './styles/_variables.scss'
import './styles/_keyframe-animations.scss'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import App from './App.tsx'
import { clearAuth, fetchAuthProfile, setAuth } from './store/auth'
import { consumePendingCheckout, startPremiumCheckout } from './features/payments/paymentFlow'

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

async function bootstrap() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')

  // ── Fetch user profile (plan) using a valid access token ─────────────
  // ── Check 1: code exchange ────────────────────────────────────────────
  if (code) {
    window.history.replaceState({}, '', '/')  // clear immediately — codes are single-use

    // Verify OAuth state nonce to prevent Login CSRF
    const returnedState = url.searchParams.get('state')
    const expectedState = sessionStorage.getItem('oauth_state')
    const pkceVerifier = sessionStorage.getItem('pkce_verifier')
    sessionStorage.removeItem('oauth_state')
    sessionStorage.removeItem('pkce_verifier')

    if (!returnedState || returnedState !== expectedState) {
      console.error('Auth exchange aborted: OAuth state mismatch')
      mountApp()
      return
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, codeVerifier: pkceVerifier }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const profile = await fetchAuthProfile(data.accessToken)
      setAuth({ ...data, plan: profile?.plan ?? 'free', expiresAt: profile?.expiresAt ?? null })
      const pendingCheckout = consumePendingCheckout()
      if (pendingCheckout) {
        await startPremiumCheckout(pendingCheckout)
        return
      }
    } catch (err) {
      console.error('Auth exchange failed:', err)
    }

    mountApp()
    return
  }

  // ── Check 3: reuse stored access_token via /auth/me ──────────────────
  const existing = localStorage.getItem('auth')
  if (existing) {
    const { accessToken } = JSON.parse(existing)
    if (accessToken) {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { user } = await res.json()
        const profile = await fetchAuthProfile(accessToken)
        setAuth({ accessToken, user, plan: profile?.plan ?? 'free', expiresAt: profile?.expiresAt ?? null })
        const pendingCheckout = consumePendingCheckout()
        if (pendingCheckout) {
          await startPremiumCheckout(pendingCheckout)
          return
        }
      } catch (err) {
        console.warn('Token validation failed, clearing auth:', err)
        clearAuth()
      }
    }
  }

  mountApp()
}

bootstrap()
