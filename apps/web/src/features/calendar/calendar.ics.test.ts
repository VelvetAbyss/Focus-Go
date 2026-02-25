import { describe, expect, it, vi } from 'vitest'
import { fetchIcsEventsWithFallback, parseIcsEvents } from './calendar.ics'

const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:holiday-1
DTSTART;VALUE=DATE:20260210
SUMMARY:春节
END:VEVENT
BEGIN:VEVENT
UID:lunar-1
DTSTART;VALUE=DATE:20260211
SUMMARY:农历 正月初四
END:VEVENT
END:VCALENDAR`

describe('calendar.ics', () => {
  it('parses vevents and keeps lunar title as month/day only', () => {
    const events = parseIcsEvents(sampleIcs, 'system-cn-lunar')

    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ dateKey: '2026-02-10' })
    expect(events[1]).toMatchObject({ kind: 'lunar', title: '正月初四' })
  })

  it('falls back to proxy fetch when direct fetch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce({ ok: true, text: async () => sampleIcs })

    const events = await fetchIcsEventsWithFallback(
      'https://www.shuyz.com/githubfiles/china-holiday-calender/master/holidayCal.ics',
      'custom-1',
      fetchMock as unknown as typeof fetch
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(events.length).toBeGreaterThan(0)
  })

  it('throws when parsed events are empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => 'BEGIN:VCALENDAR\nEND:VCALENDAR' })

    await expect(
      fetchIcsEventsWithFallback('https://example.com/empty.ics', 'custom-2', fetchMock as unknown as typeof fetch)
    ).rejects.toThrow('No events found in ICS feed')
  })
})
