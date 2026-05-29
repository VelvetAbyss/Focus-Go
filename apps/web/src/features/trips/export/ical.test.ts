import { describe, expect, it } from 'vitest'
import { buildTripIcs } from './ical'
import type { TripRecord } from '../../../data/models/types'

const baseTrip = (overrides: Partial<TripRecord> = {}): TripRecord => ({
  id: 'trip1',
  createdAt: 0,
  updatedAt: 0,
  title: 'Tokyo, Spring',
  destination: 'Tokyo, Japan',
  startDate: '2026-04-01',
  endDate: '2026-04-03',
  status: 'Planning',
  travelers: 2,
  budgetPlanned: 0,
  budgetCurrency: 'USD',
  heroImage: '',
  coverEmoji: '🗾',
  itinerary: [],
  transport: [],
  stays: [],
  food: [],
  budget: [],
  checklist: [],
  notes: '',
  ...overrides,
})

describe('buildTripIcs', () => {
  it('wraps events in a VCALENDAR envelope', () => {
    const ics = buildTripIcs(baseTrip())
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('PRODID:-//Focus&Go//Trip Planner//EN')
  })

  it('emits a timed VEVENT for an activity with start/end times', () => {
    const ics = buildTripIcs(
      baseTrip({
        itinerary: [
          {
            day: 1,
            date: '2026-04-01',
            label: 'Day 1',
            items: [
              { id: 'a1', title: 'teamLab', time: '', location: 'Toyosu', type: 'spot', startTime: '10:00', endTime: '12:30' },
            ],
          },
        ],
      }),
    )
    expect(ics).toContain('DTSTART:20260401T100000')
    expect(ics).toContain('DTEND:20260401T123000')
    expect(ics).toContain('SUMMARY:teamLab')
    expect(ics).toContain('LOCATION:Toyosu')
  })

  it('emits an all-day VEVENT when no times are present', () => {
    const ics = buildTripIcs(
      baseTrip({
        itinerary: [
          {
            day: 1,
            date: '2026-04-01',
            label: 'Day 1',
            items: [{ id: 'a1', title: 'Free day', time: '', location: '', type: 'spot' }],
          },
        ],
      }),
    )
    expect(ics).toContain('DTSTART;VALUE=DATE:20260401')
    // all-day DTEND is exclusive → next day
    expect(ics).toContain('DTEND;VALUE=DATE:20260402')
  })

  it('escapes commas and semicolons in summary/description', () => {
    const ics = buildTripIcs(
      baseTrip({
        itinerary: [
          {
            day: 1,
            date: '2026-04-01',
            label: 'Day 1',
            items: [{ id: 'a1', title: 'Lunch, then museum; relax', time: '', location: '', type: 'food', notes: 'a, b; c' }],
          },
        ],
      }),
    )
    expect(ics).toContain('SUMMARY:Lunch\\, then museum\\; relax')
    expect(ics).toContain('DESCRIPTION:a\\, b\\; c')
  })

  it('spans a stay across check-in/check-out as an all-day range', () => {
    const ics = buildTripIcs(
      baseTrip({
        stays: [
          {
            id: 's1',
            name: 'Park Hotel',
            address: 'Shiodome',
            checkIn: '2026-04-01',
            checkOut: '2026-04-03',
            nights: 2,
            status: 'Confirmed',
            cost: 0,
            currency: 'JPY',
          },
        ],
      }),
    )
    expect(ics).toContain('SUMMARY:Stay: Park Hotel')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260401')
    expect(ics).toContain('DTEND;VALUE=DATE:20260403')
  })

  it('builds a transport VEVENT with method and route', () => {
    const ics = buildTripIcs(
      baseTrip({
        transport: [
          {
            id: 't1',
            category: 'intercity',
            method: 'Flight',
            from: 'SFO',
            to: 'HND',
            departTime: '13:00',
            arriveTime: '16:30',
            date: '2026-04-01',
            status: 'Confirmed',
            cost: 0,
            currency: 'USD',
          },
        ],
      }),
    )
    expect(ics).toContain('SUMMARY:Flight: SFO → HND')
    expect(ics).toContain('DTSTART:20260401T130000')
    expect(ics).toContain('DTEND:20260401T163000')
  })

  it('skips items without a date', () => {
    const ics = buildTripIcs(
      baseTrip({
        itinerary: [
          { day: 1, date: '', label: 'Day 1', items: [{ id: 'a1', title: 'Floating', time: '', location: '', type: 'spot' }] },
        ],
      }),
    )
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
