// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const fetchAuthProfileMock = vi.fn()
const setAuthMock = vi.fn()
const clearAuthMock = vi.fn()
const getAuthMock = vi.fn()

vi.mock('./authClient', () => ({
  authClient: {
    getSession: getSessionMock,
  },
}))

vi.mock('../store/auth', () => ({
  fetchAuthProfile: fetchAuthProfileMock,
  setAuth: setAuthMock,
  clearAuth: clearAuthMock,
  getAuth: getAuthMock,
}))

describe('bootstrapAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.replaceState(null, '', '/')
    getSessionMock.mockReset()
    fetchAuthProfileMock.mockReset()
    setAuthMock.mockReset()
    clearAuthMock.mockReset()
    getAuthMock.mockReset()
    getAuthMock.mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rehydrates local auth from Better Auth cookie after a Google OAuth callback', async () => {
    window.history.replaceState(null, '', '/?auth=google')
    getSessionMock.mockResolvedValue({
      session: { token: 'oauth-token' },
      user: { id: 'user-1', email: 'user@example.com' },
    })
    fetchAuthProfileMock.mockResolvedValue({
      id: 'business-user-1',
      email: 'user@example.com',
      isSupporter: true,
      cloudSync: { usedBytes: 1024, payloadBytes: 512, blobBytes: 512, limitBytes: 262144000 },
      isAdmin: true,
    })
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(setAuthMock).toHaveBeenCalledWith({
      accessToken: 'oauth-token',
      user: { id: 'user-1', email: 'user@example.com' },
      isSupporter: true,
      cloudSync: { usedBytes: 1024, payloadBytes: 512, blobBytes: 512, limitBytes: 262144000 },
      isAdmin: true,
    })
    expect(window.location.search).toBe('')
  })

  it('always exchanges the cookie session on boot — never trusts a token from localStorage', async () => {
    // Even if a stale `auth` hint sits in localStorage, the source of truth is
    // the HttpOnly cookie via get-session. accessToken is never persisted.
    localStorage.setItem('auth', JSON.stringify({
      user: { id: 'user-1' },
      plan: 'free',
    }))
    getSessionMock.mockResolvedValue({
      session: { token: 'cookie-token' },
      user: { id: 'user-1', email: 'user@example.com' },
    })
    fetchAuthProfileMock.mockResolvedValue({
      id: 'business-user-1',
      email: 'user@example.com',
      isSupporter: false,
      isAdmin: false,
    })
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(getSessionMock).toHaveBeenCalledTimes(1)
    expect(setAuthMock).toHaveBeenCalledWith({
      accessToken: 'cookie-token',
      user: { id: 'user-1', email: 'user@example.com' },
      isSupporter: false,
      cloudSync: undefined,
      isAdmin: false,
    })
  })

  it('surfaces a failed cookie request without clearing local state', async () => {
    getSessionMock.mockRejectedValue(new Error('no session'))
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).rejects.toThrow('no session')

    expect(setAuthMock).not.toHaveBeenCalled()
    expect(clearAuthMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('auth')).toBeNull()
  })
})
