import { describe, expect, it } from 'vitest'
import { canAccessHabitTracker } from './accessRules'

describe('accessRules', () => {
  it('allows habits only when premium + installed', () => {
    expect(canAccessHabitTracker('free', 'installed')).toBe(false)
    expect(canAccessHabitTracker('premium', 'available')).toBe(false)
    expect(canAccessHabitTracker('premium', 'removed')).toBe(false)
    expect(canAccessHabitTracker('premium', 'installed')).toBe(true)
  })
})
