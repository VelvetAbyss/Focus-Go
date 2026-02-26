import { describe, expect, it, vi } from 'vitest'
import { parseDateKey, shiftDateKey, toDateKey, todayDateKey } from './dateKey'

describe('dateKey helpers', () => {
  it('formats and parses local date key', () => {
    const date = new Date(2026, 1, 26)
    expect(toDateKey(date)).toBe('2026-02-26')
    expect(parseDateKey('2026-02-26').getDate()).toBe(26)
  })

  it('shifts date keys by days', () => {
    expect(shiftDateKey('2026-02-26', -1)).toBe('2026-02-25')
    expect(shiftDateKey('2026-02-26', 2)).toBe('2026-02-28')
  })

  it('uses local midnight day for today key', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 1, 26, 23, 30, 0))
    expect(todayDateKey()).toBe('2026-02-26')
    vi.useRealTimers()
  })
})
