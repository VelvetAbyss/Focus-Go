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

const authBasePath = () => {
  const authApiBase = (import.meta.env.VITE_AUTH_API_BASE ?? '').trim()
  if (authApiBase) return authApiBase.replace(/\/$/, '')
  const apiBase = getApiBase()
  if (!apiBase) return '/api/auth'
  if (import.meta.env.PROD && apiBase === '/api') return 'https://api.nestflow.art/api/auth'
  if (apiBase.endsWith('/api')) return `${apiBase}/auth`
  return `${apiBase}/api/auth`
}

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
    throw new Error(error?.message || error?.error || error?.code || `Auth request failed (${response.status})`)
  }
  return payload as T
}

export const authClient = {
  signUp: (input: { email: string; username: string; password: string; name: string }) =>
    requestAuth<AuthResponse>('/sign-up/email', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  signInEmail: (input: { email: string; password: string }) =>
    requestAuth<AuthResponse>('/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ ...input, rememberMe: true }),
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

  getSession: () => requestAuth<AuthResponse>('/get-session'),

  signOut: () =>
    requestAuth<unknown>('/sign-out', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
}
