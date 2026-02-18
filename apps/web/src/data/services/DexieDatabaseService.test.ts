import { describe, expect, it } from 'vitest'
import type { IDatabaseService } from '@focus-go/core'
import { createDexieDatabaseService } from './DexieDatabaseService'

describe('DexieDatabaseService', () => {
  it('implements IDatabaseService contract surface', () => {
    const service: IDatabaseService = createDexieDatabaseService()
    expect(typeof service.tasks.list).toBe('function')
    expect(typeof service.widgetTodos.add).toBe('function')
    expect(typeof service.focus.upsert).toBe('function')
    expect(typeof service.diary.listTrash).toBe('function')
    expect(typeof service.spend.listCategories).toBe('function')
    expect(typeof service.dashboard.get).toBe('function')
  })
})
