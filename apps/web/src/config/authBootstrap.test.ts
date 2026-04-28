// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionMock = vi.fn()
const fetchAuthProfileMock = vi.fn()
const setAuthMock = vi.fn()
const clearAuthMock = vi.fn()
const consumePendingCheckoutMock = vi.fn()
const startPremiumCheckoutMock = vi.fn()

vi.mock('./authClient', () => ({
  authClient: {
    getSession: getSessionMock,
  },
}))

vi.mock('../store/auth', () => ({
  fetchAuthProfile: fetchAuthProfileMock,
  setAuth: setAuthMock,
  clearAuth: clearAuthMock,
}))

vi.mock('../features/payments/paymentFlow', () => ({
  consumePendingCheckout: consumePendingCheckoutMock,
  startPremiumCheckout: startPremiumCheckoutMock,
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
    consumePendingCheckoutMock.mockReset()
    startPremiumCheckoutMock.mockReset()
    consumePendingCheckoutMock.mockReturnValue(null)
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
      plan: 'premium',
      expiresAt: '2026-05-01T00:00:00.000Z',
      isAdmin: true,
    })
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(setAuthMock).toHaveBeenCalledWith({
      accessToken: 'oauth-token',
      user: { id: 'user-1', email: 'user@example.com' },
      plan: 'premium',
      expiresAt: '2026-05-01T00:00:00.000Z',
      isAdmin: true,
    })
    expect(window.location.search).toBe('')
  })

  it('keeps a valid stored token and does not call get-session outside OAuth callbacks', async () => {
    localStorage.setItem('auth', JSON.stringify({
      accessToken: 'stored-token',
      user: { id: 'user-1' },
    }))
    fetchAuthProfileMock.mockResolvedValue({
      id: 'business-user-1',
      email: 'user@example.com',
      plan: 'free',
      expiresAt: null,
      isAdmin: false,
    })
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(getSessionMock).not.toHaveBeenCalled()
    expect(clearAuthMock).not.toHaveBeenCalled()
    expect(setAuthMock).toHaveBeenCalledWith({
      accessToken: 'stored-token',
      user: { id: 'user-1' },
      plan: 'free',
      expiresAt: null,
      isAdmin: false,
    })
  })

  it('does not clear anonymous state when cookie session rehydrate fails', async () => {
    getSessionMock.mockRejectedValue(new Error('no session'))
    const { bootstrapAuth } = await import('./authBootstrap')

    await expect(bootstrapAuth()).resolves.toBe(true)

    expect(setAuthMock).not.toHaveBeenCalled()
    expect(clearAuthMock).not.toHaveBeenCalled()
    expect(localStorage.getItem('auth')).toBeNull()
  })
})
