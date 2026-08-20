import { describe, expect, it } from 'vitest'
import type { TripRecord } from '../../data/models/types'
import { budgetBreakdown, splitBudget, tripDays } from './budgetInsights'

const makeTrip = (over: Partial<TripRecord> = {}): TripRecord =>
  ({
    id: 't1',
    title: 'Trip',
    destination: '',
    startDate: '2026-01-01',
    endDate: '2026-01-05',
    status: 'Planning',
    travelers: 2,
    budgetPlanned: 0,
    budgetCurrency: 'USD',
    heroImage: '',
    coverEmoji: '✈️',
    itinerary: [],
    transport: [],
    stays: [],
    food: [],
    budget: [],
    checklist: [],
    notes: '',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as TripRecord

describe('budgetBreakdown', () => {
  it('returns zeroed breakdown for an empty budget', () => {
    const b = budgetBreakdown(makeTrip())
    expect(b).toMatchObject({ planned: 0, actual: 0, remaining: 0, percent: 0, overrun: false })
    expect(b.slices).toHaveLength(0)
  })

  it('aggregates totals, percent, and remaining', () => {
    const trip = makeTrip({
      budget: [
        { id: 'a', label: 'Flights', emoji: '✈️', planned: 600, actual: 650 },
        { id: 'b', label: 'Food', emoji: '🍜', planned: 400, actual: 100 },
      ],
    })
    const b = budgetBreakdown(trip)
    expect(b.planned).toBe(1000)
    expect(b.actual).toBe(750)
    expect(b.remaining).toBe(250)
    expect(b.percent).toBe(75)
    expect(b.overrun).toBe(false)
  })

  it('flags overrun when actual exceeds planned', () => {
    const trip = makeTrip({ budget: [{ id: 'a', label: 'X', emoji: '💸', planned: 100, actual: 140 }] })
    const b = budgetBreakdown(trip)
    expect(b.overrun).toBe(true)
    expect(b.percent).toBe(140)
  })

  it('sorts slices by planned desc and computes share', () => {
    const trip = makeTrip({
      budget: [
        { id: 'a', label: 'Small', emoji: '💸', planned: 250, actual: 0 },
        { id: 'b', label: 'Big', emoji: '💸', planned: 750, actual: 0 },
      ],
    })
    const b = budgetBreakdown(trip)
    expect(b.slices.map((s) => s.label)).toEqual(['Big', 'Small'])
    expect(b.slices[0].share).toBeCloseTo(0.75)
    expect(b.slices[1].share).toBeCloseTo(0.25)
  })

  it('omits zero-value categories from slices', () => {
    const trip = makeTrip({
      budget: [
        { id: 'a', label: 'Used', emoji: '💸', planned: 100, actual: 0 },
        { id: 'b', label: 'Empty', emoji: '💸', planned: 0, actual: 0 },
      ],
    })
    expect(budgetBreakdown(trip).slices).toHaveLength(1)
  })
})

describe('splitBudget', () => {
  it('returns the value unchanged for total', () => {
    expect(splitBudget(1000, 'total', 4, 5)).toBe(1000)
  })
  it('divides by travelers for perPerson', () => {
    expect(splitBudget(1000, 'perPerson', 4, 5)).toBe(250)
  })
  it('divides by days for perDay', () => {
    expect(splitBudget(1000, 'perDay', 4, 5)).toBe(200)
  })
  it('guards against zero divisors', () => {
    expect(splitBudget(1000, 'perPerson', 0, 0)).toBe(1000)
    expect(splitBudget(1000, 'perDay', 0, 0)).toBe(1000)
  })
})

describe('tripDays', () => {
  it('is at least 1', () => {
    expect(tripDays(makeTrip())).toBe(1)
  })
  it('counts itinerary days', () => {
    const trip = makeTrip({ itinerary: [{ day: 1, date: '', label: '', items: [] }, { day: 2, date: '', label: '', items: [] }] })
    expect(tripDays(trip)).toBe(2)
  })
})
