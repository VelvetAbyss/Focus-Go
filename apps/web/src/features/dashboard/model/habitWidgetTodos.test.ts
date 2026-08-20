import { describe, expect, it } from 'vitest'
import type { Habit } from '../../../data/models/types'
import { buildHabitWidgetTodos } from './habitWidgetTodos'

const makeHabit = (overrides: Partial<Habit> = {}): Habit => ({
  id: 'habit-1',
  userId: 'local-user',
  title: 'Drink water',
  description: '',
  icon: '💧',
  type: 'boolean',
  color: '#7edbc7',
  archived: false,
  freezesAllowed: 0,
  sortOrder: 0,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
})

describe('buildHabitWidgetTodos', () => {
  it('builds daily widget rows from active habits and current completion dates', () => {
    const rows = buildHabitWidgetTodos({
      scope: 'day',
      habits: [
        makeHabit({ id: 'habit-1', title: 'Drink water', sortOrder: 2 }),
        makeHabit({ id: 'habit-2', title: 'Read 10 pages', sortOrder: 1, createdAt: 2, updatedAt: 2 }),
      ],
      completedDatesByHabit: {
        'habit-1': ['2026-03-19'],
        'habit-2': [],
      },
      today: '2026-03-19',
    })

    expect(rows).toEqual([
      expect.objectContaining({ id: 'habit-2', title: 'Read 10 pages', done: false, scope: 'day' }),
      expect.objectContaining({ id: 'habit-1', title: 'Drink water', done: true, scope: 'day' }),
    ])
  })
})
