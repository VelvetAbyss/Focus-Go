import { mkdirSync, existsSync, copyFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import type {
  DashboardLayout,
  DiaryEntry,
  FocusSettings,
  IDatabaseService,
  SpendCategory,
  SpendEntry,
  TaskCreateInput,
  TaskItem,
  TaskStatus,
  WidgetTodo,
  WidgetTodoScope,
} from '@focus-go/core'

const FOCUS_SETTINGS_ID = 'focus_settings'
const DASHBOARD_LAYOUT_ID = 'dashboard_layout'

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

const toTaskItem = (row: Record<string, unknown>): TaskItem => ({
  id: String(row.id),
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  userId: row.userId ? String(row.userId) : undefined,
  workspaceId: row.workspaceId ? String(row.workspaceId) : undefined,
  title: String(row.title ?? ''),
  description: String(row.description ?? ''),
  status: String(row.status) as TaskStatus,
  priority: (row.priority as TaskItem['priority']) ?? null,
  dueDate: row.dueDate ? String(row.dueDate) : undefined,
  tags: parseJson(row.tags as string, [] as string[]),
  subtasks: parseJson(row.subtasks as string, [] as TaskItem['subtasks']),
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
      status TEXT NOT NULL,
      priority TEXT,
      dueDate TEXT,
      tags TEXT NOT NULL,
      subtasks TEXT NOT NULL,
      progressLogs TEXT NOT NULL,
      activityLogs TEXT NOT NULL,
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
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
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
  `)

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
  widgetTodos: WidgetTodo[]
  focusSettings: FocusSettings[]
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
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate,
          tags: data.tags ?? [],
          subtasks: data.subtasks ?? [],
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
              (id, title, description, status, priority, dueDate, tags, subtasks, progressLogs, activityLogs, createdAt, updatedAt, userId, workspaceId)
             VALUES
              (@id, @title, @description, @status, @priority, @dueDate, @tags, @subtasks, @progressLogs, @activityLogs, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            tags: serializeJson(entity.tags),
            subtasks: serializeJson(entity.subtasks),
            progressLogs: serializeJson(entity.progressLogs),
            activityLogs: serializeJson(entity.activityLogs),
            userId: entity.userId ?? null,
            workspaceId: entity.workspaceId ?? null,
            dueDate: entity.dueDate ?? null,
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
               status=@status,
               priority=@priority,
               dueDate=@dueDate,
               tags=@tags,
               subtasks=@subtasks,
               progressLogs=@progressLogs,
               activityLogs=@activityLogs,
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            dueDate: next.dueDate ?? null,
            tags: serializeJson(next.tags),
            subtasks: serializeJson(next.subtasks),
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
             (id, scope, title, priority, dueDate, done, createdAt, updatedAt, userId, workspaceId)
             VALUES (@id, @scope, @title, @priority, @dueDate, @done, @createdAt, @updatedAt, @userId, @workspaceId)`
          )
          .run({
            ...entity,
            dueDate: entity.dueDate ?? null,
            done: entity.done ? 1 : 0,
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
               updatedAt=@updatedAt,
               userId=@userId,
               workspaceId=@workspaceId
             WHERE id=@id`
          )
          .run({
            ...next,
            dueDate: next.dueDate ?? null,
            done: next.done ? 1 : 0,
            userId: next.userId ?? null,
            workspaceId: next.workspaceId ?? null,
          })
        return next
      },
      async remove(id) {
        database.prepare('DELETE FROM widget_todos WHERE id = ?').run(id)
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
               (id, title, description, status, priority, dueDate, tags, subtasks, progressLogs, activityLogs, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @title, @description, @status, @priority, @dueDate, @tags, @subtasks, @progressLogs, @activityLogs, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 title=excluded.title,
                 description=excluded.description,
                 status=excluded.status,
                 priority=excluded.priority,
                 dueDate=excluded.dueDate,
                 tags=excluded.tags,
                 subtasks=excluded.subtasks,
                 progressLogs=excluded.progressLogs,
                 activityLogs=excluded.activityLogs,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              description: value.description ?? '',
              dueDate: value.dueDate ?? null,
              tags: serializeJson(value.tags ?? []),
              subtasks: serializeJson(value.subtasks ?? []),
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
               (id, scope, title, priority, dueDate, done, createdAt, updatedAt, userId, workspaceId)
               VALUES (@id, @scope, @title, @priority, @dueDate, @done, @createdAt, @updatedAt, @userId, @workspaceId)
               ON CONFLICT(id) DO UPDATE SET
                 scope=excluded.scope,
                 title=excluded.title,
                 priority=excluded.priority,
                 dueDate=excluded.dueDate,
                 done=excluded.done,
                 updatedAt=excluded.updatedAt,
                 userId=excluded.userId,
                 workspaceId=excluded.workspaceId`
            )
            .run({
              ...value,
              dueDate: value.dueDate ?? null,
              done: value.done ? 1 : 0,
              userId: value.userId ?? null,
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
