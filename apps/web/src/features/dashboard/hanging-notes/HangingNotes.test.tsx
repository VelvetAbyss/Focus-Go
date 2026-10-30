// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareAppUpdate } from '../../../shared/runtime/updateLifecycle'
import HangingNotes from './HangingNotes'

const mocks = vi.hoisted(() => ({ create: vi.fn(), save: vi.fn(), get: vi.fn() }))
vi.mock('dexie', () => ({ liveQuery: () => ({ subscribe: (observer: { next: (value: unknown) => void }) => {
  observer.next({ hangingNotes: [] })
  return { unsubscribe: vi.fn() }
} }) }))
vi.mock('../../../store/auth', () => ({ getAuth: () => null, subscribeAuth: () => () => undefined }))
vi.mock('../../../shared/i18n/useI18n', () => ({ useI18n: () => ({ language: 'zh' }) }))
vi.mock('../../../data/repositories/syncedPreferencesRepo', () => ({ syncedPreferencesRepo: { get: mocks.get, saveHangingNotes: mocks.save } }))
vi.mock('./controller', () => ({ createHangingNotes: mocks.create }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockReturnValue({ update: vi.fn(), destroy: vi.fn() })
  mocks.get.mockResolvedValue({ hangingNotes: [] })
})
afterEach(cleanup)

describe('hanging note update preparation', () => {
  it('waits for a queued note write before the app can update', async () => {
    let finish!: () => void
    mocks.save.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    render(<HangingNotes />)
    let save!: Promise<unknown>
    await act(async () => { save = mocks.create.mock.calls[0][2]([], () => []) })
    let prepared = false
    const preparation = prepareAppUpdate().then(() => { prepared = true })
    await act(async () => { await Promise.resolve() })
    expect(prepared).toBe(false)
    await act(async () => { finish(); await save; await preparation })
    expect(prepared).toBe(true)
  })

  it('blocks an update after a failed save and removes its listener on unmount', async () => {
    mocks.save.mockRejectedValue(new Error('disk unavailable'))
    const view = render(<HangingNotes />)
    await act(async () => {
      await expect(mocks.create.mock.calls[0][2]([], () => [])).rejects.toThrow('disk unavailable')
    })
    await expect(prepareAppUpdate()).rejects.toThrow('disk unavailable')
    view.unmount()
    await expect(prepareAppUpdate()).resolves.toBeUndefined()
  })
})
