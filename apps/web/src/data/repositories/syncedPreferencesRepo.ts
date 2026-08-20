import { db } from '../db'
import type { SyncedPreferences } from '../models/types'
import { enqueueSyncOperationInBackground } from '../sync/repository'
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
}

export const syncedPreferencesRepo = {
  async get() {
    return (await db.syncedPreferences.get(SYNCED_PREFERENCES_ID)) ?? null
  },
  async persistFromLocal() {
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
    enqueueSyncOperationInBackground('syncedPreferences', 'upsert', next)
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
    enqueueSyncOperationInBackground('syncedPreferences', 'upsert', next)
    return next
  },
}
