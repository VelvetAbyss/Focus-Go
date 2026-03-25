import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './shared/theme/tokens.css'
import './styles/_variables.scss'
import './styles/_keyframe-animations.scss'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import App from './App.tsx'
import { clearAuth, setAuth } from './store/auth'

console.log('RAW URL:', window.location.href)

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
  const fetchProfile = async (accessToken: string) => {
    try {
      const res = await fetch('http://localhost:3000/user/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) return null
      return await res.json() as { id: string; email: string; plan: string }
    } catch {
      return null
    }
  }

  // ── Check 1: code exchange ────────────────────────────────────────────
  if (code) {
    console.log('FOUND CODE:', code)
    window.history.replaceState({}, '', '/')  // clear immediately — codes are single-use

    try {
      const res = await fetch('http://localhost:3000/auth/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('AUTH RESPONSE:', data)
      const profile = await fetchProfile(data.accessToken)
      setAuth({ ...data, plan: profile?.plan ?? 'free' })
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
        const res = await fetch('http://localhost:3000/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const { user } = await res.json()
        const profile = await fetchProfile(accessToken)
        setAuth({ accessToken, user, plan: profile?.plan ?? 'free' })
        console.log('TOKEN REUSED — user refreshed:', user)
      } catch (err) {
        console.warn('Token validation failed, clearing auth:', err)
        clearAuth()
      }
    }
  }

  mountApp()
}

bootstrap()
