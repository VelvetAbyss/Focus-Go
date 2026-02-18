import { describe, expect, it, vi } from 'vitest'
import { resolveDatabaseService } from './dbService'

describe('resolveDatabaseService', () => {
  it('falls back to Dexie adapter when electron api is unavailable', () => {
    const service = resolveDatabaseService(undefined)
    expect(typeof service.tasks.list).toBe('function')
  })

  it('uses IPC adapter when electron api is available', async () => {
    const invokeDb = vi.fn().mockResolvedValue({ ok: true, data: [] })
    const service = resolveDatabaseService({ invokeDb })

    await service.tasks.list()

    expect(invokeDb).toHaveBeenCalledWith('db:tasks:list', {})
  })
})
