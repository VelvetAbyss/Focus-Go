import { useSyncExternalStore } from 'react'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../../data/repositories/syncedPreferencesRepo'
import { EMPTY_QUOTE_STATE, QUOTE_STORAGE_KEY, readQuoteState, writeQuoteState, type QuoteState } from './quoteStorage'

// One store for the quote's library and your own lines, so a change shows at
// once, in other tabs, and after a sync (the same shape as the pay widgets').

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cachedState: QuoteState = EMPTY_QUOTE_STATE

const readRaw = () => {
  try {
    return window.localStorage.getItem(QUOTE_STORAGE_KEY)
  } catch {
    return null
  }
}

const getSnapshot = () => {
  const raw = readRaw()
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedState = readQuoteState()
  }
  return cachedState
}

const notify = () => listeners.forEach((listener) => listener())

const handleStorage = (event: StorageEvent) => {
  if (event.key === null || event.key === QUOTE_STORAGE_KEY) notify()
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

export const useQuoteState = () => useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_QUOTE_STATE)

export const updateQuoteState = (update: (current: QuoteState) => QuoteState) => {
  writeQuoteState(update(getSnapshot()))
  notify()
  void syncedPreferencesRepo.persistFromLocal()
}

export const newQuoteId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
