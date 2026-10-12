import { describe, expect, it } from 'vitest'
import { buildOverrides } from './cnHolidays'

describe('buildOverrides', () => {
  it('marks feed days off and makeup days worked, a makeup day winning', () => {
    expect(buildOverrides(['2026-10-01', '2026-10-02'], ['2026-10-10', '2026-10-02'])).toEqual({
      '2026-10-01': 'off',
      '2026-10-02': 'work',
      '2026-10-10': 'work',
    })
  })
})
