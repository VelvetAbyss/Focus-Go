import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('authClient', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"url":"https://accounts.google.com"}'),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    fetchMock.mockReset()
    vi.resetModules()
  })

  it('starts Google sign-in through Better Auth without automatic redirect', async () => {
    vi.stubEnv('VITE_AUTH_API_BASE', 'https://api.nestflow.art/api/auth')
    const { authClient } = await import('./authClient')

    await authClient.signInGoogle('https://app.nestflow.art/?auth=google')

    expect(fetchMock).toHaveBeenCalledWith('https://api.nestflow.art/api/auth/sign-in/social', expect.objectContaining({
      credentials: 'include',
      method: 'POST',
      body: JSON.stringify({
        provider: 'google',
        callbackURL: 'https://app.nestflow.art/?auth=google',
        disableRedirect: true,
      }),
    }))
  })

  it('explains missing Google provider configuration', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('{"message":"Provider not found"}'),
      headers: new Headers({ 'content-type': 'application/json' }),
    } as Response)
    const { authClient } = await import('./authClient')

    await expect(authClient.signInGoogle('https://app.nestflow.art/?auth=google')).rejects.toThrow(
      /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    )
  })

  it('includes the active bearer session when signing out', async () => {
    const { setAuth, clearAuth } = await import('../store/auth')
    setAuth({ accessToken: 'desktop-session', user: { id: 'account' } })
    try {
      const { authClient } = await import('./authClient')
      await authClient.signOut()
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/sign-out'), expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer desktop-session' }),
      }))
    } finally { clearAuth() }
  })
  it('carries explicit current confirmation through native and Google registration', async () => {
    const { authClient } = await import('./authClient')
    const policyAcceptance = { termsAccepted: true as const, privacyAcknowledged: true as const, termsVersion: '2026-10-19', privacyVersion: '2026-10-19', locale: 'zh' as const }
    await authClient.signUp({ email: 'policy@example.test', username: 'policy', name: 'Policy', password: 'test-password-123', policyAcceptance })
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).policyAcceptance).toEqual(policyAcceptance)
    await authClient.signInGoogle('https://app.nestflow.art/?auth=google', policyAcceptance)
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).additionalData).toEqual({ policyAcceptance })
  })

  it('preserves a stale policy error so the UI can request a refresh', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve('{"code":"POLICY_CONFIRMATION_REQUIRED","message":"Read current policies"}'), headers: new Headers({ 'content-type': 'application/json' }) } as Response)
    const { authClient } = await import('./authClient')
    await expect(authClient.signInGoogle('https://app.nestflow.art')).rejects.toThrow('POLICY_CONFIRMATION_REQUIRED')
  })

})
