export const AUTH_CONFIG = {
  clientId: '69c2527e136d5010dd81b681',
  domain: 'https://nestflow.authing.cn',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? 'http://localhost:5174',
  scope: 'openid profile email',
}

export const getAuthUrl = () => {
  const { clientId, domain, redirectUri, scope } = AUTH_CONFIG
  return `${domain}/oidc/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&prompt=login`
}

export const getLogoutUrl = () => {
  const { clientId, domain } = AUTH_CONFIG
  const returnTo = `${window.location.origin}/`
  return `${domain}/oidc/session/end?id_token_hint=&post_logout_redirect_uri=${encodeURIComponent(returnTo)}&client_id=${clientId}`
}
