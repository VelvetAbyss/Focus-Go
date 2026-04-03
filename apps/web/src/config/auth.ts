export const AUTH_CONFIG = {
  clientId: '69c2527e136d5010dd81b681',
  domain: 'https://nestflow.authing.cn',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? 'http://localhost:5174',
  scope: 'openid profile email',
}

// ── PKCE helpers ──────────────────────────────────────────────────────────────

const base64UrlEncode = (buffer: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

const generatePkceVerifier = (): string => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes.buffer)
}

const computePkceChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(hash)
}

// ── Auth session ──────────────────────────────────────────────────────────────

/**
 * Generates a PKCE verifier + challenge and a random state nonce, stores them
 * in sessionStorage for verification on callback, and returns the full OIDC
 * authorization URL. Always use this instead of a bare URL builder so that
 * every login attempt is protected against Login CSRF (state) and auth-code
 * interception (PKCE / S256).
 */
export const prepareAuthSession = async (): Promise<string> => {
  const { clientId, domain, redirectUri, scope } = AUTH_CONFIG

  const state = crypto.randomUUID()
  const verifier = generatePkceVerifier()
  const challenge = await computePkceChallenge(verifier)

  sessionStorage.setItem('oauth_state', state)
  sessionStorage.setItem('pkce_verifier', verifier)

  return (
    `${domain}/oidc/auth` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256` +
    `&prompt=login`
  )
}

export const getLogoutUrl = () => {
  const { clientId, domain } = AUTH_CONFIG
  const returnTo = `${window.location.origin}/`
  return `${domain}/oidc/session/end?id_token_hint=&post_logout_redirect_uri=${encodeURIComponent(returnTo)}&client_id=${clientId}`
}
