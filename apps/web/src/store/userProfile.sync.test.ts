// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
const fetchApi = vi.fn()
vi.mock('../shared/apiBase', () => ({ fetchApi: (...args: unknown[]) => fetchApi(...args) }))
import { clearAuth, getAuth, setAuth } from './auth'
import { getProfile, saveAccountProfile, syncAccountProfile, profileSaveState } from './userProfile'
const account = (revision = 1, profile = {}, name = 'Cloud') => ({ id: 'a', name, image: null, revision, profile })
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { localStorage.clear(); clearAuth(); fetchApi.mockReset(); setAuth({ user: { id: 'a', name: 'Original' }, accessToken: 'token-a' }) })
it('keeps offline edits locally and uploads them after reconnecting', async () => {
  fetchApi.mockRejectedValue(new TypeError('offline'))
  saveAccountProfile('a', { name: 'Draft', bio: 'Offline bio' })
  await syncAccountProfile('a')
  expect(getProfile('a').bio).toBe('Offline bio')
  expect(profileSaveState('a')).toBe('error')
  fetchApi.mockResolvedValueOnce(response({ account: account() })).mockResolvedValueOnce(response({ account: account(2, { bio: 'Offline bio' }, 'Draft') }))
  await syncAccountProfile('a')
  expect(JSON.parse(fetchApi.mock.calls.at(-1)![1].body).patch).toEqual({ name: 'Draft', bio: 'Offline bio' })
  expect(getAuth().user.name).toBe('Draft')
  expect(profileSaveState('a')).toBe('saved')
})
it('downloads an existing profile without uploading stale local fields', async () => {
  localStorage.setItem('focus_go.userProfile.v1', JSON.stringify({ a: { bio: 'Stale' } }))
  fetchApi.mockResolvedValueOnce(response({ account: account(4, { bio: 'Other device' }) }))
  await syncAccountProfile('a')
  expect(getProfile('a').bio).toBe('Other device'); expect(fetchApi).toHaveBeenCalledTimes(1)
})
it('does not apply a response after an account switch', async () => {
  let finish!: (value: Response) => void
  fetchApi.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const pending = syncAccountProfile('a')
  setAuth({ user: { id: 'b', name: 'Other account' }, accessToken: 'token-b' })
  finish(response({ account: account(1, { bio: 'Secret A' }) }))
  await pending
  expect(getAuth().user.name).toBe('Other account'); expect(getProfile('b')).toEqual({}); expect(getProfile('a')).toEqual({})
})
it('preserves newer edits made while a previous save is in flight', async () => {
  let finish!: (value: Response) => void
  fetchApi.mockResolvedValueOnce(response({ account: account() }))
    .mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(response({ account: account(2, { bio: 'First' }) }))
    .mockResolvedValueOnce(response({ account: account(3, { bio: 'Second' }) }))
  saveAccountProfile('a', { bio: 'First' })
  await vi.waitFor(() => expect(fetchApi).toHaveBeenCalledTimes(2))
  saveAccountProfile('a', { bio: 'Second' })
  finish(response({ account: account(2, { bio: 'First' }) }))
  await syncAccountProfile('a')
  expect(getProfile('a').bio).toBe('Second'); expect(profileSaveState('a')).toBe('saved')
  expect(JSON.parse(fetchApi.mock.calls[3][1].body).patch).toEqual({ bio: 'Second' })
})
it('retries a revision conflict and only sends the changed fields', async () => {
  fetchApi.mockResolvedValueOnce(response({ account: account() }))
    .mockResolvedValueOnce(response({ error: 'profile_changed' }, 409))
    .mockResolvedValueOnce(response({ account: account(2, { location: 'Paris' }) }))
    .mockResolvedValueOnce(response({ account: account(3, { location: 'Paris', bio: 'My edit' }) }))
  saveAccountProfile('a', { bio: 'My edit' }); await syncAccountProfile('a')
  expect(JSON.parse(fetchApi.mock.calls[3][1].body)).toEqual({ revision: 2, patch: { bio: 'My edit' } })
  expect(getProfile('a').location).toBe('Paris')
})
