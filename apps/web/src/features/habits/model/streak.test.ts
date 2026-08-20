import { describe, expect, it } from 'vitest'
import { calculateStreak } from './streak'

describe('calculateStreak', () => {
  it('returns perfect consecutive streak', () => {
    const logs = [
      { dateKey: '2026-02-24', status: 'completed' as const },
      { dateKey: '2026-02-25', status: 'completed' as const },
      { dateKey: '2026-02-26', status: 'completed' as const },
    ]

    expect(calculateStreak(logs, '2026-02-26', 1)).toBe(3)
  })

  it('returns zero when day is broken without freeze', () => {
    const logs = [{ dateKey: '2026-02-24', status: 'completed' as const }]
    expect(calculateStreak(logs, '2026-02-26', 0)).toBe(0)
  })

  it('keeps streak when a freeze is available', () => {
    const logs = [
      { dateKey: '2026-02-24', status: 'completed' as const },
      { dateKey: '2026-02-26', status: 'completed' as const },
    ]

    expect(calculateStreak(logs, '2026-02-26', 1)).toBe(3)
  })
})
