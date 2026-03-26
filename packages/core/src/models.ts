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

export type TaskActivityLog = {
  id: string
  type: 'status' | 'details'
  message: string
  createdAt: number
}

export type TaskNoteParagraphBlock = {
  id: string
  type: 'paragraph'
  text: string
}

export type TaskNoteBlock = TaskNoteParagraphBlock

export type NoteCollection = 'all-notes' | 'work' | 'personal' | 'ideas'

export type NoteHeading = {
  level: 1 | 2 | 3
  text: string
  id: string
}

export type NoteBacklink = {
  noteId: string
  noteTitle: string
}

export type NoteTag = BaseEntity & {
  name: string
  icon?: string
  pinned: boolean
  parentId?: string | null
  noteCount: number
  sortOrder: number
}

export type NoteThemeMode = 'paper' | 'graphite'
export type NoteFontFamily = 'uiSans' | 'humanistSans' | 'cnSans' | 'serif' | 'cnSerif' | 'mono'
export type NoteEditorMode = 'document'

export type NoteAppearanceSettings = BaseEntity & {
  id: 'note_appearance'
  theme: NoteThemeMode
  font: NoteFontFamily
  fontSize: number
  lineHeight: number
  contentWidth: number
  focusMode: boolean
}

export type NoteItem = BaseEntity & {
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  editorMode: NoteEditorMode
  collection: NoteCollection
  tags: string[]
  excerpt: string
  pinned: boolean
  wordCount: number
  charCount: number
  paragraphCount: number
  imageCount: number
  fileCount: number
  headings: NoteHeading[]
  backlinks: NoteBacklink[]
  deletedAt?: number | null
}

export type TaskItem = BaseEntity & {
  title: string
  description: string
  pinned: boolean
  status: TaskStatus
  priority: TaskPriority | null
  dueDate?: string
  startDate?: string
  endDate?: string
  reminderAt?: number
  reminderFiredAt?: number
  tags: string[]
  subtasks: TaskSubtask[]
  taskNoteBlocks: TaskNoteBlock[]
  taskNoteContentMd?: string
  taskNoteContentJson?: Record<string, unknown> | null
  activityLogs: TaskActivityLog[]
}

export type WidgetTodoScope = 'day' | 'week' | 'month'

export type WidgetTodo = BaseEntity & {
  scope: WidgetTodoScope
  title: string
  priority: TaskPriority
  dueDate?: string
  done: boolean
  linkedHabitId?: string
}

export type FocusSettings = BaseEntity & {
  focusMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  noise?: NoiseSettings
  noisePreset?: NoisePreset
  volume?: number
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

export type WeatherSnapshot = {
  weatherCode: string
  condition: string
  temperatureMin?: number
  temperatureMax?: number
  locationName?: string
  capturedAt: number
}

export type DiaryEntry = BaseEntity & {
  dateKey: string
  entryAt: number
  contentMd: string
  contentJson?: Record<string, unknown> | null
  tags: string[]
  weatherSnapshot?: WeatherSnapshot | null
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

export type HabitType = 'boolean' | 'numeric' | 'timer'
export type HabitStatus = 'completed' | 'failed' | 'frozen'

export type Habit = BaseEntity & {
  userId: string
  title: string
  description?: string
  icon?: string
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
