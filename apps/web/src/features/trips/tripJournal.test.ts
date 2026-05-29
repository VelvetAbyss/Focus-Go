import { describe, expect, it } from 'vitest'
import type { TripItineraryDay, TripJournalEntry, TripRecord } from '../../data/models/types'
import { dayJournalKey, journalEntryFor, journaledDayCount, upsertJournalEntry } from './tripJournal'

const makeDay = (over: Partial<TripItineraryDay> = {}): TripItineraryDay =>
  ({ day: 1, date: '2026-01-01', label: 'Day 1', items: [], ...over })

const makeTrip = (journal?: TripJournalEntry[]): TripRecord =>
  ({ id: 't1', journal } as TripRecord)

describe('dayJournalKey', () => {
  it('uses the trimmed date when present', () => {
    expect(dayJournalKey(makeDay({ date: ' 2026-03-04 ' }))).toBe('2026-03-04')
  })
  it('falls back to the ordinal when date is empty', () => {
    expect(dayJournalKey(makeDay({ date: '', day: 3 }))).toBe('#day-3')
  })
})

describe('upsertJournalEntry', () => {
  it('creates a new entry when none exists', () => {
    const next = upsertJournalEntry(undefined, '2026-01-01', { body: 'Lovely day' })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ date: '2026-01-01', body: 'Lovely day' })
    expect(next[0].id).toBeTruthy()
  })

  it('updates an existing entry in place by key', () => {
    const existing: TripJournalEntry[] = [{ id: 'a', date: '2026-01-01', body: 'old' }]
    const next = upsertJournalEntry(existing, '2026-01-01', { body: 'new', mood: '🌞' })
    expect(next).toHaveLength(1)
    expect(next[0]).toMatchObject({ id: 'a', body: 'new', mood: '🌞' })
  })

  it('does not mutate the input array', () => {
    const existing: TripJournalEntry[] = [{ id: 'a', date: '2026-01-01', body: 'old' }]
    upsertJournalEntry(existing, '2026-01-01', { body: 'new' })
    expect(existing[0].body).toBe('old')
  })
})

describe('journalEntryFor / journaledDayCount', () => {
  it('finds an entry by key', () => {
    const trip = makeTrip([{ id: 'a', date: 'k', body: 'hi' }])
    expect(journalEntryFor(trip, 'k')?.body).toBe('hi')
    expect(journalEntryFor(trip, 'missing')).toBeUndefined()
  })
  it('counts only entries with non-empty bodies', () => {
    const trip = makeTrip([
      { id: 'a', date: 'k1', body: 'written' },
      { id: 'b', date: 'k2', body: '   ' },
      { id: 'c', date: 'k3', body: '' },
    ])
    expect(journaledDayCount(trip)).toBe(1)
  })
})
