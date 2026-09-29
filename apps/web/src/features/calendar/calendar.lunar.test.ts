import { describe, expect, it } from 'vitest'
import { buildLunarEvents } from './calendar.lunar'

describe('buildLunarEvents', () => {
  it('labels each day like a printed calendar', () => {
    const events = buildLunarEvents(['2026-09-28', '2026-09-25', '2026-10-10', '2026-02-16'], 'lunar')
    expect(events.map((event) => event.title)).toEqual(['十八', '中秋节', '九月', '除夕'])
    expect(events.every((event) => event.kind === 'lunar' && event.subscriptionId === 'lunar')).toBe(true)
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length)
  })

  it('works for any year, with no feed behind it', () => {
    expect(buildLunarEvents(['2031-01-23'], 'lunar')[0].title).toBe('春节')
  })
})
