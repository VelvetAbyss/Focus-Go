import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDexieDatabaseService } from './DexieDatabaseService'
import { db } from '../db'

describe('DexieDatabaseService widget todo reset', () => {
  beforeEach(async () => {
    await db.widgetTodos.clear()
  })

  it('resets only done flags within the requested scope without changing updatedAt', async () => {
    const service = createDexieDatabaseService()
    const dayDone = await service.widgetTodos.add({ scope: 'day', title: 'Daily', priority: 'medium', done: true })
    const dayOpen = await service.widgetTodos.add({ scope: 'day', title: 'Daily open', priority: 'medium', done: false })
    const weekDone = await service.widgetTodos.add({ scope: 'week', title: 'Weekly', priority: 'medium', done: true })

    const reset = await service.widgetTodos.resetDone('day')

    expect(reset).toHaveLength(1)
    expect(reset[0]).toMatchObject({ id: dayDone.id, done: false, updatedAt: dayDone.updatedAt })

    const storedDayDone = await db.widgetTodos.get(dayDone.id)
    const storedDayOpen = await db.widgetTodos.get(dayOpen.id)
    const storedWeekDone = await db.widgetTodos.get(weekDone.id)

    expect(storedDayDone).toMatchObject({ done: false, updatedAt: dayDone.updatedAt, createdAt: dayDone.createdAt })
    expect(storedDayOpen).toMatchObject({ done: false, updatedAt: dayOpen.updatedAt })
    expect(storedWeekDone).toMatchObject({ done: true, updatedAt: weekDone.updatedAt })
  })
})
