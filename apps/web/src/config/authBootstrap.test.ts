// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const fetchAuthProfileMock = vi.fn()
const setAuthMock = vi.fn()
const clearAuthMock = vi.fn()
const getAuthMock = vi.fn()
const probeAuthProfileMock = vi.fn()
const platform = {
  isDesktop: false,
  loadAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  saveAuthToken: vi.fn(),
}

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
  probeAuthProfile: probeAuthProfileMock,
}))

vi.mock('../platform', () => ({ getPlatform: () => platform }))

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
    probeAuthProfileMock.mockReset()
    platform.isDesktop = false
    platform.loadAuthToken.mockReset()
    platform.clearAuthToken.mockReset()
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

  it('does not clear anonymous state when cookie session rehydrate fails for a first-time visitor', async () => {
    getSessionMock.mockRejectedValue(new Error('no session'))
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(setAuthMock).not.toHaveBeenCalled()
    expect(clearAuthMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('auth')).toBeNull()
  })
  it('keeps a signed-in web session when the app starts offline', async () => {
    getAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    getSessionMock.mockRejectedValue(new TypeError('Failed to fetch'))
    probeAuthProfileMock.mockResolvedValue({ kind: 'unreachable' })
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(clearAuthMock).not.toHaveBeenCalled()
  })

  it('signs the web session out when the server answers that it is gone', async () => {
    getAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    getSessionMock.mockResolvedValue(null)
    probeAuthProfileMock.mockResolvedValue({ kind: 'rejected' })
    const { bootstrapAuth } = await import('./authBootstrap')

    await bootstrapAuth()

    expect(clearAuthMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the desktop session and its token when the app starts offline', async () => {
    platform.isDesktop = true
    platform.loadAuthToken.mockResolvedValue('keychain-token')
    getAuthMock.mockReturnValue({ user: { id: 'user-1', email: 'me@example.com' }, isAdmin: false })
    probeAuthProfileMock.mockResolvedValue({ kind: 'unreachable' })
    const { bootstrapAuth } = await import('./authBootstrap')

    await bootstrapAuth()

    expect(probeAuthProfileMock).toHaveBeenCalledWith('keychain-token')
    expect(setAuthMock).toHaveBeenCalledWith({ user: { id: 'user-1', email: 'me@example.com' }, isAdmin: false, accessToken: 'keychain-token' })
    expect(clearAuthMock).not.toHaveBeenCalled()
    expect(platform.clearAuthToken).not.toHaveBeenCalled()
  })

  it('drops a desktop token the server rejects', async () => {
    platform.isDesktop = true
    platform.loadAuthToken.mockResolvedValue('expired-token')
    getAuthMock.mockReturnValue({ user: { id: 'user-1' } })
    probeAuthProfileMock.mockResolvedValue({ kind: 'rejected' })
    const { bootstrapAuth } = await import('./authBootstrap')

    await bootstrapAuth()

    expect(platform.clearAuthToken).toHaveBeenCalledTimes(1)
    expect(clearAuthMock).toHaveBeenCalledTimes(1)
  })
})
