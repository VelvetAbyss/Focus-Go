import { describe, expect, it } from 'vitest'
import { buildNavWithConditionalRss, canAccessHabitTracker, canAccessRss } from './accessRules'

describe('accessRules', () => {
  it('hides rss when not premium or not installed', () => {
    expect(canAccessRss('free', 'installed')).toBe(false)
    expect(canAccessRss('premium', 'available')).toBe(false)
    expect(canAccessRss('premium', 'removed')).toBe(false)
  })

  it('allows rss only when premium + installed', () => {
    expect(canAccessRss('premium', 'installed')).toBe(true)
  })

  it('allows habits only when premium + installed', () => {
    expect(canAccessHabitTracker('free', 'installed')).toBe(false)
    expect(canAccessHabitTracker('premium', 'available')).toBe(false)
    expect(canAccessHabitTracker('premium', 'removed')).toBe(false)
    expect(canAccessHabitTracker('premium', 'installed')).toBe(true)
  })

  it('inserts rss right after dashboard when accessible', () => {
    const next = buildNavWithConditionalRss(['dashboard', 'tasks', 'settings'], true)
    expect(next).toEqual(['dashboard', 'rss', 'tasks', 'settings'])
  })

  it('keeps base nav unchanged when inaccessible', () => {
    const next = buildNavWithConditionalRss(['dashboard', 'tasks', 'settings'], false)
    expect(next).toEqual(['dashboard', 'tasks', 'settings'])
  })
})
