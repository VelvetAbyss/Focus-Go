const { AUTHING_DOMAIN, AUTHING_CLIENT_ID, AUTHING_CLIENT_SECRET, AUTHING_REDIRECT_URI } = process.env

export async function getTokenByCode(code, codeVerifier) {
  const res = await fetch(`${AUTHING_DOMAIN}/oidc/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: AUTHING_CLIENT_ID,
      client_secret: AUTHING_CLIENT_SECRET,
      redirect_uri: AUTHING_REDIRECT_URI,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Failed to get token')
  return data
}

export async function getUserInfo(accessToken) {
  const res = await fetch(`${AUTHING_DOMAIN}/oidc/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'Failed to get user info')
  return data
}
