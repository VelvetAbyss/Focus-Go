import { describe, expect, it } from 'vitest'
import { getCurrentTodoResetBucket, shouldResetWidgetTodos } from './widgetTodoRefresh'

describe('widgetTodoRefresh', () => {
  it('uses the previous day bucket before local 04:00 for daily todos', () => {
    const now = new Date(2026, 2, 9, 3, 59, 59).getTime()

    expect(getCurrentTodoResetBucket('day', now)).toBe('2026-03-08')
  })

  it('uses the current day bucket at or after local 04:00 for daily todos', () => {
    const now = new Date(2026, 2, 9, 4, 0, 0).getTime()

    expect(getCurrentTodoResetBucket('day', now)).toBe('2026-03-09')
  })

  it('keeps weekly todos in the previous week before Monday 04:00', () => {
    const now = new Date(2026, 2, 9, 3, 59, 59).getTime()

    expect(getCurrentTodoResetBucket('week', now)).toBe('2026-W10')
  })

  it('switches weekly todos on Monday 04:00', () => {
    const now = new Date(2026, 2, 9, 4, 0, 0).getTime()

    expect(getCurrentTodoResetBucket('week', now)).toBe('2026-W11')
  })

  it('keeps monthly todos in the previous month before day 1 04:00', () => {
    const now = new Date(2026, 3, 1, 3, 59, 59).getTime()

    expect(getCurrentTodoResetBucket('month', now)).toBe('2026-03')
  })

  it('switches monthly todos on day 1 04:00', () => {
    const now = new Date(2026, 3, 1, 4, 0, 0).getTime()

    expect(getCurrentTodoResetBucket('month', now)).toBe('2026-04')
  })

  it('requests catch-up reset when stored bucket is stale', () => {
    const now = new Date(2026, 2, 12, 9, 0, 0).getTime()

    expect(shouldResetWidgetTodos('day', '2026-03-10', now)).toEqual({
      shouldReset: true,
      currentBucket: '2026-03-12',
    })
  })

  it('skips reset when stored bucket already matches the current one', () => {
    const now = new Date(2026, 2, 12, 9, 0, 0).getTime()

    expect(shouldResetWidgetTodos('day', '2026-03-12', now)).toEqual({
      shouldReset: false,
      currentBucket: '2026-03-12',
    })
  })
})
