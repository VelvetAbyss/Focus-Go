import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ add: vi.fn(), play: vi.fn() }))
vi.mock('../../../data/repositories/tasksRepo', () => ({ tasksRepo: { add: mocks.add } }))
vi.mock('../../../data/repositories/projectsRepo', () => ({ projectsRepo: { list: vi.fn() } }))
vi.mock('../../../shared/sound/interactionSounds', () => ({ playInteractionSound: mocks.play }))
import { createTask } from './taskActions'

beforeEach(() => vi.clearAllMocks())
describe('task creation feedback', () => {
  it('returns the saved task and sounds only after local persistence succeeds', async () => {
    let resolve!: (task: object) => void
    mocks.add.mockReturnValue(new Promise((done) => { resolve = done }))
    const result = createTask({ title: 'A small step' })
    expect(mocks.play).not.toHaveBeenCalled()
    resolve({ id: 'local', title: 'A small step' })
    await expect(result).resolves.toMatchObject({ id: 'local' })
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith('create')
  })
  it('keeps failed writes silent', async () => {
    mocks.add.mockRejectedValue(new Error('storage unavailable'))
    await expect(createTask({ title: 'Retry later' })).rejects.toThrow('storage unavailable')
    expect(mocks.play).not.toHaveBeenCalled()
  })
})
