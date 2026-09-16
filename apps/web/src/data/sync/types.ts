import type {
  BookItem,
  DashboardLayout,
  DiaryEntry,
  DomainEvent,
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
  TaskNoteLink,
  SpendCategory,
  SpendEntry,
  StockItem,
  SyncedPreferences,
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
  'userSubscriptions',
  'featureInstallations',
  'projects',
  'projectPeople',
  'projectNoteLinks',
  'taskNoteLinks',
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
  'syncedPreferences',
  'domainEvents',
  // Dashboard layouts: the server has had sync_dashboard_layout /
  // sync_life_dashboard_layout since the sync layer shipped, but the client
  // never pushed to them — layout changes stayed on one device.
  'dashboardLayout',
  'lifeDashboardLayout',
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]
export type SyncOp = 'upsert' | 'delete'
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'blocked'

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
  userSubscriptions: UserSubscription
  featureInstallations: FeatureInstallation
  projects: ProjectItem
  projectPeople: ProjectPerson
  projectNoteLinks: ProjectNoteLink
  taskNoteLinks: TaskNoteLink
  habits: Habit
  habitLogs: HabitLog
  books: BookItem
  stocks: StockItem
  media: MediaItem
  lifeSubscriptions: LifeSubscription
  lifePodcasts: LifePodcast
  lifePeople: LifePerson
  trips: TripRecord
  syncedPreferences: SyncedPreferences
  domainEvents: DomainEvent
  dashboardLayout: DashboardLayout
  lifeDashboardLayout: LifeDashboardLayout
}

export type SyncPayload<T extends SyncEntityType = SyncEntityType> = SyncEntityMap[T] | ({ id: string; updatedAt: number } & Record<string, unknown>)

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

export type SyncWireBlobContentType =
  | 'text/plain'
  | 'application/json'
  | 'image/webp'
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'

export type SyncWireBlobCompression = 'gzip' | 'none'

export type SyncWireBlob = {
  hash: string
  contentType: SyncWireBlobContentType
  compression: SyncWireBlobCompression
  rawByteLength: number
  byteLength: number
  dataBase64: string
}

export type SyncBlobCacheEntry = SyncWireBlob & {
  createdAt: number
  updatedAt: number
}

export type RxdbCheckpoint = {
  updatedAt: number
  id: string
}

export type RxdbPullRequest = {
  entityType: SyncEntityType
  checkpoint: RxdbCheckpoint | null
  limit: number
}

export type RxdbPullDocument<T extends SyncEntityType = SyncEntityType> = SyncPayload<T> & {
  _deleted?: boolean
  deletedAt?: number | null
}

export type RxdbPullResponse<T extends SyncEntityType = SyncEntityType> = {
  documents: Array<RxdbPullDocument<T>>
  checkpoint: RxdbCheckpoint | null
  blobs: SyncWireBlob[]
}

export type RxdbPushRow<T extends SyncEntityType = SyncEntityType> = {
  newDocumentState: RxdbPullDocument<T>
  assumedMasterState: RxdbPullDocument<T> | null
}

export type RxdbPushRequest<T extends SyncEntityType = SyncEntityType> = {
  entityType: T
  rows: Array<RxdbPushRow<T>>
  blobs: SyncWireBlob[]
}

export type RxdbPushResponse<T extends SyncEntityType = SyncEntityType> = {
  conflicts: Array<RxdbPullDocument<T>>
  blobs: SyncWireBlob[]
  quota: { usedBytes: number; payloadBytes: number; blobBytes: number; limitBytes: number }
}
