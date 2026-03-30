import type {
  DashboardLayout,
  DiaryEntry,
  FeatureInstallation,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  NoteAppearanceSettings,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  TaskItem,
  UserSubscription,
  WidgetTodo,
} from '../models/types'

export const SYNC_ENTITY_TYPES = [
  'tasks',
  'notes',
  'noteTags',
  'noteAppearance',
  'widgetTodos',
  'focusSettings',
  'focusSessions',
  'diaryEntries',
  'spends',
  'spendCategories',
  'dashboardLayout',
  'userSubscriptions',
  'featureInstallations',
  'habits',
  'habitLogs',
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]
export type SyncOp = 'upsert' | 'delete'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'blocked'
export type FirstSyncChoice = 'upload-local' | 'pull-remote'

export type SyncEntityMap = {
  tasks: TaskItem
  notes: NoteItem
  noteTags: NoteTag
  noteAppearance: NoteAppearanceSettings
  widgetTodos: WidgetTodo
  focusSettings: FocusSettings
  focusSessions: FocusSession
  diaryEntries: DiaryEntry
  spends: SpendEntry
  spendCategories: SpendCategory
  dashboardLayout: DashboardLayout
  userSubscriptions: UserSubscription
  featureInstallations: FeatureInstallation
  habits: Habit
  habitLogs: HabitLog
}

export type SyncPayload<T extends SyncEntityType = SyncEntityType> = SyncEntityMap[T] | ({ id: string; updatedAt: number } & Record<string, unknown>)

export type SyncOutboxItem<T extends SyncEntityType = SyncEntityType> = {
  id: string
  entityType: T
  entityId: string
  op: SyncOp
  payload: SyncPayload<T>
  updatedAt: number
  deletedAt?: number | null
  attemptCount: number
  nextRetryAt: number
  createdAt: number
}

export type SyncState = {
  id: 'cloud-sync'
  status: SyncStatus
  lastPulledAt: number | null
  lastPushedAt: number | null
  lastError: string | null
  firstSyncResolved: boolean
  pendingFirstSync: boolean
  pendingLocalRecordCount: number
  pendingRemoteRecordCount: number
  createdAt: number
  updatedAt: number
}

export type SyncRemoteRow<T extends SyncEntityType = SyncEntityType> = {
  id: string
  userId: string
  payload: SyncPayload<T>
  updatedAt: number
  deletedAt?: number | null
}

export type SyncTablesPayload = {
  [K in SyncEntityType]: Array<SyncRemoteRow<K>>
}

export type SyncBootstrapResponse = {
  serverTime: number
  tables: SyncTablesPayload
}
