import { useSyncExternalStore } from 'react'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'
import { EMPTY_SALARY_STATE, readSalaryState, SALARY_STORAGE_KEY, writeSalaryState, type SalaryState } from './salaryStorage'

// One store for the three pay widgets, so a change in one (new settings, a
// break started) shows in the others at once, in other tabs, and after a sync.

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedState: SalaryState = EMPTY_SALARY_STATE

const readRaw = () => {
  try {
    return window.localStorage.getItem(SALARY_STORAGE_KEY)
  } catch {
    return null
  }
}

const getSnapshot = () => {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = readSalaryState()
  }
  return cachedState
}

const notify = () => listeners.forEach((listener) => listener())

const handleStorage = (event: StorageEvent) => {
  if (event.key === null || event.key === SALARY_STORAGE_KEY) notify()
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

export const useSalaryState = () => useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SALARY_STATE)

export const updateSalaryState = (update: (current: SalaryState) => SalaryState) => {
  writeSalaryState(update(getSnapshot()))
  notify()
  void syncedPreferencesRepo.persistFromLocal()
}

export const newSalaryId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Shorter than this a "break" was a mis-click; it isn't kept. */
export const MIN_BREAK_MS = 5_000

/** Starts a break now, unless one is running. */
export const startBreak = (at = Date.now()) =>
  updateSalaryState((current) => (current.activeBreakStartAt ? current : { ...current, activeBreakStartAt: at }))

/** Ends the running break and keeps it, unless it was a mis-click. */
export const stopBreak = (at = Date.now()) =>
  updateSalaryState((current) => {
    const startAt = current.activeBreakStartAt
    if (!startAt) return current
    const kept = at - startAt >= MIN_BREAK_MS
    return {
      ...current,
      activeBreakStartAt: null,
      breaks: kept ? [...current.breaks, { id: newSalaryId(), startAt, endAt: at }] : current.breaks,
    }
  })
