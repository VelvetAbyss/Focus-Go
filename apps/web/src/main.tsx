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
import { authClient } from './config/authClient'

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

async function bootstrap() {
  // ── Reuse stored Better Auth session token via business profile ──────
  const existing = localStorage.getItem('auth')
  if (existing) {
    const { accessToken } = JSON.parse(existing)
    if (accessToken) {
      try {
        const { user } = JSON.parse(existing)
        const profile = await fetchAuthProfile(accessToken)
        if (!profile) throw new Error('profile unavailable')
        setAuth({ accessToken, user, plan: profile.plan, expiresAt: profile.expiresAt, isAdmin: profile.isAdmin })
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

  // ── Rehydrate from Better Auth cookie after OAuth redirects ──────────
  try {
    const session = await authClient.getSession()
    const accessToken = session?.session?.token
    if (accessToken && session.user) {
      const profile = await fetchAuthProfile(accessToken)
      setAuth({ accessToken, user: session.user, plan: profile?.plan ?? 'free', expiresAt: profile?.expiresAt ?? null, isAdmin: profile?.isAdmin ?? false })
      const pendingCheckout = consumePendingCheckout()
      if (pendingCheckout) {
        await startPremiumCheckout(pendingCheckout)
        return
      }
    }
  } catch {
    // No active Better Auth cookie.
  }

  mountApp()
}

bootstrap()
