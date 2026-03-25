export const AUTH_CONFIG = {
  clientId: '69c2527e136d5010dd81b681',
  domain: 'https://nestflow.authing.cn',
  redirectUri: import.meta.env.VITE_REDIRECT_URI ?? 'http://localhost:5174',
  scope: 'openid profile email',
}

export const getAuthUrl = () => {
  const { clientId, domain, redirectUri, scope } = AUTH_CONFIG
  return `${domain}/oidc/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`
}
