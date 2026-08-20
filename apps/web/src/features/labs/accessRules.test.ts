import { describe, expect, it } from 'vitest'
import { canAccessHabitTracker } from './accessRules'

describe('accessRules', () => {
  it('requires only an installed habit feature', () => {
    expect(canAccessHabitTracker('free', 'installed')).toBe(true)
    expect(canAccessHabitTracker('premium', 'available')).toBe(false)
    expect(canAccessHabitTracker('premium', 'removed')).toBe(false)
    expect(canAccessHabitTracker('premium', 'installed')).toBe(true)
  })
})
