/**
 * Day notes (便签): a line pinned to a calendar day to remind you what happens
 * then. Not a task: no status, never in a task list. One JSON value in
 * localStorage, carried across devices inside the synced preferences
 * (syncedPreferencesRepo). No React.
 */

export type DayNote = {
  id: string
  /** The day it belongs to, as YYYY-MM-DD. */
  date: string
  text: string
  createdAt: number
  updatedAt: number
}

export type DayNotesState = {
  /** Oldest first within a day. */
  notes: DayNote[]
  /** Show today's notes on the dashboard. On unless switched off. */
  showOnDashboard: boolean
}

export const DAY_NOTES_STORAGE_KEY = 'focusgo.calendar.dayNotes.v1'
export const MAX_DAY_NOTE_LENGTH = 120
// Enough for years of notes while the synced preferences stay small.
export const MAX_DAY_NOTES = 1000

export const EMPTY_DAY_NOTES_STATE: DayNotesState = { notes: [], showOnDashboard: true }

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

/** A note as typed, made ready to keep: one line, trimmed, capped. */
export const cleanDayNote = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, MAX_DAY_NOTE_LENGTH)

export const normalizeDayNotesState = (raw: unknown): DayNotesState => {
  if (!isRecord(raw)) return EMPTY_DAY_NOTES_STATE
  const notes: DayNote[] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(raw.notes) ? raw.notes : []) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    if (typeof item.date !== 'string' || !DATE_KEY.test(item.date) || typeof item.text !== 'string') continue
    if (!isTime(item.createdAt)) continue
    const text = cleanDayNote(item.text)
    if (!text) continue
    seen.add(item.id)
    notes.push({ id: item.id, date: item.date, text, createdAt: item.createdAt, updatedAt: isTime(item.updatedAt) ? item.updatedAt : item.createdAt })
  }
  // Over the cap, the days furthest back go first.
  const kept =
    notes.length > MAX_DAY_NOTES
      ? [...notes].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1)).slice(-MAX_DAY_NOTES)
      : notes
  return { notes: kept, showOnDashboard: raw.showOnDashboard !== false }
}

export const readDayNotesState = (): DayNotesState => {
  if (typeof window === 'undefined') return EMPTY_DAY_NOTES_STATE
  try {
    const raw = window.localStorage.getItem(DAY_NOTES_STORAGE_KEY)
    return raw ? normalizeDayNotesState(JSON.parse(raw)) : EMPTY_DAY_NOTES_STATE
  } catch {
    return EMPTY_DAY_NOTES_STATE
  }
}

export const writeDayNotesState = (state: DayNotesState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DAY_NOTES_STORAGE_KEY, JSON.stringify(normalizeDayNotesState(state)))
  } catch {
    // Storage full or blocked: the change is not kept.
  }
}

/** How a day's fold is drawn: pencil ahead, the pen today, ink once gone. */
export type DayNoteTone = 'past' | 'today' | 'future'

export const dayNoteTone = (dateKey: string, todayKey: string): DayNoteTone =>
  dateKey === todayKey ? 'today' : dateKey < todayKey ? 'past' : 'future'

/** Notes grouped by day, each day oldest first. */
export const groupDayNotes = (notes: DayNote[]) => {
  const byDate = new Map<string, DayNote[]>()
  for (const note of notes) {
    const day = byDate.get(note.date)
    if (day) day.push(note)
    else byDate.set(note.date, [note])
  }
  for (const day of byDate.values()) day.sort((a, b) => a.createdAt - b.createdAt)
  return byDate
}
