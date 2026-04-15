import type {
  BookItem,
  DashboardLayout,
  DiaryEntry,
  FeatureInstallation,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  LifeDashboardLayout,
  LifePerson,
  LifePodcast,
  LifeSubscription,
  MediaItem,
  NoteAppearanceSettings,
  NoteItem,
  NoteTag,
  ProjectItem,
  ProjectNoteLink,
  ProjectPerson,
  SpendCategory,
  SpendEntry,
  StockItem,
  TaskItem,
  TripRecord,
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
  'projects',
  'projectPeople',
  'projectNoteLinks',
  'habits',
  'habitLogs',
  // Life feature tables (previously local-only)
  'books',
  'stocks',
  'media',
  'lifeSubscriptions',
  'lifePodcasts',
  'lifePeople',
  'trips',
  'lifeDashboardLayout',
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
  projects: ProjectItem
  projectPeople: ProjectPerson
  projectNoteLinks: ProjectNoteLink
  habits: Habit
  habitLogs: HabitLog
  books: BookItem
  stocks: StockItem
  media: MediaItem
  lifeSubscriptions: LifeSubscription
  lifePodcasts: LifePodcast
  lifePeople: LifePerson
  trips: TripRecord
  lifeDashboardLayout: LifeDashboardLayout
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
  pendingEntityPush: boolean
  pendingBlobPush: boolean
  missingBlobPull: boolean
  migrationVersion: number
  restoreIntegrityStatus: 'idle' | 'verifying' | 'ready' | 'error'
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

export type SyncWireBlob = {
  hash: string
  contentType: 'text/plain' | 'application/json'
  compression: 'gzip'
  rawByteLength: number
  byteLength: number
  dataBase64: string
}

export type SyncBlobCacheEntry = SyncWireBlob & {
  createdAt: number
  updatedAt: number
}

export type SyncPushRequest = {
  entities: SyncOutboxItem[]
  blobs: SyncWireBlob[]
}

export type SyncPushResponse = {
  applied: number
  serverTime: number
  missingBlobs: string[]
}

export type SyncWireResponse = {
  serverTime: number
  tables: SyncTablesPayload
  blobs: SyncWireBlob[]
  missingBlobs: string[]
}
