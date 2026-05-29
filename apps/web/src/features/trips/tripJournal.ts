import type { TripItineraryDay, TripJournalEntry, TripRecord } from '../../data/models/types'
import { createId } from '../../shared/utils/ids'

/**
 * Stable key used to attach a journal reflection to an itinerary day. Days
 * usually carry a date; when one is missing we fall back to its ordinal so the
 * entry still binds to a single day.
 */
export const dayJournalKey = (day: TripItineraryDay): string =>
  day.date?.trim() ? day.date.trim() : `#day-${day.day}`

/** Find the journal entry bound to a given key, if any. */
export const journalEntryFor = (trip: TripRecord, key: string): TripJournalEntry | undefined =>
  trip.journal?.find((entry) => entry.date === key)

/**
 * Insert or update the journal entry for a key. Pure: returns a new array and
 * never mutates the input. A new entry is created when none exists.
 */
export const upsertJournalEntry = (
  journal: TripJournalEntry[] | undefined,
  key: string,
  patch: Partial<Pick<TripJournalEntry, 'body' | 'mood' | 'photoIds'>>,
): TripJournalEntry[] => {
  const list = journal ?? []
  const idx = list.findIndex((entry) => entry.date === key)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = { ...next[idx], ...patch }
    return next
  }
  return [...list, { id: createId(), date: key, body: '', ...patch }]
}

/** Count of days that have a non-empty reflection. */
export const journaledDayCount = (trip: TripRecord): number =>
  (trip.journal ?? []).filter((entry) => entry.body.trim().length > 0).length
