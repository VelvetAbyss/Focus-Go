import { describe, expect, it } from 'vitest'
import { formatClockMinutes, nextMorning } from './reminderSnooze'

describe('nextMorning', () => {
  it('snoozes a late-night reminder to tomorrow morning', () => {
    const { at, today } = nextMorning(new Date(2026, 9, 10, 23, 0))
    expect(at).toEqual(new Date(2026, 9, 11, 9, 0))
    expect(today).toBe(false)
  })

  it('snoozes an early-hours reminder to this morning', () => {
    const { at, today } = nextMorning(new Date(2026, 9, 11, 2, 30), 8 * 60 + 30)
    expect(at).toEqual(new Date(2026, 9, 11, 8, 30))
    expect(today).toBe(true)
  })

  it('crosses the month end', () => {
    expect(nextMorning(new Date(2026, 9, 31, 10, 0)).at).toEqual(new Date(2026, 10, 1, 9, 0))
  })
})

describe('formatClockMinutes', () => {
  it('pads hours and minutes', () => {
    expect(formatClockMinutes(9 * 60)).toBe('09:00')
    expect(formatClockMinutes(8 * 60 + 5)).toBe('08:05')
  })
})
