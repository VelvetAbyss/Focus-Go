// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncProvider } from './service'
import { SYNC_LOCAL_COMMIT_EVENT } from './capture'

const mocks = vi.hoisted(() => ({ cycle: vi.fn(), ready: vi.fn(), stop: vi.fn() }))
vi.mock('../../store/auth', () => ({ useIsLoggedIn: () => true, refreshAuthProfile: async () => {} }))
vi.mock('../../shared/hooks/usePageActivity', () => ({ usePageActivity: () => 'visible' }))
vi.mock('../seed', () => ({ seedDatabase: async () => false }))
vi.mock('../db', () => ({ db: { pendingSyncChanges: { toArray: async () => [] } } }))
vi.mock('./repository', () => ({ syncStateRepo: { get: async () => ({}), patch: async () => ({}) } }))
vi.mock('./rxdb', () => ({ runRxdbSyncCycle: mocks.cycle, ensureRxdbSyncReady: mocks.ready }))
vi.mock('./stream', () => ({ subscribeSyncStream: () => mocks.stop }))

const commit = () => window.dispatchEvent(new CustomEvent(SYNC_LOCAL_COMMIT_EVENT, { detail: { entityTypes: ['notes'] } }))
const tick = async (milliseconds: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds) }) }

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T12:00:00Z')); vi.clearAllMocks(); mocks.cycle.mockResolvedValue(undefined); mocks.ready.mockResolvedValue(undefined); localStorage.clear() })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('sync scheduling', () => {
  it('coalesces local commits and syncs only changed entities after the minimum gap', async () => {
    render(<SyncProvider><div /></SyncProvider>)
    await tick(0)
    expect(mocks.cycle).toHaveBeenCalledTimes(1)
    act(() => { for (let i = 0; i < 20; i++) commit() })
    await tick(1000)
    expect(mocks.cycle).toHaveBeenCalledTimes(2)
    expect(mocks.cycle).toHaveBeenLastCalledWith(['notes'])
  })

  it('does not drop edits made while a sync cycle is in flight', async () => {
    let finish: (() => void) | undefined
    mocks.cycle.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    render(<SyncProvider><div /></SyncProvider>)
    await tick(0)
    act(commit)
    await tick(500)
    expect(mocks.cycle).toHaveBeenCalledTimes(1)
    await act(async () => { finish!() })
    await tick(1000)
    expect(mocks.cycle).toHaveBeenCalledTimes(2)
  })

  it('keeps retry backoff when new edits arrive after an error and cleans up subscriptions', async () => {
    mocks.cycle.mockRejectedValueOnce(new Error('offline'))
    const view = render(<SyncProvider><div /></SyncProvider>)
    await tick(0)
    act(commit)
    await tick(2000)
    expect(mocks.cycle).toHaveBeenCalledTimes(1)
    await tick(28_000)
    expect(mocks.cycle).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(mocks.stop).toHaveBeenCalledOnce()
    act(commit)
    await tick(2000)
    expect(mocks.cycle).toHaveBeenCalledTimes(2)
  })
})
