import type { SyncEntityType } from './types'

export const SYNC_STATE_ID = 'cloud-sync' as const
export const SYNC_OUTBOX_CHANGED_EVENT = 'focusgo:sync-outbox-changed'
export const SYNC_STATUS_CHANGED_EVENT = 'focusgo:sync-status-changed'
export const SYNC_ENTITY_TABLES: Record<SyncEntityType, string> = {
  tasks: 'tasks',
  notes: 'notes',
  noteTags: 'noteTags',
  noteAppearance: 'noteAppearance',
  widgetTodos: 'widgetTodos',
  focusSettings: 'focusSettings',
  focusSessions: 'focusSessions',
  diaryEntries: 'diaryEntries',
  spends: 'spends',
  spendCategories: 'spendCategories',
  dashboardLayout: 'dashboardLayout',
  userSubscriptions: 'userSubscriptions',
  featureInstallations: 'featureInstallations',
  habits: 'habits',
  habitLogs: 'habitLogs',
}
