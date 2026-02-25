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
