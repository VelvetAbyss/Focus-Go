import { describe, expect, it } from 'vitest'
import {
  buildInitialCalendarSubscriptions,
  getActiveSubscriptions,
  getDeletedSubscriptions,
  restoreSubscription,
  softRemoveSubscription,
  sortSubscriptions,
  updateSubscriptionColor,
} from './calendar.model'

describe('calendar.model', () => {
  it('keeps system subscriptions before custom subscriptions', () => {
    const subs = [
      { id: 'custom-us', sourceType: 'custom' as const, name: 'US Holidays (custom)', order: 1 },
      { id: 'system-cn', sourceType: 'system' as const, name: 'Chinese Lunar', order: 99 },
      { id: 'custom-lunar', sourceType: 'custom' as const, name: 'Lunar url', order: 0 },
      { id: 'system-us', sourceType: 'system' as const, name: 'US Holidays', order: 0 },
    ]

    const sorted = sortSubscriptions(subs)

    expect(sorted.map((item) => item.id)).toEqual(['system-us', 'system-cn', 'custom-lunar', 'custom-us'])
  })

  it('provides expected built-in subscriptions for M1', () => {
    const initial = buildInitialCalendarSubscriptions()

    const names = initial.map((item) => item.name)
    expect(names).toContain('Chinese Lunar Calendar')
    expect(names).toContain('US Holidays & Major Observances')

    const google = initial.find((item) => item.provider === 'google')
    expect(google?.syncPermission).toBe('read')
  })

  it('soft remove marks deletedAt and disables subscription', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]

    const next = softRemoveSubscription(initial, target.id)
    const removed = next.find((item) => item.id === target.id)

    expect(removed?.enabled).toBe(false)
    expect(typeof removed?.deletedAt).toBe('number')
  })

  it('restore clears deletedAt and enables subscription', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]
    const removed = softRemoveSubscription(initial, target.id)

    const restored = restoreSubscription(removed, target.id).find((item) => item.id === target.id)

    expect(restored?.deletedAt ?? null).toBe(null)
    expect(restored?.enabled).toBe(true)
  })

  it('active/deleted selectors return expected sets', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]
    const removed = softRemoveSubscription(initial, target.id)

    const activeIds = getActiveSubscriptions(removed).map((item) => item.id)
    const deletedIds = getDeletedSubscriptions(removed).map((item) => item.id)

    expect(activeIds).not.toContain(target.id)
    expect(deletedIds).toContain(target.id)
  })

  it('color update still works for active subscriptions', () => {
    const initial = buildInitialCalendarSubscriptions()
    const target = initial[0]

    const next = updateSubscriptionColor(initial, target.id, '#004d5a')

    expect(next.find((item) => item.id === target.id)?.color).toBe('#004d5a')
  })
})
