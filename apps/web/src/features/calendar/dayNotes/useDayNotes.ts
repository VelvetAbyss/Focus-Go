import { useMemo, useSyncExternalStore } from 'react'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../../data/repositories/syncedPreferencesRepo'
import {
  cleanDayNote,
  DAY_NOTES_STORAGE_KEY,
  EMPTY_DAY_NOTES_STATE,
  groupDayNotes,
  readDayNotesState,
  writeDayNotesState,
  type DayNote,
  type DayNotesState,
} from './dayNotesStorage'

// One store for the calendar and the dashboard, so a note shows at once in
// both, in other tabs, and after a sync (the same shape as the quotes').

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedState: DayNotesState = EMPTY_DAY_NOTES_STATE

const readRaw = () => {
  try {
    return window.localStorage.getItem(DAY_NOTES_STORAGE_KEY)
  } catch {
    return null
  }
}

const getSnapshot = () => {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = readDayNotesState()
  }
  return cachedState
}

const notify = () => listeners.forEach((listener) => listener())

const handleStorage = (event: StorageEvent) => {
  if (event.key === null || event.key === DAY_NOTES_STORAGE_KEY) notify()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    window.addEventListener('storage', handleStorage)
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, notify)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, notify)
    }
  }
}

export const useDayNotesState = () => useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_DAY_NOTES_STATE)

/** The state plus the notes grouped by day. */
export const useDayNotes = () => {
  const state = useDayNotesState()
  const byDate = useMemo(() => groupDayNotes(state.notes), [state.notes])
  return { ...state, byDate }
}

export const updateDayNotesState = (update: (current: DayNotesState) => DayNotesState) => {
  writeDayNotesState(update(getSnapshot()))
  notify()
  void syncedPreferencesRepo.persistFromLocal()
}

const newDayNoteId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Adds a note to a day; returns it, or null when the text is empty. */
export const addDayNote = (date: string, text: string): DayNote | null => {
  const clean = cleanDayNote(text)
  if (!clean) return null
  const now = Date.now()
  const note: DayNote = { id: newDayNoteId(), date, text: clean, createdAt: now, updatedAt: now }
  updateDayNotesState((current) => ({ ...current, notes: [...current.notes, note] }))
  return note
}

/** Rewrites a note; an emptied note is removed. */
export const editDayNote = (id: string, text: string) => {
  const clean = cleanDayNote(text)
  updateDayNotesState((current) => ({
    ...current,
    notes: clean
      ? current.notes.map((note) => (note.id === id && note.text !== clean ? { ...note, text: clean, updatedAt: Date.now() } : note))
      : current.notes.filter((note) => note.id !== id),
  }))
}

export const removeDayNote = (id: string) =>
  updateDayNotesState((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }))

/** Puts a removed note back where it was (undo). */
export const restoreDayNote = (note: DayNote) =>
  updateDayNotesState((current) =>
    current.notes.some((item) => item.id === note.id) ? current : { ...current, notes: [...current.notes, note] },
  )

export const setDayNotesOnDashboard = (showOnDashboard: boolean) =>
  updateDayNotesState((current) => ({ ...current, showOnDashboard }))
