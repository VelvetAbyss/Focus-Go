import { db } from '../db'
import type { HangingNote, SyncedPreferences } from '../models/types'
import { normalizeHangingNotes, normalizeHangingAnchor } from '../models/hangingNotes'
import { enqueueSyncOperationInBackground, requestSyncHandoff } from '../sync/repository'
import {
  readDefaultCurrency,
  readDiaryFont,
  readFocusCompletionSoundEnabled,
  readLanguage,
  readNeteaseExperimentalPlaybackConfirmed,
  readNeteaseExperimentalPlaybackEnabled,
  readNumberAnimationsEnabled,
  readTaskReminderEnabled,
  readTaskReminderLeadMinutes,
  readUiAnimationsEnabled,
  readWeatherAutoLocation,
  readWeatherManualCity,
  readWeatherTemperatureUnit,
  readWorldClockItems,
  writeDefaultCurrency,
  writeDiaryFont,
  writeFocusCompletionSoundEnabled,
  writeLanguage,
  writeNeteaseExperimentalPlaybackConfirmed,
  writeNeteaseExperimentalPlaybackEnabled,
  writeNumberAnimationsEnabled,
  writeTaskReminderEnabled,
  writeTaskReminderLeadMinutes,
  writeUiAnimationsEnabled,
  writeWeatherAutoLocation,
  writeWeatherManualCity,
  writeWeatherTemperatureUnit,
  writeWorldClockItems,
} from '../../shared/prefs/preferences'
import { readStoredThemePreference, writeStoredThemePreference } from '../../shared/theme/theme'
import { readSidebarOrder, writeSidebarOrder } from '../../app/layout/sidebarOrder'
import { readLayoutLocked, writeLayoutLocked } from '../../shared/prefs/dashboardLayoutLock'
import { readStoredSubscriptions, writeStoredSubscriptions } from '../../features/calendar/calendarStorage'
import { readSalaryState, writeSalaryState } from '../../features/salary/salaryStorage'
import { readQuoteState, writeQuoteState } from '../../features/dashboard/quote/quoteStorage'
import { readDayNotesState, writeDayNotesState } from '../../features/calendar/dayNotes/dayNotesStorage'

export const SYNCED_PREFERENCES_ID = 'synced_preferences' as const
export const SYNCED_PREFERENCES_UPDATED_EVENT = 'focusgo:synced-preferences-updated'

const now = () => Date.now()

const emitUpdated = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(SYNCED_PREFERENCES_UPDATED_EVENT))
}

const buildLocalSnapshot = (): Omit<SyncedPreferences, 'createdAt' | 'updatedAt'> => ({
  id: SYNCED_PREFERENCES_ID,
  language: readLanguage(),
  uiAnimationsEnabled: readUiAnimationsEnabled(),
  numberAnimationsEnabled: readNumberAnimationsEnabled(),
  defaultCurrency: readDefaultCurrency(),
  weatherAutoLocationEnabled: readWeatherAutoLocation(),
  weatherManualCity: readWeatherManualCity(),
  weatherTemperatureUnit: readWeatherTemperatureUnit(),
  worldClockItems: readWorldClockItems(),
  focusCompletionSoundEnabled: readFocusCompletionSoundEnabled(),
  taskReminderEnabled: readTaskReminderEnabled(),
  taskReminderLeadMinutes: readTaskReminderLeadMinutes(),
  diaryFont: readDiaryFont(),
  neteaseExperimentalPlaybackEnabled: readNeteaseExperimentalPlaybackEnabled(),
  neteaseExperimentalPlaybackConfirmed: readNeteaseExperimentalPlaybackConfirmed(),
  sidebarOrder: readSidebarOrder(),
  themeSelection: readStoredThemePreference() ?? 'system',
  dashboardLayoutLocked: readLayoutLocked(),
  calendarSubscriptions: readStoredSubscriptions(),
  salary: readSalaryState(),
  quotes: readQuoteState(),
  calendarDayNotes: readDayNotesState(),
})

const applySnapshotToLocal = (snapshot: SyncedPreferences) => {
  writeLanguage(snapshot.language)
  writeUiAnimationsEnabled(snapshot.uiAnimationsEnabled)
  writeNumberAnimationsEnabled(snapshot.numberAnimationsEnabled)
  writeDefaultCurrency(snapshot.defaultCurrency)
  writeWeatherAutoLocation(snapshot.weatherAutoLocationEnabled)
  writeWeatherManualCity(snapshot.weatherManualCity)
  writeWeatherTemperatureUnit(snapshot.weatherTemperatureUnit)
  writeWorldClockItems(snapshot.worldClockItems)
  writeFocusCompletionSoundEnabled(snapshot.focusCompletionSoundEnabled)
  writeTaskReminderEnabled(snapshot.taskReminderEnabled)
  writeTaskReminderLeadMinutes(snapshot.taskReminderLeadMinutes)
  writeDiaryFont(snapshot.diaryFont)
  writeNeteaseExperimentalPlaybackEnabled(snapshot.neteaseExperimentalPlaybackEnabled)
  writeNeteaseExperimentalPlaybackConfirmed(snapshot.neteaseExperimentalPlaybackConfirmed)
  writeSidebarOrder(snapshot.sidebarOrder)
  writeStoredThemePreference(snapshot.themeSelection)
  writeLayoutLocked(snapshot.dashboardLayoutLocked)
  writeStoredSubscriptions(snapshot.calendarSubscriptions)
  // Older clients don't send it; keep what this device has.
  if (snapshot.salary) writeSalaryState(snapshot.salary)
  if (snapshot.quotes) writeQuoteState(snapshot.quotes)
  if (snapshot.calendarDayNotes) writeDayNotesState(snapshot.calendarDayNotes)
}

export const syncedPreferencesRepo = {
  async get() {
    return (await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)) ?? null
  },
  async persistFromLocal() {
    const next = await db.transaction('rw', db.syncedPreferences, async () => {
      const existing = await this.get()
      const snapshot = buildLocalSnapshot()
      const timestamp = now()
      const next: SyncedPreferences = existing
        ? {
            ...existing,
            ...snapshot,
            updatedAt: timestamp,
          }
        : {
            ...snapshot,
            createdAt: timestamp,
            updatedAt: timestamp,
      }
      await db.syncedPreferences.put(next)
      return next
    })
    enqueueSyncOperationInBackground('syncedPreferences', 'upsert', next)
    return next
  },
  /** Merge just this edit into the latest record; unrelated preferences/sheets survive. */
  async saveHangingNotes(notes: HangingNote[], previous: HangingNote[], isCurrentAccount = () => true, anchor?: { next?: number; previous?: number }) {
    const next = await db.transaction('rw', db.syncedPreferences, async () => {
      if (!isCurrentAccount()) throw new Error('Account changed')
      const existing = await this.get()
      if (!isCurrentAccount()) throw new Error('Account changed')
      const before = new Map(previous.map(note => [note.id, note]))
      const after = new Map(notes.map(note => [note.id, note]))
      const changed = notes.filter(note => JSON.stringify(note) !== JSON.stringify(before.get(note.id)))
      const removed = new Set(previous.filter(note => !after.has(note.id)).map(note => note.id))
      const updates = new Map(changed.map(note => [note.id, note]))
      const current = normalizeHangingNotes(existing?.hangingNotes)
      const currentIds = new Set(current.map(note => note.id))
      const hangingNotes = [...current.filter(note => !removed.has(note.id)).map(note => updates.get(note.id) ?? note), ...changed.filter(note => !currentIds.has(note.id))]
      const timestamp = now()
      const record: SyncedPreferences = { ...(existing ?? { ...buildLocalSnapshot(), createdAt: timestamp }), hangingNotes, updatedAt: timestamp }
      if (anchor && normalizeHangingAnchor(anchor.next) !== normalizeHangingAnchor(anchor.previous)) {
        record.hangingNotesAnchor = normalizeHangingAnchor(anchor.next)
      }
      await db.syncedPreferences.put(record)
      return record
    })
    requestSyncHandoff()
    return next
  },
  async hydrateLocalFromDb() {
    const stored = await this.get()
    if (!stored) return false
    const before = JSON.stringify(buildLocalSnapshot())
    applySnapshotToLocal(stored)
    const after = JSON.stringify(buildLocalSnapshot())
    if (before === after) return false
    emitUpdated()
    return true
  },
  async getInitialSeedCompletedAt() {
    const stored = await this.get()
    return stored?.initialSeedCompletedAt ?? null
  },
  async markInitialSeedCompleted(timestamp = now()) {
    const next = await db.transaction('rw', db.syncedPreferences, async () => {
      const existing = await this.get()
      if (existing?.initialSeedCompletedAt) return existing
      const next: SyncedPreferences = existing
        ? {
            ...existing,
            initialSeedCompletedAt: timestamp,
            updatedAt: timestamp,
          }
        : {
            ...buildLocalSnapshot(),
            initialSeedCompletedAt: timestamp,
            createdAt: timestamp,
            updatedAt: timestamp,
      }
      await db.syncedPreferences.put(next)
      return next
    })
    enqueueSyncOperationInBackground('syncedPreferences', 'upsert', next)
    return next
  },
}
