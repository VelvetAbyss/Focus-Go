import type {
  IDatabaseService,
  NoteAppearanceUpsertInput,
  NoteCreateInput,
  NoteTagCreateInput,
  NoteTagUpdateInput,
  NoteUpdateInput,
  TaskCreateInput,
} from '@focus-go/core'
import { db } from '../db'
import type {
  DashboardLayout,
  DiaryEntry,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  HabitStatus,
  NoteAppearanceSettings,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  TaskItem,
  TaskStatus,
  WidgetTodo,
  WidgetTodoScope,
} from '../models/types'
import { touch, withBase } from '../repositories/base'
import { createId } from '../../shared/utils/ids'
import { areTaskNoteBlocksEqual, normalizeTaskNoteBlocks } from '../../features/tasks/model/taskNote'
import { resolveTaskNoteRichText } from '../../features/tasks/model/taskNoteRichText'

const statusLabelMap: Record<TaskStatus, string> = {
  todo: '待办',
  doing: '进行中',
  done: '已完成',
}

const DEFAULT_NOTE_COLLECTION = 'all-notes' as const
const NOTE_APPEARANCE_ID = 'note_appearance' as const
const NOTE_TRASH_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
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
    description: typeof task.description === 'string' ? task.description : '',
    pinned: task.pinned === true,
    dueDate: typeof task.dueDate === 'string' && task.dueDate ? task.dueDate : undefined,
    startDate: typeof task.startDate === 'string' && task.startDate ? task.startDate : undefined,
    endDate: typeof task.endDate === 'string' && task.endDate ? task.endDate : undefined,
    reminderAt: typeof task.reminderAt === 'number' && Number.isFinite(task.reminderAt) ? task.reminderAt : undefined,
    reminderFiredAt:
      typeof task.reminderFiredAt === 'number' && Number.isFinite(task.reminderFiredAt) ? task.reminderFiredAt : undefined,
    tags: Array.isArray(task.tags) ? task.tags : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    taskNoteBlocks: [],
    taskNoteContentMd: taskNote.contentMd,
    taskNoteContentJson: taskNote.contentJson as TaskItem['taskNoteContentJson'],
    activityLogs: Array.isArray(task.activityLogs) ? task.activityLogs : [],
  }
}

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
      return task
    },
    async update(task) {
      const next = touch(normalizeTask(task as TaskItem))
      await db.tasks.put(next)
      return next
    },
    async remove(id) {
      await db.tasks.delete(id)
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
      return next
    },
    async clearAllTags() {
      const tasks = await db.tasks.toArray()
      const tagged = tasks.map((task) => normalizeTask(task)).filter((task) => task.tags.length > 0)
      if (tagged.length === 0) return
      await db.tasks.bulkPut(tagged.map((task) => touch({ ...task, tags: [] })))
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
      return next
    },
    async hardDelete(id: string) {
      await db.notes.delete(id)
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
      return next
    },
    async remove(id: string) {
      await db.noteTags.delete(id)
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
        return created
      }
      const next = touch({
        ...normalizeNoteAppearance(current),
        ...data,
        id: NOTE_APPEARANCE_ID,
      })
      await db.noteAppearance.put(next)
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
      return item
    },
    async update(item) {
      const next = touch(item as WidgetTodo)
      await db.widgetTodos.put(next)
      return next
    },
    async resetDone(scope) {
      const rows = await db.widgetTodos.where('scope').equals(scope).filter((item) => item.done).toArray()
      if (rows.length === 0) return []
      const reset = rows.map((item) => ({ ...item, done: false }))
      await db.widgetTodos.bulkPut(reset)
      return reset
    },
    async remove(id) {
      await db.widgetTodos.delete(id)
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
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<FocusSettings>) })
      await db.focusSettings.put(next)
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
      return next
    },
    async restoreByDate(dateKey) {
      const existing = await db.diaryEntries.where('dateKey').equals(dateKey).first()
      if (!existing) return null
      const next = touch({ ...existing, deletedAt: null, expiredAt: null })
      await db.diaryEntries.put(next)
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
      return updated.length
    },
    async hardDeleteByDate(dateKey) {
      return db.diaryEntries.where('dateKey').equals(dateKey).delete()
    },
    async add(data) {
      const entry = withBase(data as Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>)
      await db.diaryEntries.add(entry)
      return entry
    },
    async update(entry) {
      const next = touch(entry as DiaryEntry)
      await db.diaryEntries.put(next)
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
      return entry
    },
    async deleteEntry(id) {
      await db.spends.delete(id)
    },
    async updateEntry(entry) {
      const next = touch(entry as SpendEntry)
      await db.spends.put(next)
      return next
    },
    async listCategories() {
      return db.spendCategories.toArray()
    },
    async addCategory(data) {
      const category = withBase(data as Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>)
      await db.spendCategories.add(category)
      return category
    },
    async updateCategory(category) {
      const next = touch(category as SpendCategory)
      await db.spendCategories.put(next)
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
      return habit
    },
    async updateHabit(id, patch) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, ...(patch as Partial<Habit>) })
      await db.habits.put(next)
      return next
    },
    async archiveHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: true })
      await db.habits.put(next)
      return next
    },
    async restoreHabit(id) {
      const existing = await db.habits.get(id)
      if (!existing) return undefined
      const next = touch({ ...existing, archived: false })
      await db.habits.put(next)
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
      if (updated.length) await db.habits.bulkPut(updated)
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
      return log
    },
    async undoHabitCompletion(habitId, dateKey) {
      const existing = await db.habitLogs.where('[habitId+dateKey]').equals([habitId, dateKey]).first()
      if (!existing) return
      await db.habitLogs.delete(existing.id)
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
        return next
      }
      const next = touch({ ...existing, ...(data as Partial<DashboardLayout>) })
      await db.dashboardLayout.put(next)
      return next
    },
  },
})
