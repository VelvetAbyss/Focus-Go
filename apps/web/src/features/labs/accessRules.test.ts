import { describe, expect, it } from 'vitest'
import { canAccessHabitTracker } from './accessRules'

describe('accessRules', () => {
  it('temporarily allows habits when premium is open or feature is installed', () => {
    expect(canAccessHabitTracker('free', 'installed')).toBe(true)
    expect(canAccessHabitTracker('premium', 'available')).toBe(true)
    expect(canAccessHabitTracker('premium', 'removed')).toBe(true)
    expect(canAccessHabitTracker('premium', 'installed')).toBe(true)
  })
})
