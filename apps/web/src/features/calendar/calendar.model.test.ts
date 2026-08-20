import { describe, expect, it } from 'vitest'
import {
  buildInitialCalendarSubscriptions,
  type CalendarSubscription,
  removeAllSystemSubscriptions,
  removeSubscriptionHard,
  reorderSubscriptions,
  sortSubscriptions,
  updateSubscriptionColor,
} from './calendar.model'

describe('calendar.model', () => {
  it('sorts by order before source fallback', () => {
    const subs = [
      { id: 'custom-us', sourceType: 'custom' as const, name: 'US Holidays (custom)', order: 3 },
      { id: 'system-cn', sourceType: 'system' as const, name: 'Chinese Lunar', order: 0 },
      { id: 'custom-lunar', sourceType: 'custom' as const, name: 'Lunar url', order: 1 },
      { id: 'system-us', sourceType: 'system' as const, name: 'US Holidays', order: 2 },
    ]

    const sorted = sortSubscriptions(subs)

    expect(sorted.map((item) => item.id)).toEqual(['system-cn', 'custom-lunar', 'system-us', 'custom-us'])
  })

  it('provides expected built-in subscriptions without system defaults', () => {
    const initial = buildInitialCalendarSubscriptions()

    const names = initial.map((item) => item.name)
    expect(names).not.toContain('Chinese Lunar Calendar')
    expect(names).not.toContain('US Holidays & Major Observances')

    const google = initial.find((item) => item.provider === 'google')
    expect(google?.syncPermission).toBe('read')
  })

  it('removeAllSystemSubscriptions filters all system records', () => {
    const subs: CalendarSubscription[] = [
      {
        id: 'system-cn',
        sourceType: 'system',
        name: 'Chinese Lunar',
        order: 0,
        provider: 'builtin',
        color: '#94a3b8',
        enabled: true,
        syncPermission: 'read',
      },
      {
        id: 'account-google',
        sourceType: 'account',
        name: 'Google',
        order: 1,
        provider: 'google',
        color: '#2563eb',
        enabled: true,
        syncPermission: 'read',
      },
      {
        id: 'custom-holiday',
        sourceType: 'custom',
        name: 'Holiday',
        order: 2,
        provider: 'ics',
        color: '#0ea5e9',
        enabled: true,
        syncPermission: 'read',
      },
      {
        id: 'system-us',
        sourceType: 'system',
        name: 'US Holidays',
        order: 3,
        provider: 'builtin',
        color: '#60a5fa',
        enabled: true,
        syncPermission: 'read',
      },
    ]

    const next = removeAllSystemSubscriptions(subs)
    expect(next.map((item) => item.id)).toEqual(['account-google', 'custom-holiday'])
  })

  it('removeSubscriptionHard removes target id', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]

    const next = removeSubscriptionHard(initial, target.id)
    expect(next.find((item) => item.id === target.id)).toBeUndefined()
  })

  it('reorderSubscriptions rewrites order deterministically', () => {
    const subs: CalendarSubscription[] = [
      {
        id: 'a',
        sourceType: 'account',
        name: 'Google',
        order: 0,
        provider: 'google',
        color: '#2563eb',
        enabled: true,
        syncPermission: 'read',
      },
      {
        id: 'b',
        sourceType: 'custom',
        name: 'Holiday',
        order: 1,
        provider: 'ics',
        color: '#0ea5e9',
        enabled: true,
        syncPermission: 'read',
      },
      {
        id: 'c',
        sourceType: 'custom',
        name: 'Lunar',
        order: 2,
        provider: 'ics',
        color: '#10b981',
        enabled: true,
        syncPermission: 'read',
      },
    ]

    const reordered = reorderSubscriptions(subs, ['c', 'a', 'b'])

    expect(reordered.map((item) => item.id)).toEqual(['c', 'a', 'b'])
    expect(reordered.map((item) => item.order)).toEqual([0, 1, 2])
  })

  it('color update still works for active subscriptions', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]

    const next = updateSubscriptionColor(initial, target.id, '#004d5a')

    expect(next.find((item) => item.id === target.id)?.color).toBe('#004d5a')
  })
})
