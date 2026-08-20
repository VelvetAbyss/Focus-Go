// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginModal from './LoginModal'

const mocks = vi.hoisted(() => ({
  signInGoogle: vi.fn(),
  finishBetterAuthSession: vi.fn(),
}))

vi.mock('../../config/authClient', () => ({
  authClient: {
    signUp: vi.fn(),
    signInEmail: vi.fn(),
    signInUsername: vi.fn(),
    signInGoogle: mocks.signInGoogle,
  },
}))

vi.mock('../../config/authRuntime', () => ({
  finishBetterAuthSession: mocks.finishBetterAuthSession,
  getGoogleAuthCallbackURL: () => 'http://localhost:5173/?auth=google',
}))

vi.mock('../../features/payments/paymentFlow', () => ({
  consumePendingCheckout: vi.fn(() => null),
  startPremiumCheckout: vi.fn(),
}))

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ language: 'en' }),
}))

describe('LoginModal', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.signInGoogle.mockReset()
    mocks.finishBetterAuthSession.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts Google sign-in with the explicit OAuth return marker', async () => {
    mocks.signInGoogle.mockResolvedValue({ token: 'google-token', user: { id: 'user-1' } })
    mocks.finishBetterAuthSession.mockResolvedValue(undefined)
    render(<LoginModal onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /continue with google/i }))

    await waitFor(() => {
      expect(mocks.signInGoogle).toHaveBeenCalledWith('http://localhost:5173/?auth=google')
    })
    expect(mocks.finishBetterAuthSession).toHaveBeenCalledWith('google-token', { id: 'user-1' })
  })
})
