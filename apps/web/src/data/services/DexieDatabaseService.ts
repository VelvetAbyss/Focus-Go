import type {
  TripCreateInput,
  TripUpdateInput,
  LifePodcastCreateInput,
  LifePodcastUpdateInput,
  LifePersonCreateInput,
  LifePersonUpdateInput,
  MediaCreateInput,
  MediaUpdateInput,
  IDatabaseService,
  LifeSubscriptionCreateInput,
  LifeSubscriptionUpdateInput,
  NoteAppearanceUpsertInput,
  NoteCreateInput,
  NoteTagCreateInput,
  NoteTagUpdateInput,
  NoteUpdateInput,
  TaskCreateInput,
} from '@focus-go/core'
import { db } from '../db'
import type {
  BookItem,
  DashboardLayout,
  DiaryEntry,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  HabitStatus,
  LifeDashboardLayout,
  LifePodcast,
  LifePerson,
  LifeSubscription,
  MediaItem,
  NoteAppearanceSettings,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  StockItem,
  TaskItem,
  TaskStatus,
  TripRecord,
  WidgetTodo,
  WidgetTodoScope,
} from '../models/types'
import { touch, withBase } from '../repositories/base'
import { createId } from '../../shared/utils/ids'
import { areTaskNoteBlocksEqual, normalizeTaskNoteBlocks } from '../../features/tasks/model/taskNote'
import { resolveTaskNoteRichText } from '../../features/tasks/model/taskNoteRichText'
import { enqueueSyncOperation } from '../sync/repository'

const statusLabelMap: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

const DEFAULT_NOTE_COLLECTION = 'all-notes' as const
const NOTE_APPEARANCE_ID = 'note_appearance' as const
const NOTE_TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const LIFE_DASHBOARD_ID = 'life_dashboard_layout' as const
const normalizeTags = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []

const buildNoteExcerpt = (contentMd: string) => {
  const compact = contentMd.replace(/\s+/g, ' ').trim()
  if (!compact) return ''
  return compact.length > 160 ? `${compact.slice(0, 160)}…` : compact
}

const countMatches = (content: string, pattern: RegExp) => (content.match(pattern) ?? []).length

const slugifyHeading = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')

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
      id: slugifyHeading(match[2]),
    }))

  return {
    wordCount: words.length,
    charCount: content.length,
    paragraphCount: paragraphs.length,
    imageCount: countMatches(content, /!\[[^\]]*\]\([^)]+\)/g),
    fileCount: countMatches(content, /\battachment:\b/gi),
    headings,
  }
}

const buildNoteBacklinks = (note: Pick<NoteItem, 'id' | 'title'>, allNotes: NoteItem[]) =>
  allNotes
    .filter((candidate) => candidate.id !== note.id && candidate.contentMd.toLowerCase().includes(note.title.trim().toLowerCase()))
    .map((candidate) => ({ noteId: candidate.id, noteTitle: candidate.title.trim() || 'Untitled' }))

const purgeExpiredTrashedNotes = async () => {
  const threshold = Date.now() - NOTE_TRASH_RETENTION_MS
  const rows = await db.notes.toArray()
  const expiredIds = rows
    .filter((row) => typeof row.deletedAt === 'number' && row.deletedAt > 0 && row.deletedAt < threshold)
    .map((row) => row.id)
  if (expiredIds.length > 0) {
    await db.notes.bulkDelete(expiredIds)
  }
}

const normalizeNoteFontFamily = (font?: string | null): NoteAppearanceSettings['font'] => {
  if (font === 'humanistSans' || font === 'cnSans' || font === 'serif' || font === 'cnSerif' || font === 'mono') {
    return font
  }
  if (font === 'sans') return 'uiSans'
  return 'uiSans'
}

const normalizeNoteAppearance = (value?: Partial<NoteAppearanceSettings> | null): NoteAppearanceSettings =>
  withBase({
    id: NOTE_APPEARANCE_ID,
    theme: value?.theme === 'graphite' ? 'graphite' : 'paper',
    font: value?.font ? normalizeNoteFontFamily(value.font) : 'serif',
    fontSize: typeof value?.fontSize === 'number' ? value.fontSize : 16,
    lineHeight: typeof value?.lineHeight === 'number' ? value.lineHeight : 1.8,
    contentWidth: typeof value?.contentWidth === 'number' ? value.contentWidth : 60,
    focusMode: value?.focusMode === true,
  } as NoteAppearanceSettings)

const normalizeNoteTag = (value: NoteTag): NoteTag => ({
  ...value,
  name: typeof value.name === 'string' ? value.name : '',
  icon: typeof value.icon === 'string' && value.icon ? value.icon : undefined,
  pinned: value.pinned === true,
  parentId: typeof value.parentId === 'string' && value.parentId ? value.parentId : null,
  noteCount: typeof value.noteCount === 'number' ? value.noteCount : 0,
  sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
})

const normalizeNote = (note: NoteItem): NoteItem => ({
  ...note,
  title: typeof note.title === 'string' ? note.title : '',
  contentMd: typeof note.contentMd === 'string' ? note.contentMd : '',
  contentJson: note.contentJson && typeof note.contentJson === 'object' ? note.contentJson : null,
  editorMode: 'document',
  collection: note.collection ?? DEFAULT_NOTE_COLLECTION,
  tags: normalizeTags(note.tags),
  pinned: note.pinned === true,
  excerpt:
    typeof note.excerpt === 'string' && note.excerpt.trim().length > 0
      ? note.excerpt.trim()
      : buildNoteExcerpt(typeof note.contentMd === 'string' ? note.contentMd : ''),
  wordCount:
    typeof note.wordCount === 'number'
      ? note.wordCount
      : buildNoteStats(note.contentMd).wordCount,
  charCount:
    typeof note.charCount === 'number'
      ? note.charCount
      : buildNoteStats(note.contentMd).charCount,
  paragraphCount:
    typeof note.paragraphCount === 'number'
      ? note.paragraphCount
      : buildNoteStats(note.contentMd).paragraphCount,
  imageCount:
    typeof note.imageCount === 'number'
      ? note.imageCount
      : buildNoteStats(note.contentMd).imageCount,
  fileCount:
    typeof note.fileCount === 'number'
      ? note.fileCount
      : buildNoteStats(note.contentMd).fileCount,
  headings: Array.isArray(note.headings) ? note.headings : buildNoteStats(note.contentMd).headings,
  backlinks: Array.isArray(note.backlinks) ? note.backlinks : [],
  deletedAt: typeof note.deletedAt === 'number' && Number.isFinite(note.deletedAt) ? note.deletedAt : null,
})

const normalizeTask = (task: TaskItem): TaskItem => {
  const taskNote = resolveTaskNoteRichText({
    taskNoteBlocks: normalizeTaskNoteBlocks((task as { taskNoteBlocks?: unknown }).taskNoteBlocks, (task as { note?: unknown }).note),
    taskNoteContentJson: (task as { taskNoteContentJson?: TaskItem['taskNoteContentJson'] }).taskNoteContentJson,
    taskNoteContentMd: (task as { taskNoteContentMd?: TaskItem['taskNoteContentMd'] }).taskNoteContentMd,
  })

  return {
    ...task,
    title: typeof task.title === 'string' ? task.title.trim() : '',
    description: typeof task.description === 'string' ? task.description : '',
    pinned: task.pinned === true,
    isToday: task.isToday === true,
    dueDate: typeof task.dueDate === 'string' && task.dueDate ? task.dueDate : undefined,
    startDate: typeof task.startDate === 'string' && task.startDate ? task.startDate : undefined,
    endDate: typeof task.endDate === 'string' && task.endDate ? task.endDate : undefined,
    reminderAt: typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt) ? task.reminderAt : undefined,
    reminderFiredAt:
      typeof task.reminderFiredAt === 'number' && Number.isFinite(task.reminderFiredAt) ? task.reminderFiredAt : undefined,
    tags: Array.isArray(task.tags) ? task.tags : [],
    subtasks: Array.isArray(task.subtasks)
      ? task.subtasks.map((subtask) => ({
          ...subtask,
          title: typeof subtask.title === 'string' ? subtask.title.trim() : '',
          done: subtask.done === true,
        }))
      : [],
    taskNoteBlocks: [],
    taskNoteContentMd: taskNote.contentMd,
    taskNoteContentJson: taskNote.contentJson as TaskItem['taskNoteContentJson'],
    activityLogs: Array.isArray(task.activityLogs) ? task.activityLogs : [],
  }
}

const normalizeBook = (book: BookItem): BookItem => ({
  ...book,
  source: book.source ?? 'manual',
  sourceId: typeof book.sourceId === 'string' && book.sourceId ? book.sourceId : book.id,
  title: typeof book.title === 'string' ? book.title : '',
  authors: Array.isArray(book.authors) ? book.authors.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
  status: book.status ?? 'want-to-read',
  progress: typeof book.progress === 'number' ? Math.max(0, Math.min(100, book.progress)) : 0,
  subjects: Array.isArray(book.subjects) ? book.subjects.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
  outline: Array.isArray(book.outline) ? book.outline.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : undefined,
})

const normalizeMedia = (media: MediaItem): MediaItem => ({
  ...media,
  source: 'tmdb',
  sourceId: typeof media.sourceId === 'string' && media.sourceId ? media.sourceId : String(media.tmdbId ?? media.id),
  tmdbId: typeof media.tmdbId === 'number' && Number.isFinite(media.tmdbId) ? media.tmdbId : Number(media.sourceId ?? 0),
  mediaType: media.mediaType === 'tv' ? 'tv' : 'movie',
  title: typeof media.title === 'string' ? media.title : '',
  originalTitle: typeof media.originalTitle === 'string' && media.originalTitle.trim().length > 0 ? media.originalTitle : undefined,
  status: media.status ?? 'want-to-watch',
  progress: typeof media.progress === 'number' ? Math.max(0, Math.min(100, media.progress)) : 0,
  posterUrl: typeof media.posterUrl === 'string' && media.posterUrl ? media.posterUrl : undefined,
  backdropUrl: typeof media.backdropUrl === 'string' && media.backdropUrl ? media.backdropUrl : undefined,
  overview: typeof media.overview === 'string' && media.overview.trim().length > 0 ? media.overview : undefined,
  releaseDate: typeof media.releaseDate === 'string' && media.releaseDate ? media.releaseDate : undefined,
  director: typeof media.director === 'string' && media.director.trim().length > 0 ? media.director : undefined,
  creator: typeof media.creator === 'string' && media.creator.trim().length > 0 ? media.creator : undefined,
  cast: Array.isArray(media.cast) ? media.cast.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 10) : [],
  genres: Array.isArray(media.genres) ? media.genres.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 8) : [],
  duration: typeof media.duration === 'string' && media.duration.trim().length > 0 ? media.duration : undefined,
  seasons: typeof media.seasons === 'number' && Number.isFinite(media.seasons) ? Math.max(0, Math.round(media.seasons)) : undefined,
  episodes: typeof media.episodes === 'number' && Number.isFinite(media.episodes) ? Math.max(0, Math.round(media.episodes)) : undefined,
  country: typeof media.country === 'string' && media.country.trim().length > 0 ? media.country : undefined,
  language: typeof media.language === 'string' && media.language.trim().length > 0 ? media.language : undefined,
  rating: typeof media.rating === 'string' && media.rating.trim().length > 0 ? media.rating : undefined,
  watchedEpisodes:
    typeof media.watchedEpisodes === 'number' && Number.isFinite(media.watchedEpisodes)
      ? Math.max(0, Math.round(media.watchedEpisodes))
      : undefined,
  reflection: typeof media.reflection === 'string' ? media.reflection : undefined,
  voteAverage: typeof media.voteAverage === 'number' && Number.isFinite(media.voteAverage) ? media.voteAverage : undefined,
  lastSyncedAt: typeof media.lastSyncedAt === 'number' && Number.isFinite(media.lastSyncedAt) ? media.lastSyncedAt : undefined,
})

const normalizeStock = (stock: StockItem): StockItem => ({
  ...stock,
  symbol: typeof stock.symbol === 'string' ? stock.symbol.toUpperCase() : '',
  name: typeof stock.name === 'string' ? stock.name : '',
  currency: typeof stock.currency === 'string' && stock.currency ? stock.currency : 'USD',
  pinned: stock.pinned === true,
  chartPoints: Array.isArray(stock.chartPoints) ? stock.chartPoints.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)) : undefined,
})

const normalizeLifeSubscription = (subscription: LifeSubscription): LifeSubscription => ({
  ...subscription,
  name: typeof subscription.name === 'string' ? subscription.name.trim() : '',
  amount: typeof subscription.amount === 'number' && Number.isFinite(subscription.amount) ? Math.max(0, subscription.amount) : 0,
  currency: subscription.currency === 'CNY' ? 'CNY' : 'USD',
  cycle: subscription.cycle === 'yearly' ? 'yearly' : 'monthly',
  color: typeof subscription.color === 'string' && subscription.color.trim().length > 0 ? subscription.color : undefined,
  category: typeof subscription.category === 'string' && subscription.category.trim().length > 0 ? subscription.category : undefined,
  billingDay:
    typeof subscription.billingDay === 'number' && Number.isFinite(subscription.billingDay)
      ? Math.min(31, Math.max(1, Math.round(subscription.billingDay)))
      : undefined,
  billingMonth:
    typeof subscription.billingMonth === 'number' && Number.isFinite(subscription.billingMonth)
      ? Math.min(12, Math.max(1, Math.round(subscription.billingMonth)))
      : undefined,
  emoji: typeof subscription.emoji === 'string' && subscription.emoji.trim().length > 0 ? subscription.emoji.slice(0, 4) : undefined,
  reminder: subscription.reminder === true,
  paymentStatus: subscription.paymentStatus === 'paid' ? 'paid' : subscription.paymentStatus === 'unpaid' ? 'unpaid' : undefined,
})

const normalizeLifePodcast = (podcast: LifePodcast): LifePodcast => ({
  ...podcast,
  source: podcast.source === 'netease' ? 'netease' : 'itunes',
  sourceId: typeof podcast.sourceId === 'string' && podcast.sourceId ? podcast.sourceId : String(podcast.collectionId ?? podcast.id),
  collectionId: typeof podcast.collectionId === 'number' && Number.isFinite(podcast.collectionId) ? podcast.collectionId : Number(podcast.sourceId ?? 0),
  name: typeof podcast.name === 'string' ? podcast.name.trim() : '',
  author: typeof podcast.author === 'string' ? podcast.author.trim() : '',
  artworkUrl: typeof podcast.artworkUrl === 'string' && podcast.artworkUrl ? podcast.artworkUrl : undefined,
  feedUrl: typeof podcast.feedUrl === 'string' && podcast.feedUrl ? podcast.feedUrl : undefined,
  primaryGenre: typeof podcast.primaryGenre === 'string' && podcast.primaryGenre.trim().length > 0 ? podcast.primaryGenre : undefined,
  releaseDate: typeof podcast.releaseDate === 'string' && podcast.releaseDate ? podcast.releaseDate : undefined,
  country: typeof podcast.country === 'string' && podcast.country.trim().length > 0 ? podcast.country : undefined,
  coverColor: typeof podcast.coverColor === 'string' && podcast.coverColor ? podcast.coverColor : undefined,
  coverEmoji: typeof podcast.coverEmoji === 'string' && podcast.coverEmoji ? podcast.coverEmoji : undefined,
  selectedEpisodeId: typeof podcast.selectedEpisodeId === 'string' && podcast.selectedEpisodeId ? podcast.selectedEpisodeId : undefined,
  isPlaying: podcast.isPlaying === true,
  lastSyncedAt: typeof podcast.lastSyncedAt === 'number' && Number.isFinite(podcast.lastSyncedAt) ? podcast.lastSyncedAt : undefined,
  episodes: Array.isArray(podcast.episodes)
    ? podcast.episodes
        .filter((episode): episode is LifePodcast['episodes'][number] => Boolean(episode) && typeof episode.id === 'string')
        .map((episode) => ({
          id: episode.id,
          title: typeof episode.title === 'string' ? episode.title.trim() : '',
          description: typeof episode.description === 'string' && episode.description.trim().length > 0 ? episode.description : undefined,
          duration: typeof episode.duration === 'string' && episode.duration.trim().length > 0 ? episode.duration : undefined,
          releaseDate: typeof episode.releaseDate === 'string' && episode.releaseDate ? episode.releaseDate : undefined,
          audioUrl: typeof episode.audioUrl === 'string' && episode.audioUrl ? episode.audioUrl : undefined,
        }))
    : [],
})

const normalizeLifePerson = (person: LifePerson): LifePerson => ({
  ...person,
  name: typeof person.name === 'string' ? person.name.trim() : '',
  group: ['Family', 'Friends', 'Work', 'Community'].includes(person.group) ? person.group : 'Other',
  role: typeof person.role === 'string' && person.role.trim().length > 0 ? person.role : undefined,
  city: typeof person.city === 'string' && person.city.trim().length > 0 ? person.city : undefined,
  notes: typeof person.notes === 'string' ? person.notes : undefined,
  birthday: typeof person.birthday === 'string' && person.birthday ? person.birthday : undefined,
  lastInteraction: typeof person.lastInteraction === 'string' && person.lastInteraction ? person.lastInteraction : undefined,
  avatarInitials: typeof person.avatarInitials === 'string' && person.avatarInitials.trim().length > 0 ? person.avatarInitials.slice(0, 3).toUpperCase() : '',
  avatarColor: typeof person.avatarColor === 'string' && person.avatarColor ? person.avatarColor : undefined,
})

const normalizeTrip = (trip: TripRecord): TripRecord => ({
  ...trip,
  title: typeof trip.title === 'string' ? trip.title.trim() : '',
  destination: typeof trip.destination === 'string' ? trip.destination.trim() : '',
  startDate: typeof trip.startDate === 'string' ? trip.startDate : '',
  endDate: typeof trip.endDate === 'string' ? trip.endDate : '',
  status: trip.status ?? 'Planning',
  travelers: typeof trip.travelers === 'number' && Number.isFinite(trip.travelers) ? Math.max(1, Math.round(trip.travelers)) : 1,
  budgetPlanned: typeof trip.budgetPlanned === 'number' && Number.isFinite(trip.budgetPlanned) ? trip.budgetPlanned : 0,
  budgetCurrency: typeof trip.budgetCurrency === 'string' && trip.budgetCurrency ? trip.budgetCurrency : 'USD',
  heroImage: typeof trip.heroImage === 'string' ? trip.heroImage : '',
  coverEmoji: typeof trip.coverEmoji === 'string' ? trip.coverEmoji : '',
  itinerary: Array.isArray(trip.itinerary) ? trip.itinerary : [],
  transport: Array.isArray(trip.transport) ? trip.transport : [],
  stays: Array.isArray(trip.stays) ? trip.stays : [],
  food: Array.isArray(trip.food) ? trip.food : [],
  budget: Array.isArray(trip.budget) ? trip.budget : [],
  checklist: Array.isArray(trip.checklist) ? trip.checklist : [],
  notes: typeof trip.notes === 'string' ? trip.notes : '',
})

const MS_PER_DAY = 24 * 60 * 60 * 1000

const toDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

const moveDateKey = (dateKey: string, offset: number) => {
  const next = parseDateKey(dateKey)
  next.setDate(next.getDate() + offset)
  return toDateKey(next)
}

const enqueueUpsert = async <
  T extends
    | 'tasks'
    | 'notes'
    | 'noteTags'
    | 'noteAppearance'
    | 'widgetTodos'
    | 'focusSettings'
    | 'focusSessions'
    | 'diaryEntries'
    | 'spends'
    | 'spendCategories'
    | 'dashboardLayout'
    | 'habits'
    | 'habitLogs'
>(entityType: T, payload: { id: string; updatedAt: number } & Record<string, unknown>) => {
  await enqueueSyncOperation(entityType, 'upsert', payload)
}

const enqueueDelete = async <
  T extends
    | 'tasks'
    | 'notes'
    | 'noteTags'
    | 'widgetTodos'
    | 'diaryEntries'
    | 'spends'
    | 'habitLogs'
>(entityType: T, payload: { id: string; updatedAt: number } & Record<string, unknown>, deletedAt = payload.updatedAt) => {
  await enqueueSyncOperation(entityType, 'delete', { ...payload, deletedAt }, deletedAt)
}

export const createDexieDatabaseService = (): IDatabaseService => ({
  tasks: {
    async list() {
      const tasks = await db.tasks.toArray()
      const normalized = tasks.map((task) => normalizeTask(task))
      const changed = tasks.some((task, index) => {
        const next = normalized[index]
        return (
          task.description !== next.description ||
          task.pinned !== next.pinned ||
          task.isToday !== next.isToday ||
          task.dueDate !== next.dueDate ||
          task.startDate !== next.startDate ||
          task.endDate !== next.endDate ||
          task.reminderAt !== next.reminderAt ||
          task.reminderFiredAt !== next.reminderFiredAt ||
          task.tags !== next.tags ||
          task.subtasks !== next.subtasks ||
          !areTaskNoteBlocksEqual(normalizeTaskNoteBlocks((task as { taskNoteBlocks?: unknown }).taskNoteBlocks), next.taskNoteBlocks) ||
          JSON.stringify(task.taskNoteContentJson ?? null) !== JSON.stringify(next.taskNoteContentJson ?? null) ||
          task.taskNoteContentMd !== next.taskNoteContentMd ||
          task.activityLogs !== next.activityLogs
        )
      })
      if (changed) await db.tasks.bulkPut(normalized)
      return normalized
    },
    async add(data: TaskCreateInput) {
      const taskNote = resolveTaskNoteRichText({
        taskNoteBlocks: data.taskNoteBlocks,
        taskNoteContentJson: data.taskNoteContentJson,
        taskNoteContentMd: data.taskNoteContentMd,
      })
      const task: TaskItem = withBase({
        title: data.title,
        description: data.description ?? '',
        pinned: data.pinned === true,
        isToday: data.isToday === true,
        status: data.status,
        priority: data.priority ?? null,
        dueDate: data.dueDate,
        startDate: data.startDate,
        endDate: data.endDate,
        reminderAt: data.reminderAt,
        reminderFiredAt: data.reminderFiredAt,
        tags: data.tags ?? [],
        subtasks: data.subtasks ?? [],
        taskNoteBlocks: [],
        taskNoteContentMd: taskNote.contentMd,
        taskNoteContentJson: taskNote.contentJson as TaskItem['taskNoteContentJson'],
        activityLogs: [],
      })
      const now = Date.now()
      task.activityLogs = [
        {
          id: createId(),
          type: 'status' as const,
          message: `创建于${statusLabelMap[task.status]}`,
          createdAt: now,
        },
      ]
      await db.tasks.add(task)
      await enqueueUpsert('tasks', task)
      return task
    },
    async update(task) {
      const next = touch(normalizeTask(task as TaskItem))
      await db.tasks.put(next)
      await enqueueUpsert('tasks', next)
      return next
    },
    async remove(id) {
      const existing = await db.tasks.get(id)
      if (!existing) return
      const deletedAt = Date.now()
      await db.tasks.delete(id)
      await enqueueDelete('tasks', { id, updatedAt: deletedAt, title: existing.title }, deletedAt)
    },
    async updateStatus(id, status) {
      const task = await db.tasks.get(id)
      if (!task) return undefined
      const normalized = normalizeTask(task)
      if (normalized.status === status) return normalized
      const now = Date.now()
      const next = touch({
        ...normalized,
        status,
        activityLogs: [
          ...normalized.activityLogs,
          {
            id: createId(),
            type: 'status' as const,
              message: `状态变更为${statusLabelMap[status]}`,
            createdAt: now,
          },
        ],
      })
      await db.tasks.put(next)
      await enqueueUpsert('tasks', next)
      return next
    },
    async clearAllTags() {
      const tasks = await db.tasks.toArray()
      const tagged = tasks.map((task) => normalizeTask(task)).filter((task) => task.tags.length > 0)
      if (tagged.length === 0) return
      const nextRows = tagged.map((task) => touch({ ...task, tags: [] }))
      await db.tasks.bulkPut(nextRows)
      await Promise.all(nextRows.map((row) => enqueueUpsert('tasks', row)))
    },
  },
  notes: {
    async list() {
      await purgeExpiredTrashedNotes()
      const notes = await db.notes.toArray()
      const normalizedBase = notes.map((note) => normalizeNote(note))
      const normalized = normalizedBase
        .map((note) => ({
          ...note,
          backlinks: buildNoteBacklinks(note, normalizedBase),
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt)
      const changed = notes.some((note, index) => JSON.stringify(note) !== JSON.stringify(normalized[index]))
      if (changed) await db.notes.bulkPut(normalized)
      return normalized.filter((note) => !note.deletedAt)
    },
    async listTrash() {
      await purgeExpiredTrashedNotes()
      const notes = await db.notes.toArray()
      const normalizedBase = notes.map((note) => normalizeNote(note))
      const normalized = normalizedBase
        .map((note) => ({
          ...note,
          backlinks: buildNoteBacklinks(note, normalizedBase),
        }))
        .sort((left, right) => right.updatedAt - left.updatedAt)
      const changed = notes.some((note, index) => JSON.stringify(note) !== JSON.stringify(normalized[index]))
      if (changed) await db.notes.bulkPut(normalized)
      return normalized.filter((note) => Boolean(note.deletedAt))
    },
    async create(data?: NoteCreateInput) {
      const sourceText = data?.contentMd ?? ''
      const stats = buildNoteStats(sourceText)
      const note: NoteItem = withBase({
        title: data?.title ?? '',
        contentMd: data?.contentMd ?? '',
        contentJson: data?.contentJson ?? null,
        editorMode: 'document',
        collection: data?.collection ?? DEFAULT_NOTE_COLLECTION,
        tags: data?.tags ?? [],
        pinned: data?.pinned === true,
        excerpt: buildNoteExcerpt(sourceText),
        ...stats,
        headings: stats.headings,
        backlinks: data?.backlinks ?? [],
        deletedAt: null,
      })
      await db.notes.add(note)
      await enqueueUpsert('notes', note)
      return normalizeNote(note)
    },
    async update(id: string, patch: NoteUpdateInput) {
      const current = await db.notes.get(id)
      if (!current) return undefined
      const contentMd = patch.contentMd ?? current.contentMd
      const stats = buildNoteStats(contentMd)
      const next = touch(
        normalizeNote({
          ...current,
          ...patch,
          id,
          excerpt: typeof patch.excerpt === 'string' ? patch.excerpt : buildNoteExcerpt(patch.contentMd ?? current.contentMd),
          wordCount: typeof patch.wordCount === 'number' ? patch.wordCount : stats.wordCount,
          charCount: typeof patch.charCount === 'number' ? patch.charCount : stats.charCount,
          paragraphCount: typeof patch.paragraphCount === 'number' ? patch.paragraphCount : stats.paragraphCount,
          imageCount: typeof patch.imageCount === 'number' ? patch.imageCount : stats.imageCount,
          fileCount: typeof patch.fileCount === 'number' ? patch.fileCount : stats.fileCount,
          headings: Array.isArray(patch.headings) ? patch.headings : stats.headings,
          deletedAt: current.deletedAt ?? null,
        }),
      )
      await db.notes.put(next)
      await enqueueUpsert('notes', next)
      return next
    },
    async softDelete(id: string) {
      const current = await db.notes.get(id)
      if (!current) return undefined
      const next = touch({
        ...normalizeNote(current),
        deletedAt: Date.now(),
      })
      await db.notes.put(next)
      await enqueueUpsert('notes', next)
      return next
    },
    async restore(id: string) {
      const current = await db.notes.get(id)
      if (!current) return undefined
      const next = touch({
        ...normalizeNote(current),
        deletedAt: null,
      })
      await db.notes.put(next)
      await enqueueUpsert('notes', next)
      return next
    },
    async hardDelete(id: string) {
      const existing = await db.notes.get(id)
      if (!existing) return
      const deletedAt = Date.now()
      await db.notes.delete(id)
      await enqueueDelete('notes', { id, updatedAt: deletedAt, title: existing.title }, deletedAt)
    },
  },
  noteTags: {
    async list() {
      const [rows, notes] = await Promise.all([db.noteTags.orderBy('sortOrder').toArray(), db.notes.toArray()])
      const activeNotes = notes.map((row) => normalizeNote(row)).filter((note) => !note.deletedAt)
      const noteCountByName = new Map<string, number>()
      for (const note of activeNotes) {
        for (const tagName of note.tags) {
          noteCountByName.set(tagName, (noteCountByName.get(tagName) ?? 0) + 1)
        }
      }
      const normalized = rows.map((row) => {
        const next = normalizeNoteTag(row)
        return { ...next, noteCount: noteCountByName.get(next.name) ?? 0 }
      })
      const changed = rows.some((row, index) => JSON.stringify(row) !== JSON.stringify(normalized[index]))
      if (changed) await db.noteTags.bulkPut(normalized)
      return normalized
    },
    async create(data: NoteTagCreateInput) {
      const tag = withBase({
        name: data.name,
        icon: data.icon,
        pinned: data.pinned === true,
        parentId: data.parentId ?? null,
        noteCount: 0,
        sortOrder: data.sortOrder ?? 0,
      } satisfies Omit<NoteTag, 'id' | 'createdAt' | 'updatedAt'>)
      await db.noteTags.add(tag)
      await enqueueUpsert('noteTags', tag)
      return normalizeNoteTag(tag)
    },
    async update(id: string, patch: NoteTagUpdateInput) {
      const current = await db.noteTags.get(id)
      if (!current) return undefined
      const next = touch(
        normalizeNoteTag({
          ...current,
          ...patch,
          id,
        } as NoteTag),
      )
      await db.noteTags.put(next)
      await enqueueUpsert('noteTags', next)
      return next
    },
    async remove(id: string) {
      const existing = await db.noteTags.get(id)
      if (!existing) return
      const deletedAt = Date.now()
      await db.noteTags.delete(id)
      await enqueueDelete('noteTags', { id, updatedAt: deletedAt, name: existing.name }, deletedAt)
    },
  },
  noteAppearance: {
    async get() {
      const current = await db.noteAppearance.get(NOTE_APPEARANCE_ID)
      return current ? normalizeNoteAppearance(current) : null
    },
    async upsert(data: Partial<NoteAppearanceUpsertInput> & Pick<NoteAppearanceUpsertInput, 'id'>) {
      const current = await db.noteAppearance.get(NOTE_APPEARANCE_ID)
      if (!current) {
        const created = normalizeNoteAppearance(data)
        await db.noteAppearance.put(created)
        await enqueueUpsert('noteAppearance', created)
        return created
      }
      const next = touch({
        ...normalizeNoteAppearance(current),
        ...data,
        id: NOTE_APPEARANCE_ID,
      })
      await db.noteAppearance.put(next)
      await enqueueUpsert('noteAppearance', next)
      return next
    },
  },
  widgetTodos: {
    async list(scope?: WidgetTodoScope) {
      if (scope) return db.widgetTodos.where('scope').equals(scope).toArray()
      return db.widgetTodos.toArray()
    },
    async add(data) {
      const item = withBase(data as Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>)
      await db.widgetTodos.add(item)
      await enqueueUpsert('widgetTodos', item)
      return item
    },
    async update(item) {
      const next = touch(item as WidgetTodo)
      await db.widgetTodos.put(next)
      await enqueueUpsert('widgetTodos', next)
      return next
    },
    async resetDone(scope) {
      const rows = await db.widgetTodos.where('scope').equals(scope).filter((item) => item.done).toArray()
      if (rows.length === 0) return []
      const reset = rows.map((item) => ({ ...item, done: false }))
      await db.widgetTodos.bulkPut(reset)
      await Promise.all(reset.map((row) => enqueueUpsert('widgetTodos', row)))
      return reset
    },
    async remove(id) {
      const existing = await db.widgetTodos.get(id)
      if (!existing) return
      const deletedAt = Date.now()
      await db.widgetTodos.delete(id)
      await enqueueDelete('widgetTodos', { id, updatedAt: deletedAt, title: existing.title }, deletedAt)
    },
  },
  focus: {
    async get() {
      const existing = await db.focusSettings.get('focus_settings')
      return existing ?? null
    },
    async upsert(data) {
      const existing = await db.focusSettings.get('focus_settings')
      if (!existing) {
        const next = withBase({ ...(data as Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>), id: 'focus_settings' })
        await db.focusSettings.put(next)
        await enqueueUpsert('focusSettings', next)
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<FocusSettings>) })
      await db.focusSettings.put(next)
      await enqueueUpsert('focusSettings', next)
      return next
    },
  },
  focusSessions: {
    async list(limit) {
      const rows = await db.focusSessions.orderBy('createdAt').reverse().toArray()
      if (!limit || limit <= 0) return rows
      return rows.slice(0, limit)
    },
    async start(data) {
      const session: FocusSession = withBase({
        status: 'active',
        plannedMinutes: data.plannedMinutes,
        taskId: data.taskId,
        goal: data.goal?.trim() || undefined,
      })
      await db.focusSessions.add(session)
      await enqueueUpsert('focusSessions', session)
      return session
    },
    async complete(id, data) {
      const existing = await db.focusSessions.get(id)
      if (!existing) return undefined
      const completedAt = data?.completedAt ?? Date.now()
      const actualMinutes =
        typeof data?.actualMinutes === 'number' ? data.actualMinutes : Math.max(1, Math.round((completedAt - existing.createdAt) / 60000))
      const next = touch({
        ...existing,
        status: 'completed' as const,
        actualMinutes,
        completedAt,
      })
      await db.focusSessions.put(next)
      await enqueueUpsert('focusSessions', next)
      return next
    },
  },
  diary: {
    async list() {
      return db.diaryEntries.toArray()
    },
    async listActive() {
      const entries = await db.diaryEntries.toArray()
      return entries.filter((entry) => !entry.deletedAt).sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async getByDate(dateKey) {
      return db.diaryEntries.where('dateKey').equals(dateKey).first()
    },
    async listByDate(dateKey) {
      const entries = await db.diaryEntries.where('dateKey').equals(dateKey).toArray()
      return entries.sort((a, b) => b.entryAt - a.entryAt)
    },
    async listByRange(dateFrom, dateTo, options = {}) {
      const entries = await db.diaryEntries.where('dateKey').between(dateFrom, dateTo, true, true).toArray()
      const filtered = options.includeDeleted ? entries : entries.filter((entry) => !entry.deletedAt)
      return filtered.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async listTrash() {
      const entries = await db.diaryEntries.where('deletedAt').above(0).toArray()
      return entries.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
    },
    async softDeleteByDate(dateKey) {
      const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: Date.now(), expiredAt: null })
      await db.diaryEntries.put(next)
      await enqueueUpsert('diaryEntries', next)
      return next
    },
    async softDeleteById(id) {
      const existing = await db.diaryEntries.get(id)
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: Date.now(), expiredAt: null })
      await db.diaryEntries.put(next)
      await enqueueUpsert('diaryEntries', next)
      return next
    },
    async restoreByDate(dateKey) {
      const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: null, expiredAt: null })
      await db.diaryEntries.put(next)
      await enqueueUpsert('diaryEntries', next)
      return next
    },
    async restoreById(id) {
      const existing = await db.diaryEntries.get(id)
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: null, expiredAt: null })
      await db.diaryEntries.put(next)
      await enqueueUpsert('diaryEntries', next)
      return next
    },
    async markExpiredOlderThan(days = 30) {
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      const entries = await db.diaryEntries.where('deletedAt').belowOrEqual(cutoff).toArray()
      const targets = entries.filter((entry) => entry.deletedAt && !entry.expiredAt)
      if (!targets.length) return 0
      const now = Date.now()
      const updated = targets.map((entry) => touch({ ...entry, expiredAt: now }))
      await db.diaryEntries.bulkPut(updated)
      await Promise.all(updated.map((row) => enqueueUpsert('diaryEntries', row)))
      return updated.length
    },
    async hardDeleteByDate(dateKey) {
      const rows = await db.diaryEntries.where('dateKey').equals(dateKey).toArray()
      const deletedAt = Date.now()
      const count = await db.diaryEntries.where('dateKey').equals(dateKey).delete()
      await Promise.all(rows.map((row) => enqueueDelete('diaryEntries', { id: row.id, updatedAt: deletedAt, dateKey }, deletedAt)))
      return count
    },
    async hardDeleteById(id) {
      const existing = await db.diaryEntries.get(id)
      const deletedAt = Date.now()
      const count = await db.diaryEntries.where('id').equals(id).delete()
      if (existing) await enqueueDelete('diaryEntries', { id, updatedAt: deletedAt, dateKey: existing.dateKey }, deletedAt)
      return count
    },
    async add(data) {
      const entry = withBase(data as Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>)
      await db.diaryEntries.add(entry)
      await enqueueUpsert('diaryEntries', entry)
      return entry
    },
    async update(entry) {
      const next = touch(entry as DiaryEntry)
      await db.diaryEntries.put(next)
      await enqueueUpsert('diaryEntries', next)
      return next
    },
  },
  spend: {
    async listEntries() {
      return db.spends.toArray()
    },
    async addEntry(data) {
      const entry = withBase(data as Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>)
      await db.spends.add(entry)
      await enqueueUpsert('spends', entry)
      return entry
    },
    async deleteEntry(id) {
      const existing = await db.spends.get(id)
      if (!existing) return
      const deletedAt = Date.now()
      await db.spends.delete(id)
      await enqueueDelete('spends', { id, updatedAt: deletedAt, categoryId: existing.categoryId }, deletedAt)
    },
    async updateEntry(entry) {
      const next = touch(entry as SpendEntry)
      await db.spends.put(next)
      await enqueueUpsert('spends', next)
      return next
    },
    async listCategories() {
      return db.spendCategories.toArray()
    },
    async addCategory(data) {
      const category = withBase(data as Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>)
      await db.spendCategories.add(category)
      await enqueueUpsert('spendCategories', category)
      return category
    },
    async updateCategory(category) {
      const next = touch(category as SpendCategory)
      await db.spendCategories.put(next)
      await enqueueUpsert('spendCategories', next)
      return next
    },
  },
  habits: {
    async listHabits(userId, options = {}) {
      const archived = options.archived ?? false
      const rows = await db.habits.where('userId').equals(userId).toArray()
      const filtered = rows.filter((item) => item.archived === archived)
      return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    },
    async createHabit(data) {
      const rows = await db.habits.where('userId').equals(data.userId).toArray()
      const maxOrder = rows.reduce((max, item) => Math.max(max, item.sortOrder), -1)
      const habit: Habit = withBase({
        ...(data as Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>),
        sortOrder: typeof data.sortOrder === 'number' ? data.sortOrder : maxOrder + 1,
      })
      await db.habits.add(habit)
      await enqueueUpsert('habits', habit)
      return habit
    },
    async updateHabit(id, patch) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, ...(patch as Partial<Habit>) })
      await db.habits.put(next)
      await enqueueUpsert('habits', next)
      return next
    },
    async archiveHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: true })
      await db.habits.put(next)
      await enqueueUpsert('habits', next)
      return next
    },
    async restoreHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: false })
      await db.habits.put(next)
      await enqueueUpsert('habits', next)
      return next
    },
    async reorderHabits(userId, ids) {
      if (!ids.length) return
      const rows = (await db.habits.where('userId').equals(userId).toArray()).filter((item) => !item.archived)
      const byId = new Map(rows.map((item) => [item.id, item]))
      const now = Date.now()
      const updated = ids
        .map((id, index) => {
          const existing = byId.get(id)
          if (!existing) return null
          return { ...existing, sortOrder: index, updatedAt: now }
        })
        .filter((item): item is Habit => Boolean(item))
      if (updated.length) {
        await db.habits.bulkPut(updated)
        await Promise.all(updated.map((row) => enqueueUpsert('habits', row)))
      }
    },
    async recordHabitCompletion(habitId, dateKey, value) {
      const habit = await db.habits.get(habitId)
      if (!habit) throw new Error('Habit not found')

      const existing = await db.habitLogs.where('[habitId+dateKey]').equals([habitId, dateKey]).first()
      const status: HabitStatus = 'completed'
      const log: HabitLog = existing
        ? touch({
            ...existing,
            status,
            value: typeof value === 'number' ? value : existing.value,
          })
        : withBase({
            userId: habit.userId,
            habitId,
            dateKey,
            value,
            status,
          })

      if (!existing && typeof value !== 'number' && habit.type !== 'boolean' && typeof habit.target === 'number') {
        log.value = habit.target
      }

      await db.habitLogs.put(log)
      await enqueueUpsert('habitLogs', log)
      return log
    },
    async undoHabitCompletion(habitId, dateKey) {
      const existing = await db.habitLogs.where('[habitId+dateKey]').equals([habitId, dateKey]).first()
      if (!existing) return
      await db.habitLogs.delete(existing.id)
      await enqueueDelete('habitLogs', { id: existing.id, updatedAt: Date.now(), habitId, dateKey }, Date.now())
    },
    async listHabitLogs(habitId) {
      const rows = await db.habitLogs.where('habitId').equals(habitId).toArray()
      return rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    },
    async computeHabitStreak(habitId, dateKey) {
      const habit = await db.habits.get(habitId)
      if (!habit) return 0
      const logs = await db.habitLogs.where('habitId').equals(habitId).toArray()
      const map = new Map(logs.map((item) => [item.dateKey, item]))
      const earliestDateKey = logs.length > 0 ? logs.reduce((min, item) => (item.dateKey < min ? item.dateKey : min), logs[0].dateKey) : null
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
      const habits = (await db.habits.where('userId').equals(userId).toArray()).filter((item) => !item.archived)
      if (!habits.length) return { completed: 0, total: 0, percent: 0 }
      const logs = (await db.habitLogs.where('userId').equals(userId).toArray()).filter((item) => item.dateKey === dateKey)
      const completedIds = new Set(logs.filter((item) => item.status === 'completed').map((item) => item.habitId))
      const completed = habits.filter((habit) => completedIds.has(habit.id)).length
      const percent = Math.round((completed / habits.length) * 100)
      return { completed, total: habits.length, percent }
    },
    async getHeatmap(userId, days) {
      const range = Math.max(1, days)
      const end = new Date()
      const first = new Date(end.getTime() - (range - 1) * MS_PER_DAY)
      const startKey = toDateKey(first)
      const endKey = toDateKey(end)
      const [habits, logs] = await Promise.all([
        db.habits
          .where('userId')
          .equals(userId)
          .toArray()
          .then((rows) => rows.filter((item) => !item.archived)),
        db.habitLogs
          .where('userId')
          .equals(userId)
          .toArray()
          .then((rows) => rows.filter((item) => item.dateKey >= startKey && item.dateKey <= endKey)),
      ])
      const total = habits.length
      const byDate = new Map<string, number>()
      for (const row of logs) {
        if (row.status !== 'completed') continue
        byDate.set(row.dateKey, (byDate.get(row.dateKey) ?? 0) + 1)
      }

      return Array.from({ length: range }).map((_, index) => {
        const key = toDateKey(new Date(first.getTime() + index * MS_PER_DAY))
        return { dateKey: key, completed: byDate.get(key) ?? 0, total }
      })
    },
  },
  dashboard: {
    async get() {
      const layout = await db.dashboardLayout.get('dashboard_layout')
      return layout ?? null
    },
    async upsert(data) {
      const existing = await db.dashboardLayout.get('dashboard_layout')
      if (!existing) {
        const next = withBase({ ...(data as Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>), id: 'dashboard_layout' })
        await db.dashboardLayout.put(next)
        await enqueueUpsert('dashboardLayout', next)
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<DashboardLayout>) })
      await db.dashboardLayout.put(next)
      await enqueueUpsert('dashboardLayout', next)
      return next
    },
  },
  lifeDashboard: {
    async get() {
      const layout = await db.lifeDashboardLayout.get(LIFE_DASHBOARD_ID)
      return layout ?? null
    },
    async upsert(data) {
      const existing = await db.lifeDashboardLayout.get(LIFE_DASHBOARD_ID)
      if (!existing) {
        const next = withBase({ ...(data as Omit<LifeDashboardLayout, 'id' | 'createdAt' | 'updatedAt'>), id: LIFE_DASHBOARD_ID })
        await db.lifeDashboardLayout.put(next)
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<LifeDashboardLayout>) })
      await db.lifeDashboardLayout.put(next)
      return next
    },
  },
  books: {
    async list() {
      const rows = await db.books.toArray()
      return rows.map((row) => normalizeBook(row)).sort((left, right) => right.updatedAt - left.updatedAt)
    },
    async create(data) {
      const next = normalizeBook(withBase(data as Omit<BookItem, 'id' | 'createdAt' | 'updatedAt'>))
      await db.books.put(next)
      return next
    },
    async update(id, patch) {
      const existing = await db.books.get(id)
      if (!existing) return undefined
      const next = touch(normalizeBook({ ...existing, ...(patch as Partial<BookItem>) }))
      await db.books.put(next)
      return next
    },
    async remove(id) {
      await db.books.delete(id)
    },
  },
  media: {
    async list() {
      const rows = await db.media.toArray()
      return rows
        .map((row) => normalizeMedia(row))
        .sort((left, right) => Number(right.status === 'watching') - Number(left.status === 'watching') || right.updatedAt - left.updatedAt)
    },
    async create(data: MediaCreateInput) {
      const next = normalizeMedia(withBase(data as Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>))
      await db.media.put(next)
      return next
    },
    async update(id: string, patch: MediaUpdateInput) {
      const existing = await db.media.get(id)
      if (!existing) return undefined
      const next = touch(normalizeMedia({ ...existing, ...(patch as Partial<MediaItem>) }))
      await db.media.put(next)
      return next
    },
    async remove(id: string) {
      await db.media.delete(id)
    },
  },
  stocks: {
    async list() {
      const rows = await db.stocks.toArray()
      return rows
        .map((row) => normalizeStock(row))
        .sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt - left.updatedAt)
    },
    async create(data) {
      const next = normalizeStock(
        withBase({
          ...(data as Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>),
          pinned: (data as Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>).pinned ?? false,
        }),
      )
      await db.stocks.put(next)
      return next
    },
    async update(id, patch) {
      const existing = await db.stocks.get(id)
      if (!existing) return undefined
      const next = touch(normalizeStock({ ...existing, ...(patch as Partial<StockItem>) }))
      await db.stocks.put(next)
      return next
    },
    async remove(id) {
      await db.stocks.delete(id)
    },
  },
  lifeSubscriptions: {
    async list() {
      const rows = await db.lifeSubscriptions.toArray()
      return rows.map((row) => normalizeLifeSubscription(row)).sort((left, right) => right.updatedAt - left.updatedAt)
    },
    async create(data: LifeSubscriptionCreateInput) {
      const next = normalizeLifeSubscription(withBase(data as Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>))
      await db.lifeSubscriptions.put(next)
      return next
    },
    async update(id: string, patch: LifeSubscriptionUpdateInput) {
      const existing = await db.lifeSubscriptions.get(id)
      if (!existing) return undefined
      const next = touch(normalizeLifeSubscription({ ...existing, ...(patch as Partial<LifeSubscription>) }))
      await db.lifeSubscriptions.put(next)
      return next
    },
    async remove(id: string) {
      await db.lifeSubscriptions.delete(id)
    },
  },
  lifePodcasts: {
    async list() {
      const rows = await db.lifePodcasts.toArray()
      return rows.map((row) => normalizeLifePodcast(row)).sort((left, right) => right.updatedAt - left.updatedAt)
    },
    async create(data: LifePodcastCreateInput) {
      const next = normalizeLifePodcast(withBase(data as Omit<LifePodcast, 'id' | 'createdAt' | 'updatedAt'>))
      await db.lifePodcasts.put(next)
      return next
    },
    async update(id: string, patch: LifePodcastUpdateInput) {
      const existing = await db.lifePodcasts.get(id)
      if (!existing) return undefined
      const next = touch(normalizeLifePodcast({ ...existing, ...(patch as Partial<LifePodcast>) }))
      await db.lifePodcasts.put(next)
      return next
    },
    async remove(id: string) {
      await db.lifePodcasts.delete(id)
    },
  },
  lifePeople: {
    async list() {
      const rows = await db.lifePeople.toArray()
      return rows.map((row) => normalizeLifePerson(row)).sort((left, right) => right.updatedAt - left.updatedAt)
    },
    async create(data: LifePersonCreateInput) {
      const next = normalizeLifePerson(withBase(data as Omit<LifePerson, 'id' | 'createdAt' | 'updatedAt'>))
      await db.lifePeople.put(next)
      return next
    },
    async update(id: string, patch: LifePersonUpdateInput) {
      const existing = await db.lifePeople.get(id)
      if (!existing) return undefined
      const next = touch(normalizeLifePerson({ ...existing, ...(patch as Partial<LifePerson>) }))
      await db.lifePeople.put(next)
      return next
    },
    async remove(id: string) {
      await db.lifePeople.delete(id)
    },
  },
  trips: {
    async list() {
      const rows = await db.trips.toArray()
      return rows.map((row) => normalizeTrip(row)).sort((left, right) => left.startDate.localeCompare(right.startDate) || right.updatedAt - left.updatedAt)
    },
    async create(data: TripCreateInput) {
      const next = normalizeTrip(withBase(data as Omit<TripRecord, 'id' | 'createdAt' | 'updatedAt'>))
      await db.trips.put(next)
      return next
    },
    async update(id: string, patch: TripUpdateInput) {
      const existing = await db.trips.get(id)
      if (!existing) return undefined
      const next = touch(normalizeTrip({ ...existing, ...(patch as Partial<TripRecord>) }))
      await db.trips.put(next)
      return next
    },
    async remove(id: string) {
      await db.trips.delete(id)
    },
  },
})
