import { getApiBase } from '../shared/apiBase'

type AuthUser = {
  id: string
  name?: string | null
  email?: string | null
  username?: string | null
  displayUsername?: string | null
  image?: string | null
}

type AuthResponse = {
  token?: string
  user?: AuthUser
  url?: string
  redirect?: boolean
  session?: {
    token?: string
  }
}

type AuthErrorPayload = {
  message?: string
  error?: string
  code?: string
}

const normalizeAuthErrorMessage = (error: AuthErrorPayload | null, fallback: string) => {
  const message = error?.message || error?.error || error?.code || fallback
  if (/provider not found/i.test(message)) {
    return 'Google sign in is not configured on the server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for the API.'
  }
  return message
}

const authBasePath = () => {
  const authApiBase = (import.meta.env.VITE_AUTH_API_BASE ?? '').trim()
  if (authApiBase) return authApiBase.replace(/\/$/, '')
  const apiBase = getApiBase()
  if (!apiBase) return '/api/auth'
  if (import.meta.env.PROD && apiBase === '/api') return 'https://api.nestflow.art/api/auth'
  if (apiBase.endsWith('/api')) return `${apiBase}/auth`
  return `${apiBase}/api/auth`
}

// Desktop Google sign-in routes the OAuth callback through this same-origin server
// endpoint (so it carries the session cookie); the server then deep-links the
// one-time code back to the app. See apps/desktop/DESKTOP_AUTH.md.
export const desktopOAuthCallbackURL = () => `${authBasePath()}/desktop/callback`

const parseAuthPayload = (text: string, contentType: string | null) => {
  if (!text) return null
  if (!contentType?.includes('application/json')) {
    if (/^\s*</.test(text)) {
      throw new Error('Auth API returned HTML instead of JSON. Check VITE_AUTH_API_BASE or the /api proxy.')
    }
  }
  return JSON.parse(text)
}

const requestAuth = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${authBasePath()}${path}`, {
    credentials: 'include',
    signal: AbortSignal.timeout(8_000),
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  const payload = parseAuthPayload(text, response.headers.get('content-type'))
  if (!response.ok) {
    const error = payload as AuthErrorPayload | null
    throw new Error(normalizeAuthErrorMessage(error, `Auth request failed (${response.status})`))
  }
  return payload as T
}

export const authClient = {
  signUp: (input: { email: string; username: string; password: string; name: string }) =>
    requestAuth<AuthResponse>('/sign-up/email', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  signInEmail: (input: { email: string; password: string; rememberMe?: boolean }) =>
    requestAuth<AuthResponse>('/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ ...input, rememberMe: input.rememberMe ?? true }),
    }),

  signInUsername: (input: { username: string; password: string }) =>
    requestAuth<AuthResponse>('/sign-in/username', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  signInGoogle: (callbackURL: string) =>
    requestAuth<AuthResponse>('/sign-in/social', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'google',
        callbackURL,
        disableRedirect: true,
      }),
    }),

  // Desktop deep-link flow: exchange the one-time code delivered to
  // focusgo://auth-callback?code=... for a Bearer token + user. Requires the
  // server-side endpoint (POST /desktop/exchange) that mints the OTC during the
  // social-login callback. See apps/desktop deep-link auth docs.
  exchangeDesktopCode: (code: string) =>
    requestAuth<AuthResponse>('/desktop/exchange', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getSession: () => requestAuth<AuthResponse>('/get-session'),

  signOut: () =>
    requestAuth<unknown>('/sign-out', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
