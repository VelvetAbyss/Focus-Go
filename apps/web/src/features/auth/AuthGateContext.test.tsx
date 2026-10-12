// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let loggedIn = false
vi.mock('../../store/auth', () => ({ useIsLoggedIn: () => loggedIn }))
vi.mock('../../app/layout/LoginModal', () => ({
  default: ({ reason }: { reason?: string }) => <div role="dialog">login:{reason ?? 'plain'}</div>,
}))

import { AuthGateProvider } from './AuthGateContext'
import { LOCAL_ACCOUNT_OWNER_KEY } from '../../config/accountOwnership'

beforeEach(() => {
  localStorage.clear()
  loggedIn = false
})
afterEach(cleanup)

describe('AuthGateProvider', () => {
  it('asks a lapsed account to sign in again, saying its data is kept', async () => {
    localStorage.setItem(LOCAL_ACCOUNT_OWNER_KEY, 'user-1')
    render(<AuthGateProvider><p>app</p></AuthGateProvider>)
    expect(await screen.findByText('login:expired')).toBeInTheDocument()
    // Nothing local was cleared.
    expect(localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY)).toBe('user-1')
  })

  it('stays quiet for a first-time visitor and for a signed-in account', async () => {
    render(<AuthGateProvider><p>app</p></AuthGateProvider>)
    await screen.findByText('app')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    cleanup()

    loggedIn = true
    localStorage.setItem(LOCAL_ACCOUNT_OWNER_KEY, 'user-1')
    render(<AuthGateProvider><p>app</p></AuthGateProvider>)
    await screen.findByText('app')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
