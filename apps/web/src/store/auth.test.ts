// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAuth, getAuth, setAuth, subscribeAuth, refreshAuthProfile } from './auth'
import { LOCAL_DATA_OWNER_KEY } from './authOwnership'

beforeEach(() => { clearAuth(); localStorage.clear() })
afterEach(() => vi.unstubAllGlobals())
describe('local account ownership', () => {
  it('does not trust tokens persisted by older versions', () => {
    localStorage.setItem('auth', JSON.stringify({ accessToken: 'stale', user: { id: 'a' } }))
    expect(getAuth()).toEqual({ user: { id: 'a' } })
    expect(getAuth()).toBe(getAuth())
  })
  it('prevents another account from claiming the existing local workspace', () => {
    setAuth({ accessToken: 'a-token', user: { id: 'a' } })
    expect(() => setAuth({ accessToken: 'b-token', user: { id: 'b' } })).toThrow('another account')
    expect(getAuth().user.id).toBe('a')
    clearAuth()
    expect(localStorage.getItem(LOCAL_DATA_OWNER_KEY)).toBe('a')
    expect(() => setAuth({ accessToken: 'b-token', user: { id: 'b' } })).toThrow('another account')
  })
  it('rehydrates the same account and keeps tokens out of storage', () => {
    localStorage.setItem('auth', JSON.stringify({ user: { id: 'a' } }))
    setAuth({ accessToken: 'fresh', user: { id: 'a' } })
    expect(getAuth().accessToken).toBe('fresh')
    expect(localStorage.getItem('auth')).not.toContain('fresh')
  })
  it('drops the in-memory token when another tab logs out', () => {
    setAuth({ accessToken: 'fresh', user: { id: 'a' } })
    const unsubscribe = subscribeAuth(() => {})
    localStorage.removeItem('auth')
    window.dispatchEvent(new StorageEvent('storage', { key: 'auth', newValue: null }))
    expect(getAuth()).toBeNull()
    unsubscribe()
  })
  it('does not resurrect a logged-out account when a profile request finishes late', async () => {
    let resolve!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done) => { resolve = done })))
    setAuth({ accessToken: 'fresh', user: { id: 'a' } })
    const pending = refreshAuthProfile()
    clearAuth()
    resolve(new Response(JSON.stringify({ id: 'a', isAdmin: false, isSupporter: false }), { status: 200 }))
    await pending
    expect(getAuth()).toBeNull()
  })

})
