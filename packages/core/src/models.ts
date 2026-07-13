export type BaseEntity = {
  id: string
  createdAt: number
  updatedAt: number
  userId?: string
  workspaceId?: string
}

export type EntityRefDomain = 'core' | 'productivity' | 'content' | 'life' | 'commercial' | 'sync'

export type EntityRef = {
  domain: EntityRefDomain
  type: string
  id: string
}

export type EventSource = {
  kind: 'user' | 'system' | 'sync' | 'payment' | 'backfill'
  clientId?: string
  requestId?: string
  externalId?: string
}

export type ProjectStatus = 'planning' | 'active' | 'blocked' | 'done' | 'archived'

export type DomainEventType =
  | 'task.created'
  | 'task.completed'
  | 'focus.started'
  | 'focus.completed'
  | 'note.created'
  | 'note.updated'
  | 'project.created'
  | 'project.archived'
  | 'diary.created'
  | 'podcast.saved'
  | 'news.saved'
  | 'payment.success'
  | 'sync.finished'

export type DomainEventPayloadMap = {
  'task.created': { title: string; status: TaskStatus; priority: TaskPriority | null; projectId?: string }
  'task.completed': { title: string; previousStatus: TaskStatus; completedAt: number; projectId?: string }
  'focus.started': { taskId?: string; goal?: string; plannedMinutes: number }
  'focus.completed': { taskId?: string; goal?: string; plannedMinutes: number; actualMinutes: number; completedAt: number }
  'note.created': { title: string; collection: NoteCollection; tagNames: string[] }
  'note.updated': { title: string; changedFields: string[] }
  'project.created': { title: string; status: ProjectStatus; priority: TaskPriority | null; dueDate?: string }
  'project.archived': { title: string; archivedAt: number }
  'diary.created': { dateKey: string; entryAt: number; tagNames: string[] }
  'podcast.saved': { name: string; author: string; source: 'itunes' | 'netease'; collectionId: number }
  'news.saved': { title: string; url: string; sourceId?: string }
  'payment.success': {
    orderNo: string
    planId: string
    entitlement: string
    amount: number
    currency: string
    channel: string
    paidAt: number
  }
  'sync.finished': { pushedCount?: number; pulledCount?: number; status: 'success'; finishedAt: number }
}

export type DomainEvent<TType extends DomainEventType = DomainEventType> = Omit<BaseEntity, 'workspaceId'> & {
  type: TType
  actorId?: string | null
  workspaceId?: string | null
  occurredAt: number
  source: EventSource
  subject: EntityRef
  subjectKey: string
  related: EntityRef[]
  payload: DomainEventPayloadMap[TType]
  schemaVersion: number
  dedupeKey: string
}

export type TimelineKind =
  | 'task'
  | 'focus'
  | 'note'
  | 'project'
  | 'diary'
  | 'podcast'
  | 'news'
  | 'payment'
  | 'sync'

export type TimelineVisibility = 'default' | 'quiet' | 'hidden'

export type TimelineItem = BaseEntity & {
  eventId: string
  kind: TimelineKind
  title: string
  summary?: string
  occurredAt: number
  subject: EntityRef
  subjectKey: string
  related: EntityRef[]
  domain: EntityRefDomain
  entityType: string
  entityId: string
  visibility: TimelineVisibility
  pinned: boolean
  route?: string
  icon?: string
  accent?: string
  source: {
    eventType: DomainEventType | 'backfill'
    eventSchemaVersion: number
    projectionVersion: number
  }
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
  type: 'status' | 'details' | 'subtask'
  message: string
  createdAt: number
  subtaskId?: string
  subtaskTitle?: string
  subtaskDone?: boolean
}

export type TaskProgressEntry = {
  id: string
  text: string
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

export type NotePaperBg = 'beige' | 'white'

export type NoteAppearanceSettings = BaseEntity & {
  id: 'note_appearance'
  theme: NoteThemeMode
  font: NoteFontFamily
  fontSize: number
  lineHeight: number
  contentWidth: number
  focusMode: boolean
  paperBg: NotePaperBg
  zoom: number
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

export type TaskAttachmentMime = 'image/webp' | 'image/png' | 'image/jpeg' | 'image/gif'

export type TaskAttachment = {
  id: string
  hash: string
  mime: TaskAttachmentMime
  width: number
  height: number
  byteLength: number
  name?: string
  createdAt: number
}

export type TaskItem = BaseEntity & {
  title: string
  description: string
  pinned: boolean
  isToday: boolean
  status: TaskStatus
  priority: TaskPriority | null
  projectId?: string
  ownerId?: string
  collaboratorIds?: string[]
  dependencyTaskIds?: string[]
  blockedByTaskIds?: string[]
  isBlocked?: boolean
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
  attachments?: TaskAttachment[]
  progressNote?: string
  progressNoteUpdatedAt?: number
  progressHistory?: TaskProgressEntry[]
}

export type WidgetTodoScope = 'day' | 'week' | 'month' | 'custom'

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
  layoutVersion?: number
}

export type LifeDashboardLayout = BaseEntity & {
  items: DashboardLayoutItem[]
  hiddenCardIds?: string[]
}

export type LifePodcastEpisode = {
  id: string
  title: string
  description?: string
  duration?: string
  releaseDate?: string
  audioUrl?: string
  externalUrl?: string
}

export type LifePodcast = BaseEntity & {
  source: 'itunes' | 'netease'
  sourceId: string
  collectionId: number
  name: string
  author: string
  artworkUrl?: string
  feedUrl?: string
  externalUrl?: string
  primaryGenre?: string
  releaseDate?: string
  country?: string
  coverColor?: string
  coverEmoji?: string
  episodes: LifePodcastEpisode[]
  selectedEpisodeId?: string
  isPlaying?: boolean
  lastSyncedAt?: number
}

export type PersonGroup = 'Family' | 'Friends' | 'Work' | 'Community' | 'Other'

export type LifePerson = BaseEntity & {
  name: string
  group: PersonGroup
  category?: string
  role?: string
  city?: string
  notes?: string
  email?: string
  phone?: string
  birthday?: string
  lastInteraction?: string
  avatarInitials: string
  avatarColor?: string
  sourceProjectId?: string
  sourceProjectPersonId?: string
}

export type TripStatus = 'Planning' | 'Booked' | 'Ready' | 'Ongoing' | 'Done'
export type TransportMethod = 'Flight' | 'Train' | 'Bus' | 'Taxi' | 'Subway' | 'Walk' | 'Car'
export type TransportCategory = 'intercity' | 'local'
export type BookingStatus = 'Confirmed' | 'Pending' | 'Not booked'
export type FoodStatus = 'Saved' | 'Planned' | 'Visited'
export type ItineraryType = 'spot' | 'food' | 'transport' | 'hotel'

export type TripItineraryItem = {
  id: string
  title: string
  time: string
  location: string
  type: ItineraryType
  notes?: string
}

export type TripItineraryDay = {
  day: number
  date: string
  label: string
  items: TripItineraryItem[]
}

export type TripTransportItem = {
  id: string
  category: TransportCategory
  method: TransportMethod
  from: string
  to: string
  departTime: string
  arriveTime: string
  date: string
  status: BookingStatus
  cost: number
  currency: string
  notes?: string
}

export type TripStayItem = {
  id: string
  name: string
  address: string
  checkIn: string
  checkOut: string
  nights: number
  status: BookingStatus
  cost: number
  currency: string
  notes?: string
}

export type TripFoodItem = {
  id: string
  name: string
  area: string
  cuisine: string
  status: FoodStatus
  priceRange: '¥' | '¥¥' | '¥¥¥'
  notes?: string
}

export type TripBudgetCategory = {
  id: string
  label: string
  emoji: string
  planned: number
  actual: number
}

export type TripChecklistItem = {
  id: string
  label: string
  done: boolean
}

export type TripChecklistGroup = {
  id: string
  label: string
  emoji: string
  items: TripChecklistItem[]
}

export type TripRecord = BaseEntity & {
  title: string
  destination: string
  startDate: string
  endDate: string
  status: TripStatus
  travelers: number
  budgetPlanned: number
  budgetCurrency: string
  heroImage: string
  coverEmoji: string
  itinerary: TripItineraryDay[]
  transport: TripTransportItem[]
  stays: TripStayItem[]
  food: TripFoodItem[]
  budget: TripBudgetCategory[]
  checklist: TripChecklistGroup[]
  notes: string
}

export type BookSource = 'manual' | 'open-library' | 'google-books' | 'crossref' | 'gutendex'
export type BookStatus = 'reading' | 'finished' | 'want-to-read'
export type MediaSource = 'tmdb' | 'manual'
export type MediaType = 'movie' | 'tv'
export type MediaStatus = 'watching' | 'completed' | 'want-to-watch'
export type SubscriptionCycle = 'monthly' | 'yearly'
export type SubscriptionPaymentStatus = 'paid' | 'unpaid'

export type BookItem = BaseEntity & {
  source: BookSource
  sourceId: string
  title: string
  authors: string[]
  status: BookStatus
  progress: number
  coverUrl?: string
  description?: string
  publisher?: string
  publishedDate?: string
  subjects: string[]
  summary?: string
  outline?: string[]
  reflection?: string
  isbn10?: string
  isbn13?: string
  openLibraryKey?: string
  googleBooksId?: string
  doi?: string
  lastSyncedAt?: number
}

export type MediaItem = BaseEntity & {
  source: MediaSource
  sourceId: string
  tmdbId?: number
  mediaType: MediaType
  title: string
  originalTitle?: string
  status: MediaStatus
  progress: number
  posterUrl?: string
  backdropUrl?: string
  overview?: string
  releaseDate?: string
  director?: string
  creator?: string
  cast: string[]
  genres: string[]
  duration?: string
  seasons?: number
  episodes?: number
  country?: string
  language?: string
  rating?: string
  watchedEpisodes?: number
  reflection?: string
  voteAverage?: number
  lastSyncedAt?: number
}

export type StockItem = BaseEntity & {
  symbol: string
  name: string
  exchange?: string
  currency: string
  lastPrice?: number
  change?: number
  changePercent?: number
  chartPoints?: number[]
  note?: string
  pinned: boolean
  lastSyncedAt?: number
}

export type LifeSubscription = BaseEntity & {
  name: string
  amount: number
  currency: 'USD' | 'CNY'
  cycle: SubscriptionCycle
  color?: string
  category?: string
  billingDay?: number
  billingMonth?: number
  emoji?: string
  reminder?: boolean
  paymentStatus?: SubscriptionPaymentStatus
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
