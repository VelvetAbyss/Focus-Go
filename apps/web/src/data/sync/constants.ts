import { TABLES } from '../db/schema'
import type { SyncEntityType } from './types'

export const SYNC_STATE_ID = 'cloud-sync' as const
export const SYNC_OUTBOX_CHANGED_EVENT = 'focusgo:sync-outbox-changed'
export const SYNC_STATUS_CHANGED_EVENT = 'focusgo:sync-status-changed'
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
  dashboardLayout: TABLES.dashboardLayout,
  userSubscriptions: TABLES.userSubscriptions,
  featureInstallations: TABLES.featureInstallations,
  habits: TABLES.habits,
  habitLogs: TABLES.habitLogs,
}
