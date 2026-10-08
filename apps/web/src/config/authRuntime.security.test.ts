// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { LOCAL_ACCOUNT_OWNER_KEY } from './accountOwnership'

const mocks = vi.hoisted(() => ({ profile: vi.fn(), getAuth: vi.fn(), setAuth: vi.fn(), save: vi.fn() }))
vi.mock('../store/auth', () => ({ fetchAuthProfile: mocks.profile, getAuth: mocks.getAuth, setAuth: mocks.setAuth }))
vi.mock('../platform', () => ({ getPlatform: () => ({ saveAuthToken: mocks.save }) }))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mocks.getAuth.mockReturnValue(null)
  mocks.profile.mockResolvedValue({ id: 'business-b' })
  mocks.save.mockResolvedValue(undefined)
})

it('does not replace auth or persist a token for a different local data owner', async () => {
  localStorage.setItem(LOCAL_ACCOUNT_OWNER_KEY, 'business-a')
  const { finishBetterAuthSession } = await import('./authRuntime')
  await expect(finishBetterAuthSession('token-b', { id: 'auth-b' })).rejects.toThrow()
  expect(mocks.setAuth).not.toHaveBeenCalled()
  expect(mocks.save).not.toHaveBeenCalled()
  expect(localStorage.getItem(LOCAL_ACCOUNT_OWNER_KEY)).toBe('business-a')
})

it('accepts a restored identity hint when the validated business owner is the same', async () => {
  localStorage.setItem(LOCAL_ACCOUNT_OWNER_KEY, 'business-b')
  mocks.getAuth.mockReturnValue({ user: { id: 'business-b' } })
  const { finishBetterAuthSession } = await import('./authRuntime')
  await expect(finishBetterAuthSession('token-b', { id: 'auth-b' })).resolves.toMatchObject({ accessToken: 'token-b' })
  expect(mocks.setAuth).toHaveBeenCalledOnce()
})

it('does not accept a token when the protected profile cannot be validated', async () => {
  mocks.profile.mockResolvedValue(null)
  const { finishBetterAuthSession } = await import('./authRuntime')
  await expect(finishBetterAuthSession('bad', { id: 'auth-b' })).rejects.toThrow(/validate account/)
  expect(mocks.setAuth).not.toHaveBeenCalled()
})
