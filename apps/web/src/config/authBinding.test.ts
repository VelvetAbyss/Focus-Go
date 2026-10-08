// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import { webcrypto } from 'node:crypto'
import { beginDesktopLogin, consumeDesktopLogin } from './authBinding'
import { bindLocalAccountOwner, LOCAL_ACCOUNT_OWNER_KEY } from './accountOwnership'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true })
})

it('rejects unsolicited or mismatched callbacks and consumes a matching pending login once', async () => {
  expect(consumeDesktopLogin('attacker')).toBeNull()
  const callback = new URL(await beginDesktopLogin('https://api.example.test/desktop/callback'))
  const state = callback.searchParams.get('state')!
  expect(callback.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(consumeDesktopLogin('attacker')).toBeNull()
  expect(consumeDesktopLogin(state)?.verifier).toMatch(/^[a-f0-9]{64}$/)
  expect(consumeDesktopLogin(state)).toBeNull()
})

it('blocks account switches until local data reset releases its owner', () => {
  bindLocalAccountOwner('account-a')
  expect(() => bindLocalAccountOwner('account-b')).toThrow()
  expect(localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY)).toBe('account-a')
  localStorage.removeItem(LOCAL_ACCOUNT_OWNER_KEY)
  expect(() => bindLocalAccountOwner('account-b')).not.toThrow()
})
