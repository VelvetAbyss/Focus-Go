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
})
