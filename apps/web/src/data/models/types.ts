export type BaseEntity = {
  id: string
  createdAt: number
  updatedAt: number
  userId?: string
  workspaceId?: string
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export type TaskSubtask = {
  id: string
  title: string
  done: boolean
}

export type TaskProgressLog = {
  id: string
  content: string
  createdAt: number
}

export type TaskActivityLog = {
  id: string
  type: 'status' | 'progress' | 'details'
  message: string
  createdAt: number
}

export type TaskItem = BaseEntity & {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority | null
  dueDate?: string
  startDate?: string
  endDate?: string
  reminderAt?: number
  reminderFiredAt?: number
  tags: string[]
  subtasks: TaskSubtask[]
  progressLogs: TaskProgressLog[]
  activityLogs: TaskActivityLog[]
}

export type WidgetTodoScope = 'day' | 'week' | 'month'

export type WidgetTodo = BaseEntity & {
  scope: WidgetTodoScope
  title: string
  priority: TaskPriority
  dueDate?: string
  done: boolean
}

export type FocusSettings = BaseEntity & {
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  noise?: NoiseSettings
  noisePreset?: NoisePreset
  volume?: number
  timer?: FocusTimerSnapshot
}

export type FocusTimerStatus = 'idle' | 'running' | 'paused' | 'completed'

export type FocusTimerSnapshot = {
  status: FocusTimerStatus
  durationMinutes: number
  remainingSeconds: number
  startedAt?: number
  endsAt?: number
  pausedAt?: number
  activeSessionId?: string | null
  lastCompletedAt?: number
  sessionId?: string
}

export type FocusSessionStatus = 'active' | 'completed' | 'interrupted'

export type FocusSession = BaseEntity & {
  taskId?: string
  goal?: string
  plannedMinutes: number
  actualMinutes?: number
  status: FocusSessionStatus
  completedAt?: number
  interruptedAt?: number
  interruptionReason?: string
}

export type NoiseTrackId = 'cafe' | 'fireplace' | 'rain' | 'wind' | 'thunder' | 'ocean'

export type NoiseTrackSettings = {
  enabled: boolean
  volume: number
}

export type NoiseSettings = {
  playing: boolean
  loop: boolean
  masterVolume: number
  tracks: Record<NoiseTrackId, NoiseTrackSettings>
}

export type NoisePreset = {
  presetId: string
  presetName: string
  scope: 'focus-center'
  isPlaying: boolean
  loop: boolean
  tracks: Record<NoiseTrackId, NoiseTrackSettings>
}

export type DiaryEntry = BaseEntity & {
  dateKey: string
  contentMd: string
  tags: string[]
  deletedAt?: number | null
  expiredAt?: number | null
}

export type SpendEntry = BaseEntity & {
  amount: number
  currency: string
  categoryId: string
  note?: string
  dateKey: string
}

export type SpendCategory = BaseEntity & {
  name: string
  icon?: string
}

export type DashboardLayoutItem = {
  key: string
  x: number
  y: number
  w: number
  h: number
}

export type DashboardLayout = BaseEntity & {
  items: DashboardLayoutItem[]
  hiddenCardIds?: string[]
  themeOverride?: 'light' | 'dark' | null
}

export type NoteEntity = BaseEntity & {
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  manualTags: string[]
  tags: string[]
  linkedNoteIds: string[]
  backlinks: string[]
  deletedAt?: number | null
  expiresAt?: number | null
}

export type NoteAssetEntity = BaseEntity & {
  noteId: string
  kind: 'image'
  storage: 'blob' | 'remote'
  blob?: Blob
  url?: string
  alt?: string
}

export type SubscriptionTier = 'free' | 'premium'

export type UserSubscription = BaseEntity & {
  userId: string
  tier: SubscriptionTier
}

export type FeatureKey = 'rss' | 'ai-digest' | 'automation' | 'habit-tracker'
export type FeatureInstallState = 'installed' | 'removed'

export type FeatureInstallation = BaseEntity & {
  userId: string
  featureKey: FeatureKey
  state: FeatureInstallState
  installedAt?: number
  removedAt?: number | null
}

export type RssSource = BaseEntity & {
  userId: string
  route: string
  displayName: string
  isPreset: boolean
  enabled: boolean
  groupId?: string | null
  starredAt?: number | null
  deletedAt?: number | null
  lastSuccessAt?: number
  lastEntryAt?: number
  lastErrorAt?: number
  lastErrorMessage?: string
}

export type RssSourceGroup = BaseEntity & {
  userId: string
  name: string
}

export type RssEntry = BaseEntity & {
  sourceId: string
  route: string
  guidOrLink: string
  title: string
  summary: string
  url: string
  thumbnailUrl?: string
  publishedAt: number
  cachedAt: number
}

export type RssReadState = BaseEntity & {
  userId: string
  entryId: string
  readAt: number
}

export type RssFetchSnapshot = {
  sourceId: string
  stale: boolean
  lastSuccessAt?: number
  fetchedAt: number
}

export type HabitType = 'boolean' | 'numeric' | 'timer'
export type HabitStatus = 'completed' | 'failed' | 'frozen'

export type Habit = BaseEntity & {
  userId: string
  title: string
  type: HabitType
  color: string
  archived: boolean
  target?: number
  freezesAllowed: number
  sortOrder: number
}

export type HabitLog = BaseEntity & {
  userId: string
  habitId: string
  dateKey: string
  value?: number
  status: HabitStatus
}
