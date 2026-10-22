import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ add: vi.fn(), complete: vi.fn(), count: vi.fn() }))
vi.mock('../services/dbService', () => ({ dbService: { tasks: { add: mocks.add }, focusSessions: { complete: mocks.complete } } }))
vi.mock('../db', () => ({ db: {} }))
vi.mock('./taskTrashRepo', () => ({ taskTrashRepo: {} }))
vi.mock('../../shared/metrics/anonymousCounts', () => ({ recordFirstSuccessfulUse: mocks.count }))
import { tasksRepo } from './tasksRepo'
import { focusRepo } from './focusRepo'

describe('count meaningful use only after persistence succeeds', () => {
  beforeEach(() => vi.clearAllMocks())
  it('waits for a successful task save and never forwards its content', async () => {
    let resolve!: (value: unknown) => void
    mocks.add.mockReturnValue(new Promise(done => { resolve = done }))
    const result = tasksRepo.add({ title: 'Private task text', status: 'todo', priority: null })
    expect(mocks.count).not.toHaveBeenCalled()
    resolve({ id: 'private-id', title: 'Private task text' }); await result
    expect(mocks.count).toHaveBeenCalledExactlyOnceWith()
  })
  it('does not count a rejected local save', async () => {
    mocks.add.mockRejectedValue(new Error('disk full'))
    await expect(tasksRepo.add({ title: 'Private', status: 'todo', priority: null })).rejects.toThrow('disk full')
    expect(mocks.count).not.toHaveBeenCalled()
  })
  it('counts a persisted completed focus session but not missing or zero-time sessions', async () => {
    mocks.complete.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ status: 'completed', actualMinutes: 0 }).mockResolvedValueOnce({ status: 'completed', actualMinutes: 25 })
    await focusRepo.completeSession('missing'); await focusRepo.completeSession('zero'); expect(mocks.count).not.toHaveBeenCalled()
    await focusRepo.completeSession('private-session'); expect(mocks.count).toHaveBeenCalledExactlyOnceWith()
  })
})
