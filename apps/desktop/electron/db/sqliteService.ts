import { mkdirSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type {
  BookCreateInput,
  BookItem,
  DashboardLayout,
  DiaryEntry,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  HabitStatus,
  IDatabaseService,
  LifeDashboardLayout,
  LifeDashboardLayoutUpsertInput,
  LifePodcast,
  LifePodcastCreateInput,
  LifePodcastUpdateInput,
  LifePerson,
  LifePersonCreateInput,
  LifePersonUpdateInput,
  LifeSubscription,
  LifeSubscriptionCreateInput,
  LifeSubscriptionUpdateInput,
  MediaCreateInput,
  MediaItem,
  MediaUpdateInput,
  NoteAppearanceSettings,
  NoteAppearanceUpsertInput,
  NoteCreateInput,
  NoteItem,
  NoteTag,
  NoteTagCreateInput,
  NoteTagUpdateInput,
  NoteUpdateInput,
  SpendCategory,
  SpendEntry,
  StockCreateInput,
  StockItem,
  StockUpdateInput,
  TaskCreateInput,
  TaskItem,
  TaskStatus,
  TripCreateInput,
  TripRecord,
  TripUpdateInput,
  WidgetTodo,
  WidgetTodoScope,
} from '@focus-go/core'

const FOCUS_SETTINGS_ID = 'focus_settings'
const DASHBOARD_LAYOUT_ID = 'dashboard_layout'
const LIFE_DASHBOARD_LAYOUT_ID = 'life_dashboard_layout'
const NOTE_APPEARANCE_ID = 'note_appearance'
const MS_PER_DAY = 24 * 60 * 60 * 1000

const createId = () => randomUUID().replace(/-/g, '')

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const serializeJson = (value: unknown) => JSON.stringify(value)

const now = () => Date.now()

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0)
}

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const moveDateKey = (dateKey: string, delta: number) => {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + delta)
  return toDateKey(date)
}

const buildNoteExcerpt = (contentMd: string) => contentMd.replace(/\s+/g, ' ').trim().slice(0, 160)

const buildNoteStats = (contentMd: string) => {
  const content = typeof contentMd === 'string' ? contentMd : ''
  const words = content.trim().split(/\s+/).filter(Boolean)
  const paragraphs = content.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
  const headings = content
    .split('\n')
    .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      level: Math.min(3, match[1].length) as 1 | 2 | 3,
      text: match[2].trim(),
      id: match[2]
        .trim()
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-'),
    }))

  return {
    wordCount: words.length,
    charCount: content.length,
    paragraphCount: paragraphs.length,
    imageCount: (content.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length,
    fileCount: (content.match(/\battachment:\b/gi) ?? []).length,
    headings,
  }
}

const toTaskItem = (row: Record<string, unknown>): TaskItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  title: String(row.title ?? ''),
  description: String(row.description ?? ''),
  pinned: Number(row.pinned ?? 0) === 1,
  isToday: Number(row.isToday ?? 0) === 1,
  status: String(row.status) as TaskStatus,
  priority: (row.priority as TaskItem['priority']) ?? null,
  dueDate: row.dueDate ? String(row.dueDate) : undefined,
  startDate: row.startDate ? String(row.startDate) : undefined,
  endDate: row.endDate ? String(row.endDate) : undefined,
  reminderAt: row.reminderAt === null || row.reminderAt === undefined ? undefined : Number(row.reminderAt),
  reminderFiredAt: row.reminderFiredAt === null || row.reminderFiredAt === undefined ? undefined : Number(row.reminderFiredAt),
  tags: parseJson(row.tags as string, [] as string[]),
  subtasks: parseJson(row.subtasks as string, [] as TaskItem['subtasks']),
  taskNoteBlocks: parseJson(row.taskNoteBlocks as string, [] as TaskItem['taskNoteBlocks']),
  taskNoteContentMd: row.taskNoteContentMd ? String(row.taskNoteContentMd) : undefined,
  taskNoteContentJson: parseJson(row.taskNoteContentJson as string, null),
  progressLogs: parseJson(row.progressLogs as string, [] as TaskItem['progressLogs']),
  activityLogs: parseJson(row.activityLogs as string, [] as TaskItem['activityLogs']),
})

const toWidgetTodo = (row: Record<string, unknown>): WidgetTodo => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  scope: String(row.scope) as WidgetTodoScope,
  title: String(row.title),
  priority: String(row.priority) as WidgetTodo['priority'],
  dueDate: row.dueDate ? String(row.dueDate) : undefined,
  done: Number(row.done) === 1,
  linkedHabitId: row.linkedHabitId ? String(row.linkedHabitId) : undefined,
})

const toHabit = (row: Record<string, unknown>): Habit => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: String(row.userId ?? ''),
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  title: String(row.title ?? ''),
  description: row.description ? String(row.description) : undefined,
  icon: row.icon ? String(row.icon) : undefined,
  type: String(row.type) as Habit['type'],
  color: String(row.color ?? '#3a3733'),
  archived: Number(row.archived ?? 0) === 1,
  target: row.target === null || row.target === undefined ? undefined : Number(row.target),
  freezesAllowed: Number(row.freezesAllowed ?? 0),
  sortOrder: Number(row.sortOrder ?? 0),
})

const toHabitLog = (row: Record<string, unknown>): HabitLog => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: String(row.userId ?? ''),
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  habitId: String(row.habitId),
  dateKey: String(row.dateKey),
  value: row.value === null || row.value === undefined ? undefined : Number(row.value),
  status: String(row.status) as HabitStatus,
})

const toNoteItem = (row: Record<string, unknown>): NoteItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  title: String(row.title ?? ''),
  contentMd: String(row.contentMd ?? ''),
  contentJson: parseJson(row.contentJson as string, null),
  collection: String(row.collection ?? 'all-notes') as NoteItem['collection'],
  tags: parseJson(row.tags as string, [] as string[]),
  excerpt: String(row.excerpt ?? ''),
  pinned: Number(row.pinned ?? 0) === 1,
  wordCount: Number(row.wordCount ?? 0),
  charCount: Number(row.charCount ?? 0),
  paragraphCount: Number(row.paragraphCount ?? 0),
  imageCount: Number(row.imageCount ?? 0),
  fileCount: Number(row.fileCount ?? 0),
  headings: parseJson(row.headings as string, [] as NoteItem['headings']),
  backlinks: parseJson(row.backlinks as string, [] as NoteItem['backlinks']),
  deletedAt: row.deletedAt === null || row.deletedAt === undefined ? null : Number(row.deletedAt),
})

const toNoteTag = (row: Record<string, unknown>): NoteTag => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  name: String(row.name ?? ''),
  icon: row.icon ? String(row.icon) : undefined,
  pinned: Number(row.pinned ?? 0) === 1,
  parentId: row.parentId === null || row.parentId === undefined ? null : String(row.parentId),
  noteCount: Number(row.noteCount ?? 0),
  sortOrder: Number(row.sortOrder ?? 0),
})

const toNoteAppearance = (row: Record<string, unknown>): NoteAppearanceSettings => ({
  id: NOTE_APPEARANCE_ID,
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  theme: String(row.theme) === 'graphite' ? 'graphite' : 'paper',
  font:
    String(row.font) === 'humanistSans' ||
    String(row.font) === 'cnSans' ||
    String(row.font) === 'serif' ||
    String(row.font) === 'cnSerif' ||
    String(row.font) === 'mono'
      ? (String(row.font) as NoteAppearanceSettings['font'])
      : 'uiSans',
  fontSize: Number(row.fontSize ?? 16),
  lineHeight: Number(row.lineHeight ?? 1.7),
  contentWidth: Number(row.contentWidth ?? 0),
  focusMode: Number(row.focusMode ?? 0) === 1,
})

const toFocusSettings = (row: Record<string, unknown>): FocusSettings => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  focusMinutes: Number(row.focusMinutes),
  breakMinutes: Number(row.breakMinutes),
  longBreakMinutes: Number(row.longBreakMinutes),
  noise: parseJson(row.noise as string, undefined),
  noisePreset: parseJson(row.noisePreset as string, undefined),
  volume: row.volume === null || row.volume === undefined ? undefined : Number(row.volume),
})

const toFocusSession = (row: Record<string, unknown>): FocusSession => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  taskId: row.taskId ? String(row.taskId) : undefined,
  goal: row.goal ? String(row.goal) : undefined,
  plannedMinutes: Number(row.plannedMinutes),
  actualMinutes: row.actualMinutes === null || row.actualMinutes === undefined ? undefined : Number(row.actualMinutes),
  status: String(row.status) as FocusSession['status'],
  completedAt: row.completedAt === null || row.completedAt === undefined ? undefined : Number(row.completedAt),
  interruptedAt: row.interruptedAt === null || row.interruptedAt === undefined ? undefined : Number(row.interruptedAt),
  interruptionReason: row.interruptionReason ? String(row.interruptionReason) : undefined,
})

const toDiaryEntry = (row: Record<string, unknown>): DiaryEntry => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  dateKey: String(row.dateKey),
  contentMd: String(row.contentMd ?? ''),
  tags: parseJson(row.tags as string, [] as string[]),
  deletedAt: row.deletedAt === null || row.deletedAt === undefined ? null : Number(row.deletedAt),
  expiredAt: row.expiredAt === null || row.expiredAt === undefined ? null : Number(row.expiredAt),
})

const toSpendEntry = (row: Record<string, unknown>): SpendEntry => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  amount: Number(row.amount),
  currency: String(row.currency),
  categoryId: String(row.categoryId),
  note: row.note ? String(row.note) : undefined,
  dateKey: String(row.dateKey),
})

const toSpendCategory = (row: Record<string, unknown>): SpendCategory => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  name: String(row.name),
  icon: row.icon ? String(row.icon) : undefined,
})

const toDashboardLayout = (row: Record<string, unknown>): DashboardLayout => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  items: parseJson(row.items as string, [] as DashboardLayout['items']),
  hiddenCardIds: parseJson(row.hiddenCardIds as string, undefined),
  themeOverride: (row.themeOverride as DashboardLayout['themeOverride']) ?? null,
})

const toLifeDashboardLayout = (row: Record<string, unknown>): LifeDashboardLayout => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  items: parseJson(row.items as string, [] as LifeDashboardLayout['items']),
  hiddenCardIds: parseJson(row.hiddenCardIds as string, undefined),
})

const toBookItem = (row: Record<string, unknown>): BookItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  source: String(row.source ?? 'manual') as BookItem['source'],
  sourceId: String(row.sourceId ?? row.id),
  title: String(row.title ?? ''),
  authors: parseJson(row.authors as string, [] as string[]),
  status: String(row.status ?? 'want-to-read') as BookItem['status'],
  progress: Number(row.progress ?? 0),
  coverUrl: row.coverUrl ? String(row.coverUrl) : undefined,
  description: row.description ? String(row.description) : undefined,
  publisher: row.publisher ? String(row.publisher) : undefined,
  publishedDate: row.publishedDate ? String(row.publishedDate) : undefined,
  subjects: parseJson(row.subjects as string, [] as string[]),
  summary: row.summary ? String(row.summary) : undefined,
  outline: parseJson(row.outline as string, undefined),
  reflection: row.reflection ? String(row.reflection) : undefined,
  isbn10: row.isbn10 ? String(row.isbn10) : undefined,
  isbn13: row.isbn13 ? String(row.isbn13) : undefined,
  openLibraryKey: row.openLibraryKey ? String(row.openLibraryKey) : undefined,
  googleBooksId: row.googleBooksId ? String(row.googleBooksId) : undefined,
  doi: row.doi ? String(row.doi) : undefined,
  lastSyncedAt: row.lastSyncedAt === null || row.lastSyncedAt === undefined ? undefined : Number(row.lastSyncedAt),
})

const toStockItem = (row: Record<string, unknown>): StockItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  symbol: String(row.symbol ?? ''),
  name: String(row.name ?? ''),
  exchange: row.exchange ? String(row.exchange) : undefined,
  currency: String(row.currency ?? 'USD'),
  lastPrice: row.lastPrice === null || row.lastPrice === undefined ? undefined : Number(row.lastPrice),
  change: row.change === null || row.change === undefined ? undefined : Number(row.change),
  changePercent: row.changePercent === null || row.changePercent === undefined ? undefined : Number(row.changePercent),
  chartPoints: parseJson(row.chartPoints as string, undefined),
  note: row.note ? String(row.note) : undefined,
  pinned: Number(row.pinned ?? 0) === 1,
  lastSyncedAt: row.lastSyncedAt === null || row.lastSyncedAt === undefined ? undefined : Number(row.lastSyncedAt),
})

const toMediaItem = (row: Record<string, unknown>): MediaItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  source: 'tmdb',
  sourceId: String(row.sourceId ?? row.tmdbId ?? row.id),
  tmdbId: Number(row.tmdbId ?? 0),
  mediaType: String(row.mediaType ?? 'movie') === 'tv' ? 'tv' : 'movie',
  title: String(row.title ?? ''),
  originalTitle: row.originalTitle ? String(row.originalTitle) : undefined,
  status: String(row.status ?? 'want-to-watch') as MediaItem['status'],
  progress: Number(row.progress ?? 0),
  posterUrl: row.posterUrl ? String(row.posterUrl) : undefined,
  backdropUrl: row.backdropUrl ? String(row.backdropUrl) : undefined,
  overview: row.overview ? String(row.overview) : undefined,
  releaseDate: row.releaseDate ? String(row.releaseDate) : undefined,
  director: row.director ? String(row.director) : undefined,
  creator: row.creator ? String(row.creator) : undefined,
  cast: parseJson(row.cast as string, [] as string[]),
  genres: parseJson(row.genres as string, [] as string[]),
  duration: row.duration ? String(row.duration) : undefined,
  seasons: row.seasons === null || row.seasons === undefined ? undefined : Number(row.seasons),
  episodes: row.episodes === null || row.episodes === undefined ? undefined : Number(row.episodes),
  country: row.country ? String(row.country) : undefined,
  language: row.language ? String(row.language) : undefined,
  rating: row.rating ? String(row.rating) : undefined,
  watchedEpisodes: row.watchedEpisodes === null || row.watchedEpisodes === undefined ? undefined : Number(row.watchedEpisodes),
  reflection: row.reflection ? String(row.reflection) : undefined,
  voteAverage: row.voteAverage === null || row.voteAverage === undefined ? undefined : Number(row.voteAverage),
  lastSyncedAt: row.lastSyncedAt === null || row.lastSyncedAt === undefined ? undefined : Number(row.lastSyncedAt),
})

const toLifeSubscription = (row: Record<string, unknown>): LifeSubscription => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  name: String(row.name ?? ''),
  amount: Number(row.amount ?? 0),
  currency: String(row.currency ?? 'USD') === 'CNY' ? 'CNY' : 'USD',
  cycle: String(row.cycle ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly',
  color: row.color ? String(row.color) : undefined,
  category: row.category ? String(row.category) : undefined,
  billingDay: row.billingDay === null || row.billingDay === undefined ? undefined : Number(row.billingDay),
  billingMonth: row.billingMonth === null || row.billingMonth === undefined ? undefined : Number(row.billingMonth),
  emoji: row.emoji ? String(row.emoji) : undefined,
  reminder: Number(row.reminder ?? 0) === 1,
  paymentStatus: String(row.paymentStatus ?? '') === 'paid' ? 'paid' : String(row.paymentStatus ?? '') === 'unpaid' ? 'unpaid' : undefined,
})

const toLifePodcast = (row: Record<string, unknown>): LifePodcast => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  source: String(row.source ?? '') === 'netease' ? 'netease' : 'itunes',
  sourceId: String(row.sourceId ?? row.collectionId ?? row.id),
  collectionId: Number(row.collectionId ?? 0),
  name: String(row.name ?? ''),
  author: String(row.author ?? ''),
  artworkUrl: row.artworkUrl ? String(row.artworkUrl) : undefined,
  feedUrl: row.feedUrl ? String(row.feedUrl) : undefined,
  primaryGenre: row.primaryGenre ? String(row.primaryGenre) : undefined,
  releaseDate: row.releaseDate ? String(row.releaseDate) : undefined,
  country: row.country ? String(row.country) : undefined,
  coverColor: row.coverColor ? String(row.coverColor) : undefined,
  coverEmoji: row.coverEmoji ? String(row.coverEmoji) : undefined,
  episodes: parseJson(row.episodes as string, [] as LifePodcast['episodes']),
  selectedEpisodeId: row.selectedEpisodeId ? String(row.selectedEpisodeId) : undefined,
  isPlaying: Number(row.isPlaying ?? 0) === 1,
  lastSyncedAt: row.lastSyncedAt === null || row.lastSyncedAt === undefined ? undefined : Number(row.lastSyncedAt),
})

const toLifePerson = (row: Record<string, unknown>): LifePerson => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  name: String(row.name ?? ''),
  group: String(row.group ?? 'Other') as LifePerson['group'],
  role: row.role ? String(row.role) : undefined,
  city: row.city ? String(row.city) : undefined,
  notes: row.notes ? String(row.notes) : undefined,
  birthday: row.birthday ? String(row.birthday) : undefined,
  lastInteraction: row.lastInteraction ? String(row.lastInteraction) : undefined,
  avatarInitials: String(row.avatarInitials ?? ''),
  avatarColor: row.avatarColor ? String(row.avatarColor) : undefined,
})

const toTripRecord = (row: Record<string, unknown>): TripRecord => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  title: String(row.title ?? ''),
  destination: String(row.destination ?? ''),
  startDate: String(row.startDate ?? ''),
  endDate: String(row.endDate ?? ''),
  status: String(row.status ?? 'Planning') as TripRecord['status'],
  travelers: Number(row.travelers ?? 1),
  budgetPlanned: Number(row.budgetPlanned ?? 0),
  budgetCurrency: String(row.budgetCurrency ?? 'USD'),
  heroImage: String(row.heroImage ?? ''),
  coverEmoji: String(row.coverEmoji ?? ''),
  itinerary: parseJson(row.itinerary as string, [] as TripRecord['itinerary']),
  transport: parseJson(row.transport as string, [] as TripRecord['transport']),
  stays: parseJson(row.stays as string, [] as TripRecord['stays']),
  food: parseJson(row.food as string, [] as TripRecord['food']),
  budget: parseJson(row.budget as string, [] as TripRecord['budget']),
  checklist: parseJson(row.checklist as string, [] as TripRecord['checklist']),
  notes: String(row.notes ?? ''),
})

const ensureSchema = (database: Database.Database) => {
  database.pragma('journal_mode = WAL')

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      isToday INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      priority TEXT,
      dueDate TEXT,
      startDate TEXT,
      endDate TEXT,
      reminderAt INTEGER,
      reminderFiredAt INTEGER,
      tags TEXT NOT NULL,
      subtasks TEXT NOT NULL,
      taskNoteBlocks TEXT NOT NULL DEFAULT '[]',
      taskNoteContentMd TEXT,
      taskNoteContentJson TEXT,
      progressLogs TEXT NOT NULL,
      activityLogs TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      contentMd TEXT NOT NULL,
      contentJson TEXT,
      collection TEXT NOT NULL,
      tags TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      wordCount INTEGER NOT NULL DEFAULT 0,
      charCount INTEGER NOT NULL DEFAULT 0,
      paragraphCount INTEGER NOT NULL DEFAULT 0,
      imageCount INTEGER NOT NULL DEFAULT 0,
      fileCount INTEGER NOT NULL DEFAULT 0,
      headings TEXT NOT NULL DEFAULT '[]',
      backlinks TEXT NOT NULL DEFAULT '[]',
      deletedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS widget_todos (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      title TEXT NOT NULL,
      priority TEXT NOT NULL,
      dueDate TEXT,
      done INTEGER NOT NULL,
      linkedHabitId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      type TEXT NOT NULL,
      color TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      target REAL,
      freezesAllowed INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      habitId TEXT NOT NULL,
      dateKey TEXT NOT NULL,
      value REAL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_settings (
      id TEXT PRIMARY KEY,
      focusMinutes INTEGER NOT NULL,
      breakMinutes INTEGER NOT NULL,
      longBreakMinutes INTEGER NOT NULL,
      noise TEXT,
      noisePreset TEXT,
      volume REAL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      taskId TEXT,
      goal TEXT,
      plannedMinutes INTEGER NOT NULL,
      actualMinutes INTEGER,
      status TEXT NOT NULL,
      completedAt INTEGER,
      interruptedAt INTEGER,
      interruptionReason TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS diary_entries (
      id TEXT PRIMARY KEY,
      dateKey TEXT NOT NULL,
      contentMd TEXT NOT NULL,
      tags TEXT NOT NULL,
      deletedAt INTEGER,
      expiredAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS spends (
      id TEXT PRIMARY KEY,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      note TEXT,
      dateKey TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS spend_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS dashboard_layout (
      id TEXT PRIMARY KEY,
      items TEXT NOT NULL,
      hiddenCardIds TEXT,
      themeOverride TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS life_dashboard_layout (
      id TEXT PRIMARY KEY,
      items TEXT NOT NULL,
      hiddenCardIds TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      title TEXT NOT NULL,
      authors TEXT NOT NULL,
      status TEXT NOT NULL,
      progress REAL NOT NULL,
      coverUrl TEXT,
      description TEXT,
      publisher TEXT,
      publishedDate TEXT,
      subjects TEXT NOT NULL,
      summary TEXT,
      outline TEXT,
      reflection TEXT,
      isbn10 TEXT,
      isbn13 TEXT,
      openLibraryKey TEXT,
      googleBooksId TEXT,
      doi TEXT,
      lastSyncedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      tmdbId INTEGER NOT NULL,
      mediaType TEXT NOT NULL,
      title TEXT NOT NULL,
      originalTitle TEXT,
      status TEXT NOT NULL,
      progress REAL NOT NULL,
      posterUrl TEXT,
      backdropUrl TEXT,
      overview TEXT,
      releaseDate TEXT,
      director TEXT,
      creator TEXT,
      cast TEXT NOT NULL,
      genres TEXT NOT NULL,
      duration TEXT,
      seasons INTEGER,
      episodes INTEGER,
      country TEXT,
      language TEXT,
      rating TEXT,
      watchedEpisodes INTEGER,
      reflection TEXT,
      voteAverage REAL,
      lastSyncedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS stocks (
      id TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      exchange TEXT,
      currency TEXT NOT NULL,
      lastPrice REAL,
      change REAL,
      changePercent REAL,
      chartPoints TEXT,
      note TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      lastSyncedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS life_subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      cycle TEXT NOT NULL,
      color TEXT,
      category TEXT,
      billingDay INTEGER,
      billingMonth INTEGER,
      emoji TEXT,
      reminder INTEGER NOT NULL DEFAULT 0,
      paymentStatus TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS life_podcasts (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'itunes',
      sourceId TEXT NOT NULL,
      collectionId INTEGER NOT NULL,
      name TEXT NOT NULL,
      author TEXT NOT NULL,
      artworkUrl TEXT,
      feedUrl TEXT,
      primaryGenre TEXT,
      releaseDate TEXT,
      country TEXT,
      coverColor TEXT,
      coverEmoji TEXT,
      episodes TEXT NOT NULL,
      selectedEpisodeId TEXT,
      isPlaying INTEGER NOT NULL DEFAULT 0,
      lastSyncedAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS life_people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      "group" TEXT NOT NULL,
      role TEXT,
      city TEXT,
      notes TEXT,
      birthday TEXT,
      lastInteraction TEXT,
      avatarInitials TEXT NOT NULL,
      avatarColor TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      destination TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      status TEXT NOT NULL,
      travelers INTEGER NOT NULL,
      budgetPlanned REAL NOT NULL,
      budgetCurrency TEXT NOT NULL,
      heroImage TEXT NOT NULL,
      coverEmoji TEXT NOT NULL,
      itinerary TEXT NOT NULL,
      transport TEXT NOT NULL,
      stays TEXT NOT NULL,
      food TEXT NOT NULL,
      budget TEXT NOT NULL,
      checklist TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS note_tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      pinned INTEGER NOT NULL DEFAULT 0,
      parentId TEXT,
      noteCount INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );

    CREATE TABLE IF NOT EXISTS note_appearance (
      id TEXT PRIMARY KEY,
      theme TEXT NOT NULL,
      font TEXT NOT NULL,
      fontSize REAL NOT NULL,
      lineHeight REAL NOT NULL,
      contentWidth REAL NOT NULL,
      focusMode INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      workspaceId TEXT
    );
  `)

  const ensureColumn = (table: string, column: string, definition: string) => {
    const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (rows.some((row) => row.name === column)) return
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }

  ensureColumn('tasks', 'pinned', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('tasks', 'isToday', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('tasks', 'startDate', 'TEXT')
  ensureColumn('tasks', 'endDate', 'TEXT')
  ensureColumn('tasks', 'reminderAt', 'INTEGER')
  ensureColumn('tasks', 'reminderFiredAt', 'INTEGER')
  ensureColumn('tasks', 'taskNoteBlocks', `TEXT NOT NULL DEFAULT '[]'`)
  ensureColumn('tasks', 'taskNoteContentMd', 'TEXT')
  ensureColumn('tasks', 'taskNoteContentJson', 'TEXT')

  ensureColumn('notes', 'pinned', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'wordCount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'charCount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'paragraphCount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'imageCount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'fileCount', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('notes', 'headings', `TEXT NOT NULL DEFAULT '[]'`)
  ensureColumn('notes', 'backlinks', `TEXT NOT NULL DEFAULT '[]'`)
  ensureColumn('widget_todos', 'linkedHabitId', 'TEXT')
  ensureColumn('media', 'creator', 'TEXT')
  ensureColumn('media', 'duration', 'TEXT')
  ensureColumn('media', 'seasons', 'INTEGER')
  ensureColumn('media', 'episodes', 'INTEGER')
  ensureColumn('media', 'country', 'TEXT')
  ensureColumn('media', 'language', 'TEXT')
  ensureColumn('media', 'rating', 'TEXT')
  ensureColumn('media', 'watchedEpisodes', 'INTEGER')
  ensureColumn('media', 'reflection', 'TEXT')
  ensureColumn('life_subscriptions', 'currency', `TEXT NOT NULL DEFAULT 'USD'`)
  ensureColumn('life_subscriptions', 'color', 'TEXT')
  ensureColumn('life_subscriptions', 'category', 'TEXT')
  ensureColumn('life_subscriptions', 'billingDay', 'INTEGER')
  ensureColumn('life_subscriptions', 'billingMonth', 'INTEGER')
  ensureColumn('life_subscriptions', 'emoji', 'TEXT')
  ensureColumn('life_subscriptions', 'reminder', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('life_subscriptions', 'paymentStatus', 'TEXT')
  ensureColumn('life_podcasts', 'coverColor', 'TEXT')
  ensureColumn('life_podcasts', 'coverEmoji', 'TEXT')
  ensureColumn('life_podcasts', 'source', `TEXT NOT NULL DEFAULT 'itunes'`)
  ensureColumn('life_podcasts', 'selectedEpisodeId', 'TEXT')
  ensureColumn('life_podcasts', 'isPlaying', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn('life_podcasts', 'lastSyncedAt', 'INTEGER')

  const versionRow = database.prepare('SELECT version FROM schema_version LIMIT 1').get() as { version: number } | undefined
  if (!versionRow) {
    database.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1)
  }
}

const createTaskActivityMessage = (status: TaskStatus) => {
  const label = status === 'todo' ? 'Todo' : status === 'doing' ? 'Doing' : 'Done'
  return `Created in ${label}`
}

type DexieDump = Partial<{
  tasks: TaskItem[]
  notes: NoteItem[]
  widgetTodos: WidgetTodo[]
  habits: Habit[]
  habitLogs: HabitLog[]
  focusSettings: FocusSettings[]
  focusSessions: FocusSession[]
  diaryEntries: DiaryEntry[]
  spends: SpendEntry[]
  spendCategories: SpendCategory[]
  dashboardLayout: DashboardLayout[]
}>

export type SqliteBundle = {
  service: IDatabaseService
  dbPath: string
  importFromDexieJson: (jsonContent: string) => { backupPath: string; importedRows: number }
  close: () => void
}

export const createSqliteBundle = (dbPath: string): SqliteBundle => {
  mkdirSync(path.dirname(dbPath), { recursive: true })
  const database = new Database(dbPath)
  ensureSchema(database)

  const service: IDatabaseService = {
    tasks: {
      async list() {
        const rows = database.prepare('SELECT * FROM tasks ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toTaskItem)
      },
      async add(data: TaskCreateInput) {
        const time = now()
        const entity: TaskItem = {
          id: createId(),
          createdAt: time,
          updatedAt: time,
          title: data.title,
          description: data.description ?? '',
          pinned: data.pinned === true,
          isToday: data.isToday === true,
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate,
          startDate: data.startDate,
          endDate: data.endDate,
          reminderAt: data.reminderAt,
          reminderFiredAt: data.reminderFiredAt,
          tags: data.tags ?? [],
          subtasks: data.subtasks ?? [],
          taskNoteBlocks: data.taskNoteBlocks ?? [],
          taskNoteContentMd: data.taskNoteContentMd,
          taskNoteContentJson: data.taskNoteContentJson ?? null,
          progressLogs: [],
          activityLogs: [
            {
              id: createId(),
              type: 'status',
              message: createTaskActivityMessage(data.status),
              createdAt: time,
            },
          ],
        }

        database
          .prepare(
            `INSERT INTO tasks
              (id, title, description, pinned, isToday, status, priority, dueDate, startDate, endDate, reminderAt, reminderFiredAt, tags, subtasks, taskNoteBlocks, taskNoteContentMd, taskNoteContentJson, progressLogs, activityLogs, createdAt, updatedAt, userId, workspaceId)
             VALUES
              (@id, @title, @description, @pinned, @isToday, @status, @priority, @dueDate, @startDate, @endDate, @reminderAt, @reminderFiredAt, @tags, @subtasks, @taskNoteBlocks, @taskNoteContentMd, @taskNoteContentJson, @progressLogs, @activityLogs, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            pinned: entity.pinned ? 1 : 0,
            isToday: entity.isToday ? 1 : 0,
            tags: serializeJson(entity.tags),
            subtasks: serializeJson(entity.subtasks),
            taskNoteBlocks: serializeJson(entity.taskNoteBlocks),
            taskNoteContentMd: entity.taskNoteContentMd ?? null,
            taskNoteContentJson: serializeJson(entity.taskNoteContentJson),
            progressLogs: serializeJson(entity.progressLogs),
            activityLogs: serializeJson(entity.activityLogs),
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
            dueDate: entity.dueDate ?? null,
            startDate: entity.startDate ?? null,
            endDate: entity.endDate ?? null,
            reminderAt: entity.reminderAt ?? null,
            reminderFiredAt: entity.reminderFiredAt ?? null,
          })

        return entity
      },
      async update(task) {
        const next: TaskItem = { ...task, updatedAt: now() }
        database
          .prepare(
            `UPDATE tasks SET
               title=@title,
               description=@description,
               pinned=@pinned,
               isToday=@isToday,
               status=@status,
               priority=@priority,
               dueDate=@dueDate,
               startDate=@startDate,
               endDate=@endDate,
               reminderAt=@reminderAt,
               reminderFiredAt=@reminderFiredAt,
               tags=@tags,
               subtasks=@subtasks,
               taskNoteBlocks=@taskNoteBlocks,
               taskNoteContentMd=@taskNoteContentMd,
               taskNoteContentJson=@taskNoteContentJson,
               progressLogs=@progressLogs,
               activityLogs=@activityLogs,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            pinned: next.pinned ? 1 : 0,
            isToday: next.isToday ? 1 : 0,
            dueDate: next.dueDate ?? null,
            startDate: next.startDate ?? null,
            endDate: next.endDate ?? null,
            reminderAt: next.reminderAt ?? null,
            reminderFiredAt: next.reminderFiredAt ?? null,
            tags: serializeJson(next.tags),
            subtasks: serializeJson(next.subtasks),
            taskNoteBlocks: serializeJson(next.taskNoteBlocks),
            taskNoteContentMd: next.taskNoteContentMd ?? null,
            taskNoteContentJson: serializeJson(next.taskNoteContentJson),
            progressLogs: serializeJson(next.progressLogs),
            activityLogs: serializeJson(next.activityLogs),
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id) {
        database.prepare('DELETE FROM tasks WHERE id = ?').run(id)
      },
      async updateStatus(id, status) {
        const row = database.prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const current = toTaskItem(row)
        if (current.status === status) return current
        const time = now()
        const next: TaskItem = {
          ...current,
          status,
          updatedAt: time,
          activityLogs: [
            ...current.activityLogs,
            {
              id: createId(),
              type: 'status',
              message: `Status changed to ${status === 'todo' ? 'Todo' : status === 'doing' ? 'Doing' : 'Done'}`,
              createdAt: time,
            },
          ],
        }
        await service.tasks.update(next)
        return next
      },
      async appendProgress(id, content) {
        const row = database.prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const current = toTaskItem(row)
        const text = content.trim()
        if (!text) return current
        const time = now()
        const next: TaskItem = {
          ...current,
          updatedAt: time,
          progressLogs: [
            ...current.progressLogs,
            {
              id: createId(),
              content: text,
              createdAt: time,
            },
          ],
          activityLogs: [
            ...current.activityLogs,
            {
              id: createId(),
              type: 'progress',
              message: `Progress added: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
              createdAt: time,
            },
          ],
        }
        await service.tasks.update(next)
        return next
      },
      async clearAllTags() {
        const rows = database.prepare('SELECT * FROM tasks').all() as Record<string, unknown>[]
        for (const row of rows) {
          const task = toTaskItem(row)
          if (task.tags.length === 0) continue
          await service.tasks.update({ ...task, tags: [] })
        }
      },
    },
    notes: {
      async list() {
        const rows = database
          .prepare('SELECT * FROM notes WHERE deletedAt IS NULL ORDER BY updatedAt DESC')
          .all() as Record<string, unknown>[]
        return rows.map(toNoteItem)
      },
      async listTrash() {
        const rows = database
          .prepare('SELECT * FROM notes WHERE deletedAt IS NOT NULL ORDER BY updatedAt DESC')
          .all() as Record<string, unknown>[]
        return rows.map(toNoteItem)
      },
      async create(data?: NoteCreateInput) {
        const time = now()
        const stats = buildNoteStats(data?.contentMd ?? '')
        const entity: NoteItem = {
          id: createId(),
          createdAt: time,
          updatedAt: time,
          title: data?.title ?? '',
          contentMd: data?.contentMd ?? '',
          contentJson: data?.contentJson ?? null,
          collection: data?.collection ?? 'all-notes',
          tags: data?.tags ?? [],
          pinned: data?.pinned === true,
          excerpt: buildNoteExcerpt(data?.contentMd ?? ''),
          ...stats,
          backlinks: data?.backlinks ?? [],
          deletedAt: null,
        }

        database
          .prepare(
            `INSERT INTO notes
             (id, title, contentMd, contentJson, collection, tags, excerpt, pinned, wordCount, charCount, paragraphCount, imageCount, fileCount, headings, backlinks, deletedAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @title, @contentMd, @contentJson, @collection, @tags, @excerpt, @pinned, @wordCount, @charCount, @paragraphCount, @imageCount, @fileCount, @headings, @backlinks, @deletedAt, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            contentJson: serializeJson(entity.contentJson),
            tags: serializeJson(entity.tags),
            pinned: entity.pinned ? 1 : 0,
            headings: serializeJson(entity.headings),
            backlinks: serializeJson(entity.backlinks),
            deletedAt: entity.deletedAt ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })

        return entity
      },
      async update(id, patch: NoteUpdateInput) {
        const row = database.prepare('SELECT * FROM notes WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const current = toNoteItem(row)
        const contentMd = patch.contentMd ?? current.contentMd
        const stats = buildNoteStats(contentMd)
        const next: NoteItem = {
          ...current,
          ...patch,
          id,
          updatedAt: now(),
          excerpt: typeof patch.excerpt === 'string' ? patch.excerpt : buildNoteExcerpt(contentMd),
          wordCount: typeof patch.wordCount === 'number' ? patch.wordCount : stats.wordCount,
          charCount: typeof patch.charCount === 'number' ? patch.charCount : stats.charCount,
          paragraphCount: typeof patch.paragraphCount === 'number' ? patch.paragraphCount : stats.paragraphCount,
          imageCount: typeof patch.imageCount === 'number' ? patch.imageCount : stats.imageCount,
          fileCount: typeof patch.fileCount === 'number' ? patch.fileCount : stats.fileCount,
          headings: Array.isArray(patch.headings) ? patch.headings : stats.headings,
          backlinks: Array.isArray(patch.backlinks) ? patch.backlinks : current.backlinks,
        }

        database
          .prepare(
            `UPDATE notes SET
               title=@title,
               contentMd=@contentMd,
               contentJson=@contentJson,
               collection=@collection,
               tags=@tags,
               excerpt=@excerpt,
               pinned=@pinned,
               wordCount=@wordCount,
               charCount=@charCount,
               paragraphCount=@paragraphCount,
               imageCount=@imageCount,
               fileCount=@fileCount,
               headings=@headings,
               backlinks=@backlinks,
               deletedAt=@deletedAt,
               updatedAt=@updatedAt
             WHERE id=@id`
          )
          .run({
            ...next,
            contentJson: serializeJson(next.contentJson),
            tags: serializeJson(next.tags),
            pinned: next.pinned ? 1 : 0,
            headings: serializeJson(next.headings),
            backlinks: serializeJson(next.backlinks),
            deletedAt: next.deletedAt ?? null,
          })

        return next
      },
      async softDelete(id) {
        return service.notes.update(id, { deletedAt: now() })
      },
      async restore(id) {
        return service.notes.update(id, { deletedAt: null })
      },
      async hardDelete(id) {
        database.prepare('DELETE FROM notes WHERE id = ?').run(id)
      },
    },
    noteTags: {
      async list() {
        const rows = database.prepare('SELECT * FROM note_tags ORDER BY sortOrder ASC, updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toNoteTag)
      },
      async create(data: NoteTagCreateInput) {
        const entity: NoteTag = {
          id: createId(),
          createdAt: now(),
          updatedAt: now(),
          name: data.name,
          icon: data.icon,
          pinned: data.pinned === true,
          parentId: data.parentId ?? null,
          noteCount: 0,
          sortOrder: data.sortOrder ?? 0,
          userId: data.userId,
          workspaceId: data.workspaceId,
        }
        database
          .prepare(
            `INSERT INTO note_tags
             (id, name, icon, pinned, parentId, noteCount, sortOrder, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @name, @icon, @pinned, @parentId, @noteCount, @sortOrder, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            icon: entity.icon ?? null,
            pinned: entity.pinned ? 1 : 0,
            parentId: entity.parentId ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: NoteTagUpdateInput) {
        const row = database.prepare('SELECT * FROM note_tags WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const current = toNoteTag(row)
        const next: NoteTag = {
          ...current,
          ...patch,
          id,
          updatedAt: now(),
        }
        database
          .prepare(
            `UPDATE note_tags SET
               name=@name,
               icon=@icon,
               pinned=@pinned,
               parentId=@parentId,
               noteCount=@noteCount,
               sortOrder=@sortOrder,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            icon: next.icon ?? null,
            pinned: next.pinned ? 1 : 0,
            parentId: next.parentId ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id) {
        database.prepare('DELETE FROM note_tags WHERE id = ?').run(id)
      },
    },
    noteAppearance: {
      async get() {
        const row = database.prepare('SELECT * FROM note_appearance WHERE id = ? LIMIT 1').get(NOTE_APPEARANCE_ID) as
          | Record<string, unknown>
          | undefined
        return row ? toNoteAppearance(row) : null
      },
      async upsert(data: Partial<NoteAppearanceUpsertInput> & Pick<NoteAppearanceUpsertInput, 'id'>) {
        const current = await service.noteAppearance.get()
        if (!current) {
          const entity: NoteAppearanceSettings = {
            id: NOTE_APPEARANCE_ID,
            createdAt: now(),
            updatedAt: now(),
            theme: data.theme === 'graphite' ? 'graphite' : 'paper',
            font:
              data.font === 'humanistSans' ||
              data.font === 'cnSans' ||
              data.font === 'serif' ||
              data.font === 'cnSerif' ||
              data.font === 'mono'
                ? data.font
                : 'uiSans',
            fontSize: data.fontSize ?? 16,
            lineHeight: data.lineHeight ?? 1.7,
            contentWidth: data.contentWidth ?? 0,
            focusMode: data.focusMode === true,
            userId: data.userId,
            workspaceId: data.workspaceId,
          }
          database
            .prepare(
              `INSERT INTO note_appearance
               (id, theme, font, fontSize, lineHeight, contentWidth, focusMode, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @theme, @font, @fontSize, @lineHeight, @contentWidth, @focusMode, @createdAt, @updatedAt, @userId, @workspaceId)`
            )
            .run({
              ...entity,
              focusMode: entity.focusMode ? 1 : 0,
              userId: entity.userId ?? null,
              workspaceId: entity.workspaceId ?? null,
            })
          return entity
        }
        const next: NoteAppearanceSettings = {
          ...current,
          ...data,
          id: NOTE_APPEARANCE_ID,
          updatedAt: now(),
        }
        database
          .prepare(
            `UPDATE note_appearance SET
               theme=@theme,
               font=@font,
               fontSize=@fontSize,
               lineHeight=@lineHeight,
               contentWidth=@contentWidth,
               focusMode=@focusMode,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            focusMode: next.focusMode ? 1 : 0,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    widgetTodos: {
      async list(scope) {
        if (scope) {
          const rows = database.prepare('SELECT * FROM widget_todos WHERE scope = ? ORDER BY updatedAt DESC').all(scope) as Record<string, unknown>[]
          return rows.map(toWidgetTodo)
        }
        const rows = database.prepare('SELECT * FROM widget_todos ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toWidgetTodo)
      },
      async add(data) {
        const time = now()
        const entity: WidgetTodo = {
          id: createId(),
          createdAt: time,
          updatedAt: time,
          ...data,
        }
        database
          .prepare(
            `INSERT INTO widget_todos
             (id, scope, title, priority, dueDate, done, linkedHabitId, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @scope, @title, @priority, @dueDate, @done, @linkedHabitId, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            dueDate: entity.dueDate ?? null,
            done: entity.done ? 1 : 0,
            linkedHabitId: entity.linkedHabitId ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(item) {
        const next: WidgetTodo = { ...item, updatedAt: now() }
        database
          .prepare(
             `UPDATE widget_todos SET
               scope=@scope,
               title=@title,
               priority=@priority,
               dueDate=@dueDate,
               done=@done,
               linkedHabitId=@linkedHabitId,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            dueDate: next.dueDate ?? null,
            done: next.done ? 1 : 0,
            linkedHabitId: next.linkedHabitId ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async resetDone(scope) {
        const rows = database
          .prepare('SELECT * FROM widget_todos WHERE scope = ? AND done = 1 ORDER BY updatedAt DESC')
          .all(scope) as Record<string, unknown>[]
        if (rows.length === 0) return []
        database.prepare('UPDATE widget_todos SET done = 0 WHERE scope = ? AND done = 1').run(scope)
        return rows.map((row) => ({ ...toWidgetTodo(row), done: false }))
      },
      async remove(id) {
        database.prepare('DELETE FROM widget_todos WHERE id = ?').run(id)
      },
    },
    habits: {
      async listHabits(userId, options = {}) {
        const archived = options.archived ?? false
        const rows = database.prepare('SELECT * FROM habits WHERE userId = ? AND archived = ? ORDER BY sortOrder ASC, createdAt ASC').all(userId, archived ? 1 : 0) as Record<string, unknown>[]
        return rows.map(toHabit)
      },
      async createHabit(data) {
        const row = database.prepare('SELECT MAX(sortOrder) as maxSortOrder FROM habits WHERE userId = ?').get(data.userId) as { maxSortOrder?: number } | undefined
        const time = now()
        const entity: Habit = {
          id: createId(),
          createdAt: time,
          updatedAt: time,
          ...data,
          sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : Number(row?.maxSortOrder ?? -1) + 1,
        }
        database
          .prepare(
            `INSERT INTO habits
             (id, userId, title, description, icon, type, color, archived, target, freezesAllowed, sortOrder, createdAt, updatedAt, workspaceId)
             VALUES (@id, @userId, @title, @description, @icon, @type, @color, @archived, @target, @freezesAllowed, @sortOrder, @createdAt, @updatedAt, @workspaceId)`
          )
          .run({
            ...entity,
            description: entity.description ?? null,
            icon: entity.icon ?? null,
            archived: entity.archived ? 1 : 0,
            target: entity.target ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async updateHabit(id, patch) {
        const existing = database.prepare('SELECT * FROM habits WHERE id = ?').get(id) as Record<string, unknown> | undefined
        if (!existing) return undefined
        const next: Habit = { ...toHabit(existing), ...patch, updatedAt: now() }
        database
          .prepare(
            `UPDATE habits SET
               title=@title,
               description=@description,
               icon=@icon,
               type=@type,
               color=@color,
               archived=@archived,
               target=@target,
               freezesAllowed=@freezesAllowed,
               sortOrder=@sortOrder,
               updatedAt=@updatedAt,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            description: next.description ?? null,
            icon: next.icon ?? null,
            archived: next.archived ? 1 : 0,
            target: next.target ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async archiveHabit(id) {
        return service.habits.updateHabit(id, { archived: true })
      },
      async restoreHabit(id) {
        return service.habits.updateHabit(id, { archived: false })
      },
      async reorderHabits(userId, ids) {
        if (ids.length === 0) return
        const rows = database.prepare('SELECT * FROM habits WHERE userId = ? AND archived = 0').all(userId) as Record<string, unknown>[]
        const byId = new Map(rows.map((row) => {
          const habit = toHabit(row)
          return [habit.id, habit]
        }))
        const time = now()
        const updateStmt = database.prepare('UPDATE habits SET sortOrder = ?, updatedAt = ? WHERE id = ?')
        for (const [index, id] of ids.entries()) {
          if (!byId.has(id)) continue
          updateStmt.run(index, time, id)
        }
      },
      async recordHabitCompletion(habitId, dateKey, value) {
        const habitRow = database.prepare('SELECT * FROM habits WHERE id = ?').get(habitId) as Record<string, unknown> | undefined
        if (!habitRow) throw new Error('Habit not found')
        const habit = toHabit(habitRow)
        const existingRow = database.prepare('SELECT * FROM habit_logs WHERE habitId = ? AND dateKey = ? LIMIT 1').get(habitId, dateKey) as Record<string, unknown> | undefined
        const time = now()
        const nextValue =
          typeof value === 'number' ? value : habit.type === 'boolean' ? undefined : typeof habit.target === 'number' ? habit.target : undefined
        const entity: HabitLog = existingRow
          ? {
              ...toHabitLog(existingRow),
              status: 'completed',
              value: nextValue ?? toHabitLog(existingRow).value,
              updatedAt: time,
            }
          : {
              id: createId(),
              createdAt: time,
              updatedAt: time,
              userId: habit.userId,
              workspaceId: habit.workspaceId,
              habitId,
              dateKey,
              value: nextValue,
              status: 'completed',
            }

        database
          .prepare(
            `INSERT INTO habit_logs
             (id, userId, habitId, dateKey, value, status, createdAt, updatedAt, workspaceId)
             VALUES (@id, @userId, @habitId, @dateKey, @value, @status, @createdAt, @updatedAt, @workspaceId)
             ON CONFLICT(id) DO UPDATE SET
               userId=excluded.userId,
               habitId=excluded.habitId,
               dateKey=excluded.dateKey,
               value=excluded.value,
               status=excluded.status,
               updatedAt=excluded.updatedAt,
               workspaceId=excluded.workspaceId`
          )
          .run({
            ...entity,
            value: entity.value ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async undoHabitCompletion(habitId, dateKey) {
        database.prepare('DELETE FROM habit_logs WHERE habitId = ? AND dateKey = ?').run(habitId, dateKey)
      },
      async listHabitLogs(habitId) {
        const rows = database.prepare('SELECT * FROM habit_logs WHERE habitId = ? ORDER BY dateKey DESC').all(habitId) as Record<string, unknown>[]
        return rows.map(toHabitLog)
      },
      async computeHabitStreak(habitId, dateKey) {
        const habitRow = database.prepare('SELECT * FROM habits WHERE id = ?').get(habitId) as Record<string, unknown> | undefined
        if (!habitRow) return 0
        const habit = toHabit(habitRow)
        const logs = service.habits.listHabitLogs(habitId)
        const resolvedLogs = await logs
        const map = new Map(resolvedLogs.map((item) => [item.dateKey, item]))
        const earliestDateKey =
          resolvedLogs.length > 0 ? resolvedLogs.reduce((min, item) => (item.dateKey < min ? item.dateKey : min), resolvedLogs[0].dateKey) : null
        let streak = 0
        let cursor = dateKey
        let freezesLeft = Math.max(0, habit.freezesAllowed)

        for (let index = 0; index < 3650; index += 1) {
          const log = map.get(cursor)
          if (!log) {
            if (earliestDateKey && cursor < earliestDateKey) break
            if (freezesLeft <= 0) break
            freezesLeft -= 1
            streak += 1
            cursor = moveDateKey(cursor, -1)
            continue
          }
          if (log.status === 'completed' || log.status === 'frozen') {
            streak += 1
            if (log.status === 'frozen') freezesLeft = Math.max(0, freezesLeft - 1)
            cursor = moveDateKey(cursor, -1)
            continue
          }
          if (freezesLeft <= 0) break
          freezesLeft -= 1
          streak += 1
          cursor = moveDateKey(cursor, -1)
        }
        return streak
      },
      async getDailyProgress(userId, dateKey) {
        const habits = await service.habits.listHabits(userId, { archived: false })
        if (habits.length === 0) return { completed: 0, total: 0, percent: 0 }
        const rows = database.prepare('SELECT habitId FROM habit_logs WHERE userId = ? AND dateKey = ? AND status = ?').all(userId, dateKey, 'completed') as Array<{ habitId: string }>
        const completedIds = new Set(rows.map((row) => row.habitId))
        const completed = habits.filter((habit) => completedIds.has(habit.id)).length
        return { completed, total: habits.length, percent: Math.round((completed / habits.length) * 100) }
      },
      async getHeatmap(userId, days) {
        const range = Math.max(1, days)
        const end = new Date()
        const first = new Date(end.getTime() - (range - 1) * MS_PER_DAY)
        const startKey = toDateKey(first)
        const endKey = toDateKey(end)
        const habits = await service.habits.listHabits(userId, { archived: false })
        const rows = database.prepare('SELECT * FROM habit_logs WHERE userId = ? AND dateKey >= ? AND dateKey <= ?').all(userId, startKey, endKey) as Record<string, unknown>[]
        const byDate = new Map<string, number>()
        for (const row of rows.map(toHabitLog)) {
          if (row.status !== 'completed') continue
          byDate.set(row.dateKey, (byDate.get(row.dateKey) ?? 0) + 1)
        }
        return Array.from({ length: range }).map((_, index) => {
          const key = toDateKey(new Date(first.getTime() + index * MS_PER_DAY))
          return { dateKey: key, completed: byDate.get(key) ?? 0, total: habits.length }
        })
      },
    },
    focus: {
      async get() {
        const row = database.prepare('SELECT * FROM focus_settings WHERE id = ? LIMIT 1').get(FOCUS_SETTINGS_ID) as
          | Record<string, unknown>
          | undefined
        return row ? toFocusSettings(row) : null
      },
      async upsert(data) {
        const existing = await service.focus.get()
        if (!existing) {
          const entity: FocusSettings = {
            id: FOCUS_SETTINGS_ID,
            createdAt: now(),
            updatedAt: now(),
            ...data,
          }
          database
            .prepare(
              `INSERT INTO focus_settings
               (id, focusMinutes, breakMinutes, longBreakMinutes, noise, noisePreset, volume, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @focusMinutes, @breakMinutes, @longBreakMinutes, @noise, @noisePreset, @volume, @createdAt, @updatedAt, @userId, @workspaceId)`
            )
            .run({
              ...entity,
              noise: entity.noise ? serializeJson(entity.noise) : null,
              noisePreset: entity.noisePreset ? serializeJson(entity.noisePreset) : null,
              volume: entity.volume ?? null,
              userId: entity.userId ?? null,
              workspaceId: entity.workspaceId ?? null,
            })
          return entity
        }

        const next: FocusSettings = { ...existing, ...data, updatedAt: now() }
        database
          .prepare(
            `UPDATE focus_settings SET
               focusMinutes=@focusMinutes,
               breakMinutes=@breakMinutes,
               longBreakMinutes=@longBreakMinutes,
               noise=@noise,
               noisePreset=@noisePreset,
               volume=@volume,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            noise: next.noise ? serializeJson(next.noise) : null,
            noisePreset: next.noisePreset ? serializeJson(next.noisePreset) : null,
            volume: next.volume ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    focusSessions: {
      async list(limit) {
        const query = typeof limit === 'number' && limit > 0
          ? 'SELECT * FROM focus_sessions ORDER BY createdAt DESC LIMIT ?'
          : 'SELECT * FROM focus_sessions ORDER BY createdAt DESC'
        const rows = (
          typeof limit === 'number' && limit > 0
            ? database.prepare(query).all(limit)
            : database.prepare(query).all()
        ) as Record<string, unknown>[]
        return rows.map(toFocusSession)
      },
      async start(data) {
        const time = now()
        const entity: FocusSession = {
          id: createId(),
          createdAt: time,
          updatedAt: time,
          taskId: data.taskId,
          goal: data.goal?.trim() || undefined,
          plannedMinutes: data.plannedMinutes,
          status: 'active',
          userId: data.userId,
          workspaceId: data.workspaceId,
        }
        database
          .prepare(
            `INSERT INTO focus_sessions
             (id, taskId, goal, plannedMinutes, actualMinutes, status, completedAt, interruptedAt, interruptionReason, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @taskId, @goal, @plannedMinutes, @actualMinutes, @status, @completedAt, @interruptedAt, @interruptionReason, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            taskId: entity.taskId ?? null,
            goal: entity.goal ?? null,
            actualMinutes: null,
            completedAt: null,
            interruptedAt: null,
            interruptionReason: null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async complete(id, data) {
        const row = database.prepare('SELECT * FROM focus_sessions WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const existing = toFocusSession(row)
        const completedAt = data?.completedAt ?? now()
        const actualMinutes =
          typeof data?.actualMinutes === 'number'
            ? data.actualMinutes
            : Math.max(1, Math.round((completedAt - existing.createdAt) / 60000))
        const next: FocusSession = {
          ...existing,
          updatedAt: now(),
          status: 'completed',
          completedAt,
          actualMinutes,
        }
        database
          .prepare(
            `UPDATE focus_sessions SET
               taskId=@taskId,
               goal=@goal,
               plannedMinutes=@plannedMinutes,
               actualMinutes=@actualMinutes,
               status=@status,
               completedAt=@completedAt,
               interruptedAt=@interruptedAt,
               interruptionReason=@interruptionReason,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            taskId: next.taskId ?? null,
            goal: next.goal ?? null,
            actualMinutes: next.actualMinutes ?? null,
            completedAt: next.completedAt ?? null,
            interruptedAt: next.interruptedAt ?? null,
            interruptionReason: next.interruptionReason ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    diary: {
      async list() {
        const rows = database.prepare('SELECT * FROM diary_entries ORDER BY dateKey DESC').all() as Record<string, unknown>[]
        return rows.map(toDiaryEntry)
      },
      async listActive() {
        const rows = database
          .prepare('SELECT * FROM diary_entries WHERE deletedAt IS NULL OR deletedAt = 0 ORDER BY dateKey DESC')
          .all() as Record<string, unknown>[]
        return rows.map(toDiaryEntry)
      },
      async getByDate(dateKey) {
        const row = database
          .prepare('SELECT * FROM diary_entries WHERE dateKey = ? ORDER BY updatedAt DESC LIMIT 1')
          .get(dateKey) as Record<string, unknown> | undefined
        return row ? toDiaryEntry(row) : undefined
      },
      async listByRange(dateFrom, dateTo, options = {}) {
        const rows = database
          .prepare('SELECT * FROM diary_entries WHERE dateKey >= ? AND dateKey <= ? ORDER BY dateKey DESC')
          .all(dateFrom, dateTo) as Record<string, unknown>[]
        const entries = rows.map(toDiaryEntry)
        if (options.includeDeleted) return entries
        return entries.filter((entry) => !entry.deletedAt)
      },
      async listTrash() {
        const rows = database
          .prepare('SELECT * FROM diary_entries WHERE deletedAt IS NOT NULL AND deletedAt > 0 ORDER BY deletedAt DESC')
          .all() as Record<string, unknown>[]
        return rows.map(toDiaryEntry)
      },
      async softDeleteByDate(dateKey) {
        const entry = await service.diary.getByDate(dateKey)
        if (!entry) return null
        const next: DiaryEntry = { ...entry, deletedAt: now(), expiredAt: null, updatedAt: now() }
        await service.diary.update(next)
        return next
      },
      async restoreByDate(dateKey) {
        const entry = await service.diary.getByDate(dateKey)
        if (!entry) return null
        const next: DiaryEntry = { ...entry, deletedAt: null, expiredAt: null, updatedAt: now() }
        await service.diary.update(next)
        return next
      },
      async markExpiredOlderThan(days = 30) {
        const cutoff = now() - days * 24 * 60 * 60 * 1000
        const rows = database
          .prepare('SELECT * FROM diary_entries WHERE deletedAt IS NOT NULL AND deletedAt <= ? AND (expiredAt IS NULL OR expiredAt = 0)')
          .all(cutoff) as Record<string, unknown>[]

        let changed = 0
        for (const row of rows) {
          const entry = toDiaryEntry(row)
          await service.diary.update({ ...entry, expiredAt: now() })
          changed += 1
        }
        return changed
      },
      async hardDeleteByDate(dateKey) {
        const result = database.prepare('DELETE FROM diary_entries WHERE dateKey = ?').run(dateKey)
        return result.changes
      },
      async add(data) {
        const entity: DiaryEntry = {
          id: createId(),
          createdAt: now(),
          updatedAt: now(),
          ...data,
        }
        database
          .prepare(
            `INSERT INTO diary_entries
             (id, dateKey, contentMd, tags, deletedAt, expiredAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @dateKey, @contentMd, @tags, @deletedAt, @expiredAt, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            tags: serializeJson(entity.tags),
            deletedAt: entity.deletedAt ?? null,
            expiredAt: entity.expiredAt ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(entry) {
        const next = { ...entry, updatedAt: now() }
        database
          .prepare(
            `UPDATE diary_entries SET
               dateKey=@dateKey,
               contentMd=@contentMd,
               tags=@tags,
               deletedAt=@deletedAt,
               expiredAt=@expiredAt,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            tags: serializeJson(next.tags),
            deletedAt: next.deletedAt ?? null,
            expiredAt: next.expiredAt ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    spend: {
      async listEntries() {
        const rows = database.prepare('SELECT * FROM spends ORDER BY dateKey DESC, updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toSpendEntry)
      },
      async addEntry(data) {
        const entity: SpendEntry = {
          id: createId(),
          createdAt: now(),
          updatedAt: now(),
          ...data,
        }
        database
          .prepare(
            `INSERT INTO spends
             (id, amount, currency, categoryId, note, dateKey, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @amount, @currency, @categoryId, @note, @dateKey, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            note: entity.note ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async deleteEntry(id) {
        database.prepare('DELETE FROM spends WHERE id = ?').run(id)
      },
      async updateEntry(entry) {
        const next = { ...entry, updatedAt: now() }
        database
          .prepare(
            `UPDATE spends SET
               amount=@amount,
               currency=@currency,
               categoryId=@categoryId,
               note=@note,
               dateKey=@dateKey,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            note: next.note ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async listCategories() {
        const rows = database.prepare('SELECT * FROM spend_categories ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toSpendCategory)
      },
      async addCategory(data) {
        const entity: SpendCategory = {
          id: createId(),
          createdAt: now(),
          updatedAt: now(),
          ...data,
        }
        database
          .prepare(
            `INSERT INTO spend_categories
             (id, name, icon, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @name, @icon, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            icon: entity.icon ?? null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async updateCategory(category) {
        const next = { ...category, updatedAt: now() }
        database
          .prepare(
            `UPDATE spend_categories SET
               name=@name,
               icon=@icon,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            icon: next.icon ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    dashboard: {
      async get() {
        const row = database.prepare('SELECT * FROM dashboard_layout WHERE id = ? LIMIT 1').get(DASHBOARD_LAYOUT_ID) as
          | Record<string, unknown>
          | undefined
        return row ? toDashboardLayout(row) : null
      },
      async upsert(data) {
        const existing = await service.dashboard.get()
        if (!existing) {
          const entity: DashboardLayout = {
            id: DASHBOARD_LAYOUT_ID,
            createdAt: now(),
            updatedAt: now(),
            ...data,
          }
          database
            .prepare(
              `INSERT INTO dashboard_layout
               (id, items, hiddenCardIds, themeOverride, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @items, @hiddenCardIds, @themeOverride, @createdAt, @updatedAt, @userId, @workspaceId)`
            )
            .run({
              ...entity,
              items: serializeJson(entity.items),
              hiddenCardIds: entity.hiddenCardIds ? serializeJson(entity.hiddenCardIds) : null,
              themeOverride: entity.themeOverride ?? null,
              userId: entity.userId ?? null,
              workspaceId: entity.workspaceId ?? null,
            })
          return entity
        }

        const next: DashboardLayout = {
          ...existing,
          ...data,
          updatedAt: now(),
        }

        database
          .prepare(
            `UPDATE dashboard_layout SET
               items=@items,
               hiddenCardIds=@hiddenCardIds,
               themeOverride=@themeOverride,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            items: serializeJson(next.items),
            hiddenCardIds: next.hiddenCardIds ? serializeJson(next.hiddenCardIds) : null,
            themeOverride: next.themeOverride ?? null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    lifeDashboard: {
      async get() {
        const row = database.prepare('SELECT * FROM life_dashboard_layout WHERE id = ? LIMIT 1').get(LIFE_DASHBOARD_LAYOUT_ID) as
          | Record<string, unknown>
          | undefined
        return row ? toLifeDashboardLayout(row) : null
      },
      async upsert(data: LifeDashboardLayoutUpsertInput) {
        const existing = await service.lifeDashboard.get()
        if (!existing) {
          const entity: LifeDashboardLayout = { id: LIFE_DASHBOARD_LAYOUT_ID, createdAt: now(), updatedAt: now(), ...data }
          database
            .prepare(
              `INSERT INTO life_dashboard_layout
               (id, items, hiddenCardIds, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @items, @hiddenCardIds, @createdAt, @updatedAt, @userId, @workspaceId)`,
            )
            .run({
              ...entity,
              items: serializeJson(entity.items),
              hiddenCardIds: entity.hiddenCardIds ? serializeJson(entity.hiddenCardIds) : null,
              userId: entity.userId ?? null,
              workspaceId: entity.workspaceId ?? null,
            })
          return entity
        }
        const next: LifeDashboardLayout = { ...existing, ...data, updatedAt: now() }
        database
          .prepare(
            `UPDATE life_dashboard_layout SET
               items=@items,
               hiddenCardIds=@hiddenCardIds,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            items: serializeJson(next.items),
            hiddenCardIds: next.hiddenCardIds ? serializeJson(next.hiddenCardIds) : null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
    },
    books: {
      async list() {
        const rows = database.prepare('SELECT * FROM books ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toBookItem)
      },
      async create(data: BookCreateInput) {
        const entity: BookItem = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO books
             (id, source, sourceId, title, authors, status, progress, coverUrl, description, publisher, publishedDate, subjects, summary, outline, reflection, isbn10, isbn13, openLibraryKey, googleBooksId, doi, lastSyncedAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @source, @sourceId, @title, @authors, @status, @progress, @coverUrl, @description, @publisher, @publishedDate, @subjects, @summary, @outline, @reflection, @isbn10, @isbn13, @openLibraryKey, @googleBooksId, @doi, @lastSyncedAt, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            authors: serializeJson(entity.authors),
            subjects: serializeJson(entity.subjects),
            outline: entity.outline ? serializeJson(entity.outline) : null,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch) {
        const row = database.prepare('SELECT * FROM books WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: BookItem = { ...toBookItem(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE books SET
               source=@source,
               sourceId=@sourceId,
               title=@title,
               authors=@authors,
               status=@status,
               progress=@progress,
               coverUrl=@coverUrl,
               description=@description,
               publisher=@publisher,
               publishedDate=@publishedDate,
               subjects=@subjects,
               summary=@summary,
               outline=@outline,
               reflection=@reflection,
               isbn10=@isbn10,
               isbn13=@isbn13,
               openLibraryKey=@openLibraryKey,
               googleBooksId=@googleBooksId,
               doi=@doi,
               lastSyncedAt=@lastSyncedAt,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            authors: serializeJson(next.authors),
            subjects: serializeJson(next.subjects),
            outline: next.outline ? serializeJson(next.outline) : null,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM books WHERE id = ?').run(id)
      },
    },
    media: {
      async list() {
        const rows = database.prepare('SELECT * FROM media ORDER BY CASE WHEN status = \'watching\' THEN 0 ELSE 1 END, updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toMediaItem)
      },
      async create(data: MediaCreateInput) {
        const entity: MediaItem = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO media
             (id, source, sourceId, tmdbId, mediaType, title, originalTitle, status, progress, posterUrl, backdropUrl, overview, releaseDate, director, creator, cast, genres, duration, seasons, episodes, country, language, rating, watchedEpisodes, reflection, voteAverage, lastSyncedAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @source, @sourceId, @tmdbId, @mediaType, @title, @originalTitle, @status, @progress, @posterUrl, @backdropUrl, @overview, @releaseDate, @director, @creator, @cast, @genres, @duration, @seasons, @episodes, @country, @language, @rating, @watchedEpisodes, @reflection, @voteAverage, @lastSyncedAt, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            cast: serializeJson(entity.cast),
            genres: serializeJson(entity.genres),
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: MediaUpdateInput) {
        const row = database.prepare('SELECT * FROM media WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: MediaItem = { ...toMediaItem(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE media SET
               source=@source,
               sourceId=@sourceId,
               tmdbId=@tmdbId,
               mediaType=@mediaType,
               title=@title,
               originalTitle=@originalTitle,
               status=@status,
               progress=@progress,
               posterUrl=@posterUrl,
               backdropUrl=@backdropUrl,
               overview=@overview,
               releaseDate=@releaseDate,
               director=@director,
               creator=@creator,
               cast=@cast,
               genres=@genres,
               duration=@duration,
               seasons=@seasons,
               episodes=@episodes,
               country=@country,
               language=@language,
               rating=@rating,
               watchedEpisodes=@watchedEpisodes,
               reflection=@reflection,
               voteAverage=@voteAverage,
               lastSyncedAt=@lastSyncedAt,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            cast: serializeJson(next.cast),
            genres: serializeJson(next.genres),
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM media WHERE id = ?').run(id)
      },
    },
    stocks: {
      async list() {
        const rows = database.prepare('SELECT * FROM stocks ORDER BY pinned DESC, updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toStockItem)
      },
      async create(data: StockCreateInput) {
        const entity: StockItem = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO stocks
             (id, symbol, name, exchange, currency, lastPrice, change, changePercent, chartPoints, note, pinned, lastSyncedAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @symbol, @name, @exchange, @currency, @lastPrice, @change, @changePercent, @chartPoints, @note, @pinned, @lastSyncedAt, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            chartPoints: entity.chartPoints ? serializeJson(entity.chartPoints) : null,
            pinned: entity.pinned ? 1 : 0,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: StockUpdateInput) {
        const row = database.prepare('SELECT * FROM stocks WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: StockItem = { ...toStockItem(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE stocks SET
               symbol=@symbol,
               name=@name,
               exchange=@exchange,
               currency=@currency,
               lastPrice=@lastPrice,
               change=@change,
               changePercent=@changePercent,
               chartPoints=@chartPoints,
               note=@note,
               pinned=@pinned,
               lastSyncedAt=@lastSyncedAt,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            chartPoints: next.chartPoints ? serializeJson(next.chartPoints) : null,
            pinned: next.pinned ? 1 : 0,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM stocks WHERE id = ?').run(id)
      },
    },
    lifeSubscriptions: {
      async list() {
        const rows = database.prepare('SELECT * FROM life_subscriptions ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toLifeSubscription)
      },
      async create(data: LifeSubscriptionCreateInput) {
        const entity: LifeSubscription = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO life_subscriptions
             (id, name, amount, currency, cycle, color, category, billingDay, billingMonth, emoji, reminder, paymentStatus, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @name, @amount, @currency, @cycle, @color, @category, @billingDay, @billingMonth, @emoji, @reminder, @paymentStatus, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            reminder: entity.reminder ? 1 : 0,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: LifeSubscriptionUpdateInput) {
        const row = database.prepare('SELECT * FROM life_subscriptions WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: LifeSubscription = { ...toLifeSubscription(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE life_subscriptions SET
               name=@name,
               amount=@amount,
               currency=@currency,
               cycle=@cycle,
               color=@color,
               category=@category,
               billingDay=@billingDay,
               billingMonth=@billingMonth,
               emoji=@emoji,
               reminder=@reminder,
               paymentStatus=@paymentStatus,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            reminder: next.reminder ? 1 : 0,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM life_subscriptions WHERE id = ?').run(id)
      },
    },
    lifePodcasts: {
      async list() {
        const rows = database.prepare('SELECT * FROM life_podcasts ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toLifePodcast)
      },
      async create(data: LifePodcastCreateInput) {
        const entity: LifePodcast = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO life_podcasts
             (id, source, sourceId, collectionId, name, author, artworkUrl, feedUrl, primaryGenre, releaseDate, country, coverColor, coverEmoji, episodes, selectedEpisodeId, isPlaying, lastSyncedAt, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @source, @sourceId, @collectionId, @name, @author, @artworkUrl, @feedUrl, @primaryGenre, @releaseDate, @country, @coverColor, @coverEmoji, @episodes, @selectedEpisodeId, @isPlaying, @lastSyncedAt, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            episodes: serializeJson(entity.episodes ?? []),
            isPlaying: entity.isPlaying ? 1 : 0,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: LifePodcastUpdateInput) {
        const row = database.prepare('SELECT * FROM life_podcasts WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: LifePodcast = { ...toLifePodcast(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE life_podcasts SET
               source=@source,
               sourceId=@sourceId,
               collectionId=@collectionId,
               name=@name,
               author=@author,
               artworkUrl=@artworkUrl,
               feedUrl=@feedUrl,
               primaryGenre=@primaryGenre,
               releaseDate=@releaseDate,
               country=@country,
               coverColor=@coverColor,
               coverEmoji=@coverEmoji,
               episodes=@episodes,
               selectedEpisodeId=@selectedEpisodeId,
               isPlaying=@isPlaying,
               lastSyncedAt=@lastSyncedAt,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            episodes: serializeJson(next.episodes ?? []),
            isPlaying: next.isPlaying ? 1 : 0,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM life_podcasts WHERE id = ?').run(id)
      },
    },
    lifePeople: {
      async list() {
        const rows = database.prepare('SELECT * FROM life_people ORDER BY updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toLifePerson)
      },
      async create(data: LifePersonCreateInput) {
        const entity: LifePerson = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO life_people
             (id, name, "group", role, city, notes, birthday, lastInteraction, avatarInitials, avatarColor, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @name, @group, @role, @city, @notes, @birthday, @lastInteraction, @avatarInitials, @avatarColor, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: LifePersonUpdateInput) {
        const row = database.prepare('SELECT * FROM life_people WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: LifePerson = { ...toLifePerson(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE life_people SET
               name=@name,
               "group"=@group,
               role=@role,
               city=@city,
               notes=@notes,
               birthday=@birthday,
               lastInteraction=@lastInteraction,
               avatarInitials=@avatarInitials,
               avatarColor=@avatarColor,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM life_people WHERE id = ?').run(id)
      },
    },
    trips: {
      async list() {
        const rows = database.prepare('SELECT * FROM trips ORDER BY startDate ASC, updatedAt DESC').all() as Record<string, unknown>[]
        return rows.map(toTripRecord)
      },
      async create(data: TripCreateInput) {
        const entity: TripRecord = { id: createId(), createdAt: now(), updatedAt: now(), ...data }
        database
          .prepare(
            `INSERT INTO trips
             (id, title, destination, startDate, endDate, status, travelers, budgetPlanned, budgetCurrency, heroImage, coverEmoji, itinerary, transport, stays, food, budget, checklist, notes, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @title, @destination, @startDate, @endDate, @status, @travelers, @budgetPlanned, @budgetCurrency, @heroImage, @coverEmoji, @itinerary, @transport, @stays, @food, @budget, @checklist, @notes, @createdAt, @updatedAt, @userId, @workspaceId)`,
          )
          .run({
            ...entity,
            itinerary: serializeJson(entity.itinerary),
            transport: serializeJson(entity.transport),
            stays: serializeJson(entity.stays),
            food: serializeJson(entity.food),
            budget: serializeJson(entity.budget),
            checklist: serializeJson(entity.checklist),
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
          })
        return entity
      },
      async update(id: string, patch: TripUpdateInput) {
        const row = database.prepare('SELECT * FROM trips WHERE id = ? LIMIT 1').get(id) as Record<string, unknown> | undefined
        if (!row) return undefined
        const next: TripRecord = { ...toTripRecord(row), ...patch, id, updatedAt: now() }
        database
          .prepare(
            `UPDATE trips SET
               title=@title,
               destination=@destination,
               startDate=@startDate,
               endDate=@endDate,
               status=@status,
               travelers=@travelers,
               budgetPlanned=@budgetPlanned,
               budgetCurrency=@budgetCurrency,
               heroImage=@heroImage,
               coverEmoji=@coverEmoji,
               itinerary=@itinerary,
               transport=@transport,
               stays=@stays,
               food=@food,
               budget=@budget,
               checklist=@checklist,
               notes=@notes,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`,
          )
          .run({
            ...next,
            itinerary: serializeJson(next.itinerary),
            transport: serializeJson(next.transport),
            stays: serializeJson(next.stays),
            food: serializeJson(next.food),
            budget: serializeJson(next.budget),
            checklist: serializeJson(next.checklist),
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id: string) {
        database.prepare('DELETE FROM trips WHERE id = ?').run(id)
      },
    },
  }

  const upsertIfNewer = <T extends { id: string; updatedAt: number }>(
    table: string,
    entity: T,
    runInsertOrUpdate: (value: T) => void
  ) => {
    const current = database.prepare(`SELECT updatedAt FROM ${table} WHERE id = ? LIMIT 1`).get(entity.id) as
      | { updatedAt: number }
      | undefined
    if (!current || entity.updatedAt >= current.updatedAt) {
      runInsertOrUpdate(entity)
      return true
    }
    return false
  }

  const importFromDexieJson = (jsonContent: string) => {
    const backupDir = path.join(path.dirname(dbPath), 'backups')
    mkdirSync(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `focus-go-${Date.now()}.db.bak`)
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, backupPath)
    }

    const raw = JSON.parse(jsonContent) as DexieDump
    let importedRows = 0

    const tx = database.transaction(() => {
      for (const item of raw.tasks ?? []) {
        const entity: TaskItem = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('tasks', entity, (value) => {
          database
            .prepare(
              `INSERT INTO tasks
               (id, title, description, pinned, status, priority, dueDate, startDate, endDate, reminderAt, reminderFiredAt, tags, subtasks, taskNoteBlocks, taskNoteContentMd, taskNoteContentJson, progressLogs, activityLogs, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @title, @description, @pinned, @status, @priority, @dueDate, @startDate, @endDate, @reminderAt, @reminderFiredAt, @tags, @subtasks, @taskNoteBlocks, @taskNoteContentMd, @taskNoteContentJson, @progressLogs, @activityLogs, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 title=excluded.title,
                 description=excluded.description,
                 pinned=excluded.pinned,
                 status=excluded.status,
                 priority=excluded.priority,
                 dueDate=excluded.dueDate,
                 startDate=excluded.startDate,
                 endDate=excluded.endDate,
                 reminderAt=excluded.reminderAt,
                 reminderFiredAt=excluded.reminderFiredAt,
                 tags=excluded.tags,
                 subtasks=excluded.subtasks,
                 taskNoteBlocks=excluded.taskNoteBlocks,
                 taskNoteContentMd=excluded.taskNoteContentMd,
                 taskNoteContentJson=excluded.taskNoteContentJson,
                 progressLogs=excluded.progressLogs,
                 activityLogs=excluded.activityLogs,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              description: value.description ?? '',
              pinned: value.pinned ? 1 : 0,
              dueDate: value.dueDate ?? null,
              startDate: value.startDate ?? null,
              endDate: value.endDate ?? null,
              reminderAt: value.reminderAt ?? null,
              reminderFiredAt: value.reminderFiredAt ?? null,
              tags: serializeJson(value.tags ?? []),
              subtasks: serializeJson(value.subtasks ?? []),
              taskNoteBlocks: serializeJson(value.taskNoteBlocks ?? []),
              taskNoteContentMd: value.taskNoteContentMd ?? null,
              taskNoteContentJson: serializeJson(value.taskNoteContentJson ?? null),
              progressLogs: serializeJson(value.progressLogs ?? []),
              activityLogs: serializeJson(value.activityLogs ?? []),
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.widgetTodos ?? []) {
        const entity: WidgetTodo = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('widget_todos', entity, (value) => {
          database
            .prepare(
              `INSERT INTO widget_todos
               (id, scope, title, priority, dueDate, done, linkedHabitId, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @scope, @title, @priority, @dueDate, @done, @linkedHabitId, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 scope=excluded.scope,
                 title=excluded.title,
                 priority=excluded.priority,
                 dueDate=excluded.dueDate,
                 done=excluded.done,
                 linkedHabitId=excluded.linkedHabitId,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              dueDate: value.dueDate ?? null,
              done: value.done ? 1 : 0,
              linkedHabitId: value.linkedHabitId ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.habits ?? []) {
        const entity: Habit = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('habits', entity, (value) => {
          database
            .prepare(
              `INSERT INTO habits
               (id, userId, title, description, icon, type, color, archived, target, freezesAllowed, sortOrder, createdAt, updatedAt, workspaceId)
               VALUES (@id, @userId, @title, @description, @icon, @type, @color, @archived, @target, @freezesAllowed, @sortOrder, @createdAt, @updatedAt, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 userId=excluded.userId,
                 title=excluded.title,
                 description=excluded.description,
                 icon=excluded.icon,
                 type=excluded.type,
                 color=excluded.color,
                 archived=excluded.archived,
                 target=excluded.target,
                 freezesAllowed=excluded.freezesAllowed,
                 sortOrder=excluded.sortOrder,
                 updatedAt=excluded.updatedAt,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              description: value.description ?? null,
              icon: value.icon ?? null,
              archived: value.archived ? 1 : 0,
              target: value.target ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.habitLogs ?? []) {
        const entity: HabitLog = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('habit_logs', entity, (value) => {
          database
            .prepare(
              `INSERT INTO habit_logs
               (id, userId, habitId, dateKey, value, status, createdAt, updatedAt, workspaceId)
               VALUES (@id, @userId, @habitId, @dateKey, @value, @status, @createdAt, @updatedAt, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 userId=excluded.userId,
                 habitId=excluded.habitId,
                 dateKey=excluded.dateKey,
                 value=excluded.value,
                 status=excluded.status,
                 updatedAt=excluded.updatedAt,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              value: value.value ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.diaryEntries ?? []) {
        const entity: DiaryEntry = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('diary_entries', entity, (value) => {
          database
            .prepare(
              `INSERT INTO diary_entries
               (id, dateKey, contentMd, tags, deletedAt, expiredAt, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @dateKey, @contentMd, @tags, @deletedAt, @expiredAt, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 dateKey=excluded.dateKey,
                 contentMd=excluded.contentMd,
                 tags=excluded.tags,
                 deletedAt=excluded.deletedAt,
                 expiredAt=excluded.expiredAt,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              tags: serializeJson(value.tags ?? []),
              deletedAt: value.deletedAt ?? null,
              expiredAt: value.expiredAt ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.spends ?? []) {
        const entity: SpendEntry = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('spends', entity, (value) => {
          database
            .prepare(
              `INSERT INTO spends
               (id, amount, currency, categoryId, note, dateKey, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @amount, @currency, @categoryId, @note, @dateKey, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 amount=excluded.amount,
                 currency=excluded.currency,
                 categoryId=excluded.categoryId,
                 note=excluded.note,
                 dateKey=excluded.dateKey,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              note: value.note ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.spendCategories ?? []) {
        const entity: SpendCategory = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('spend_categories', entity, (value) => {
          database
            .prepare(
              `INSERT INTO spend_categories
               (id, name, icon, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @name, @icon, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 name=excluded.name,
                 icon=excluded.icon,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              icon: value.icon ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.focusSettings ?? []) {
        const entity: FocusSettings = { ...item, id: item.id || FOCUS_SETTINGS_ID }
        const changed = upsertIfNewer('focus_settings', entity, (value) => {
          database
            .prepare(
              `INSERT INTO focus_settings
               (id, focusMinutes, breakMinutes, longBreakMinutes, noise, noisePreset, volume, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @focusMinutes, @breakMinutes, @longBreakMinutes, @noise, @noisePreset, @volume, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 focusMinutes=excluded.focusMinutes,
                 breakMinutes=excluded.breakMinutes,
                 longBreakMinutes=excluded.longBreakMinutes,
                 noise=excluded.noise,
                 noisePreset=excluded.noisePreset,
                 volume=excluded.volume,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              noise: value.noise ? serializeJson(value.noise) : null,
              noisePreset: value.noisePreset ? serializeJson(value.noisePreset) : null,
              volume: value.volume ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.focusSessions ?? []) {
        const entity: FocusSession = { ...item, id: item.id || createId() }
        const changed = upsertIfNewer('focus_sessions', entity, (value) => {
          database
            .prepare(
              `INSERT INTO focus_sessions
               (id, taskId, goal, plannedMinutes, actualMinutes, status, completedAt, interruptedAt, interruptionReason, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @taskId, @goal, @plannedMinutes, @actualMinutes, @status, @completedAt, @interruptedAt, @interruptionReason, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 taskId=excluded.taskId,
                 goal=excluded.goal,
                 plannedMinutes=excluded.plannedMinutes,
                 actualMinutes=excluded.actualMinutes,
                 status=excluded.status,
                 completedAt=excluded.completedAt,
                 interruptedAt=excluded.interruptedAt,
                 interruptionReason=excluded.interruptionReason,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              taskId: value.taskId ?? null,
              goal: value.goal ?? null,
              actualMinutes: value.actualMinutes ?? null,
              completedAt: value.completedAt ?? null,
              interruptedAt: value.interruptedAt ?? null,
              interruptionReason: value.interruptionReason ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }

      for (const item of raw.dashboardLayout ?? []) {
        const entity: DashboardLayout = { ...item, id: item.id || DASHBOARD_LAYOUT_ID }
        const changed = upsertIfNewer('dashboard_layout', entity, (value) => {
          database
            .prepare(
              `INSERT INTO dashboard_layout
               (id, items, hiddenCardIds, themeOverride, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @items, @hiddenCardIds, @themeOverride, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 items=excluded.items,
                 hiddenCardIds=excluded.hiddenCardIds,
                 themeOverride=excluded.themeOverride,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              items: serializeJson(value.items ?? []),
              hiddenCardIds: value.hiddenCardIds ? serializeJson(value.hiddenCardIds) : null,
              themeOverride: value.themeOverride ?? null,
              userId: value.userId ?? null,
              workspaceId: value.workspaceId ?? null,
            })
        })
        if (changed) importedRows += 1
      }
    })

    tx()

    return {
      backupPath,
      importedRows,
    }
  }

  return {
    service,
    dbPath,
    importFromDexieJson,
    close: () => {
      database.close()
    },
  }
}

export const resolveDesktopDbPath = (userDataDir: string) => path.join(userDataDir, 'focus-go.sqlite3')
