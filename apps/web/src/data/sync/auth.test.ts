// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn(), save: vi.fn(), auth: { accessToken: 'old', user: { id: 'a' } } as { accessToken?: string; user: { id: string } } }))
vi.mock('../../config/authClient', () => ({ authClient: { getSession: mocks.session } }))
vi.mock('../../store/auth', () => ({ getAuth: () => mocks.auth, setAuth: (value: typeof mocks.auth) => { mocks.auth = value }, subscribeAuth: () => () => {} }))
vi.mock('../../shared/apiBase', () => ({ fetchApi: mocks.fetch }))
vi.mock('../../platform', () => ({ getPlatform: () => ({ saveAuthToken: mocks.save }) }))
const session = (token = 'old') => ({ session: { token }, user: { id: 'auth-a' } })
beforeEach(() => {
  vi.resetModules()
  mocks.auth = { accessToken: 'old', user: { id: 'a' } }
  mocks.session.mockReset().mockResolvedValue(session())
  mocks.fetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: 'a' }) })
  mocks.save.mockReset().mockResolvedValue(undefined)
})

describe('sync session recovery', () => {
  it('keeps an offline account hint without a token out of the expired state', async () => {
    mocks.auth = { user: { id: 'a' } }
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      const { ensureSyncSession, isSyncAuthRequired, SyncAuthError } = await import('./auth')
      const error = await ensureSyncSession().catch(error => error)
      expect(error).not.toBeInstanceOf(SyncAuthError)
      expect(error.message).toContain('offline')
      expect(isSyncAuthRequired()).toBe(false)
      expect(mocks.session).not.toHaveBeenCalled()
    } finally { online.mockRestore() }
  })
  it('recovers an online account hint from its cookie without needing a token', async () => {
    mocks.auth = { user: { id: 'a' } }
    const { ensureSyncSession } = await import('./auth')
    await ensureSyncSession()
    expect(mocks.auth.accessToken).toBe('old')
    expect(mocks.session).toHaveBeenCalledTimes(1)
  })
  it('deduplicates concurrent renewal and throttles successful checks', async () => {
    const { ensureSyncSession } = await import('./auth')
    await Promise.all([ensureSyncSession(), ensureSyncSession(), ensureSyncSession()])
    await ensureSyncSession()
    expect(mocks.session).toHaveBeenCalledTimes(1)
    await ensureSyncSession(true)
    expect(mocks.session).toHaveBeenCalledTimes(2)
  })
  it('recovers a missing cookie with a bearer session and persists the renewed token', async () => {
    mocks.session.mockResolvedValueOnce(null).mockResolvedValueOnce(session('renewed'))
    const { ensureSyncSession } = await import('./auth')
    await ensureSyncSession()
    expect(mocks.session.mock.calls).toEqual([[], ['old']])
    expect(mocks.auth.accessToken).toBe('renewed')
    expect(mocks.save).toHaveBeenCalledWith('renewed')
  })
  it('does not adopt another account from cookies', async () => {
    mocks.session.mockResolvedValue(session('other-token'))
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'b' }) })
    const { ensureSyncSession, SyncAuthError } = await import('./auth')
    await expect(ensureSyncSession()).rejects.toBeInstanceOf(SyncAuthError)
    expect(mocks.auth).toEqual({ accessToken: 'old', user: { id: 'a' } })
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('preserves identity when expired and resumes only after a new token', async () => {
    mocks.session.mockResolvedValue(null)
    const { ensureSyncSession, SyncAuthError, pauseSyncForAuth, isSyncAuthRequired } = await import('./auth')
    await expect(ensureSyncSession()).rejects.toBeInstanceOf(SyncAuthError)
    pauseSyncForAuth()
    expect(isSyncAuthRequired()).toBe(true)
    await expect(ensureSyncSession()).rejects.toBeInstanceOf(SyncAuthError)
    expect(mocks.session).toHaveBeenCalledTimes(2)
    expect(mocks.auth.user.id).toBe('a')
    mocks.auth = { ...mocks.auth, accessToken: 'new-login' }
    expect(isSyncAuthRequired()).toBe(false)
  })
  it('does not treat a network failure as expiration', async () => {
    mocks.session.mockRejectedValue(new TypeError('Failed to fetch'))
    const { ensureSyncSession, SyncAuthError, isSyncAuthRequired } = await import('./auth')
    const error = await ensureSyncSession().catch(error => error)
    expect(error).not.toBeInstanceOf(SyncAuthError)
    expect(isSyncAuthRequired()).toBe(false)
    expect(mocks.auth.accessToken).toBe('old')
  })
  it('discards renewal after another login completes', async () => {
    let finish!: (value: ReturnType<typeof session>) => void
    mocks.session.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const { ensureSyncSession } = await import('./auth')
    const pending = ensureSyncSession()
    mocks.auth = { accessToken: 'new-login', user: { id: 'b' } }
    finish(session('renewed'))
    await expect(pending).rejects.toThrow('Sync account changed')
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.auth.accessToken).toBe('new-login')
  })
})
