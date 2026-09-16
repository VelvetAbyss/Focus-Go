import { TABLES } from '../db/schema'
import type { SyncEntityType } from './types'

export const SYNC_STATE_ID = 'cloud-sync' as const
export const SYNC_STATUS_CHANGED_EVENT = 'focusgo:sync-status-changed'
// Fired after a successful pull so every component can reload data from IndexedDB.
// detail: { topic: SyncDataUpdatedTopic | 'all' }  — 'all' means every sync entity was refreshed.
export const SYNC_DATA_UPDATED_EVENT = 'focusgo:sync-data-updated'

export type SyncDataUpdatedTopic = SyncEntityType | 'timelineItems'
export type SyncDataUpdatedDetail = { topic: SyncDataUpdatedTopic | 'all' }

export const dispatchSyncDataUpdated = (topic: SyncDataUpdatedTopic | 'all') => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<SyncDataUpdatedDetail>(SYNC_DATA_UPDATED_EVENT, { detail: { topic } }),
  )
}
export const SYNC_ENTITY_TABLES: Record<SyncEntityType, string> = {
  tasks: TABLES.tasks,
  notes: TABLES.notes,
  noteTags: TABLES.noteTags,
  noteAppearance: TABLES.noteAppearance,
  widgetTodos: TABLES.widgetTodos,
  focusSettings: TABLES.focusSettings,
  focusSessions: TABLES.focusSessions,
  diaryEntries: TABLES.diaryEntries,
  spends: TABLES.spends,
  spendCategories: TABLES.spendCategories,
  userSubscriptions: TABLES.userSubscriptions,
  featureInstallations: TABLES.featureInstallations,
  projects: TABLES.projects,
  projectPeople: TABLES.projectPeople,
  projectNoteLinks: TABLES.projectNoteLinks,
  taskNoteLinks: TABLES.taskNoteLinks,
  habits: TABLES.habits,
  habitLogs: TABLES.habitLogs,
  // Life feature tables
  books: TABLES.books,
  stocks: TABLES.stocks,
  media: TABLES.media,
  lifeSubscriptions: TABLES.lifeSubscriptions,
  lifePodcasts: TABLES.lifePodcasts,
  lifePeople: TABLES.lifePeople,
  trips: TABLES.trips,
  syncedPreferences: TABLES.syncedPreferences,
  domainEvents: TABLES.domainEvents,
  dashboardLayout: TABLES.dashboardLayout,
  lifeDashboardLayout: TABLES.lifeDashboardLayout,
}
