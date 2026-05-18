import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  BookItem,
  DashboardLayout,
  DiaryEntry,
  DomainEvent,
  FeatureInstallation,
  FocusSession,
  FocusSettings,
  LifeDashboardLayout,
  LifePodcast,
  LifePerson,
  LifeSubscription,
  MediaItem,
  NoteAppearanceSettings,
  Habit,
  HabitLog,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  StockItem,
  SyncedPreferences,
  TaskItem,
  TimelineItem,
  ProjectItem,
  ProjectNoteLink,
  ProjectPerson,
  TaskNoteLink,
  TripRecord,
  UserSubscription,
  WidgetTodo,
} from '../models/types'
import type { SyncBlobCacheEntry, SyncState } from '../sync/types'
import {
  DB_NAME,
  DB_VERSION,
  schemaV10,
  schemaV11,
  schemaV13,
  schemaV17,
  schemaV23,
  schemaV24,
  schemaV26,
  schemaV28,
  schemaV32,
  schemaV33,
  schemaV34,
  schemaV35,
  schemaV36,
  schemaV37,
  schemaV38,
  schemaV39,
  schemaV40,
  schemaV41,
  schemaV42,
  schemaV43,
  schemaV2,
  schemaV3,
  schemaV4,
  schemaV5,
  schemaV6,
  schemaV7,
  schemaV8,
  schemaV9,
  TABLES,
} from './schema'

export class WorkbenchDb extends Dexie {
  tasks!: Table<TaskItem, string>
  notes!: Table<NoteItem, string>
  noteTags!: Table<NoteTag, string>
  noteAppearance!: Table<NoteAppearanceSettings, string>
  widgetTodos!: Table<WidgetTodo, string>
  focusSettings!: Table<FocusSettings, string>
  focusSessions!: Table<FocusSession, string>
  diaryEntries!: Table<DiaryEntry, string>
  spends!: Table<SpendEntry, string>
  spendCategories!: Table<SpendCategory, string>
  dashboardLayout!: Table<DashboardLayout, string>
  lifeDashboardLayout!: Table<LifeDashboardLayout, string>
  userSubscriptions!: Table<UserSubscription, string>
  featureInstallations!: Table<FeatureInstallation, string>
  projects!: Table<ProjectItem, string>
  projectPeople!: Table<ProjectPerson, string>
  projectNoteLinks!: Table<ProjectNoteLink, string>
  taskNoteLinks!: Table<TaskNoteLink, string>
  habits!: Table<Habit, string>
  habitLogs!: Table<HabitLog, string>
  syncState!: Table<SyncState, string>
  syncBlobCache!: Table<SyncBlobCacheEntry, string>
  books!: Table<BookItem, string>
  stocks!: Table<StockItem, string>
  media!: Table<MediaItem, string>
  lifeSubscriptions!: Table<LifeSubscription, string>
  lifePodcasts!: Table<LifePodcast, string>
  lifePeople!: Table<LifePerson, string>
  trips!: Table<TripRecord, string>
  syncedPreferences!: Table<SyncedPreferences, string>
  domainEvents!: Table<DomainEvent, string>
  timelineItems!: Table<TimelineItem, string>

  constructor() {
    super(DB_NAME)
    this.version(2).stores(schemaV2)
    this.version(3).stores(schemaV3)
    this.version(4).stores(schemaV4)
    this.version(5).stores(schemaV5)
    this.version(6).stores(schemaV6)
    this.version(7).stores(schemaV7)
    this.version(8).stores(schemaV8)
    this.version(9).stores(schemaV9)
    this.version(10).stores(schemaV10)
    this.version(11)
      .stores(schemaV11)
      .upgrade(async () => {})
    this.version(13)
      .stores(schemaV13)
      .upgrade(async () => {})
    this.version(17)
      .stores(schemaV17)
      .upgrade(async (tx) => {
        const taskRows = await tx.table(TABLES.tasks).toArray()
        if (taskRows.length) {
          const migratedTasks = taskRows.map((row) => ({
            ...row,
            pinned: row.pinned === true,
          }))
          await tx.table(TABLES.tasks).bulkPut(migratedTasks as TaskItem[])
        }
      })
    this.version(23)
      .stores(schemaV23)
      .upgrade(async (tx) => {
        const taskRows = await tx.table(TABLES.tasks).toArray()
        if (taskRows.length) {
          const migratedTasks = taskRows.map((row) => {
            const legacyNote = typeof (row as { note?: unknown }).note === 'string' ? (row as { note?: string }).note : undefined
            return {
              ...row,
              taskNoteBlocks: Array.isArray((row as { taskNoteBlocks?: unknown }).taskNoteBlocks)
                ? (row as TaskItem).taskNoteBlocks
                : [
                    {
                      id: crypto.randomUUID(),
                      type: 'paragraph' as const,
                      text: legacyNote ?? '',
                    },
                  ],
            }
          })
          await tx.table(TABLES.tasks).bulkPut(migratedTasks as TaskItem[])
        }
      })
    this.version(24)
      .stores(schemaV24)
      .upgrade(async (tx) => {
        const noteRows = await tx.table(TABLES.notes).toArray()
        if (noteRows.length) {
          const migratedNotes = noteRows.map((row) => ({
            ...row,
            pinned: row.pinned === true,
            wordCount: typeof row.wordCount === 'number' ? row.wordCount : 0,
            charCount: typeof row.charCount === 'number' ? row.charCount : 0,
            paragraphCount: typeof row.paragraphCount === 'number' ? row.paragraphCount : 0,
            imageCount: typeof row.imageCount === 'number' ? row.imageCount : 0,
            fileCount: typeof row.fileCount === 'number' ? row.fileCount : 0,
            headings: Array.isArray(row.headings) ? row.headings : [],
            backlinks: Array.isArray(row.backlinks) ? row.backlinks : [],
          }))
          await tx.table(TABLES.notes).bulkPut(migratedNotes as NoteItem[])
        }
      })
    this.version(26)
      .stores(schemaV26)
      .upgrade(async (tx) => {
        const noteRows = await tx.table(TABLES.notes).toArray()
        if (noteRows.length === 0) return
        const migratedNotes = noteRows.map((row) => ({
          ...row,
          editorMode: 'document',
        }))
        await tx.table(TABLES.notes).bulkPut(migratedNotes as NoteItem[])
      })
    this.version(28)
      .stores(schemaV28)
      .upgrade(async (tx) => {
        const diaryRows = await tx.table(TABLES.diaryEntries).toArray()
        if (diaryRows.length === 0) return
        const migrated = diaryRows.map((row) => ({
          ...row,
          entryAt: (row as { entryAt?: number }).entryAt ?? row.updatedAt ?? row.createdAt ?? Date.now(),
          contentJson: (row as { contentJson?: unknown }).contentJson ?? null,
          weatherSnapshot: null,
        }))
        await tx.table(TABLES.diaryEntries).bulkPut(migrated as DiaryEntry[])
      })

    this.version(32)
      .stores(schemaV32)
      .upgrade(async (tx) => {
        const taskRows = await tx.table(TABLES.tasks).toArray()
        if (taskRows.length === 0) return
        const migratedTasks = taskRows.map((row) => ({
          ...row,
          isToday: row.isToday === true,
        }))
        await tx.table(TABLES.tasks).bulkPut(migratedTasks as TaskItem[])
      })

    this.version(33)
      .stores(schemaV33)
      .upgrade(async () => {})

    this.version(34)
      .stores(schemaV34)
      .upgrade(async () => {})

    this.version(35)
      .stores(schemaV35)
      .upgrade(async () => {})

    this.version(36)
      .stores(schemaV36)
      .upgrade(async () => {})

    this.version(37)
      .stores(schemaV37)
      .upgrade(async () => {})

    this.version(38)
      .stores(schemaV38)
      .upgrade(async () => {})

    this.version(39)
      .stores(schemaV39)
      .upgrade(async () => {})

    this.version(40)
      .stores(schemaV40)
      .upgrade(async () => {})

    this.version(41)
      .stores(schemaV41)
      .upgrade(async () => {})

    this.version(42)
      .stores(schemaV42)
      .upgrade(async () => {})

    this.version(43)
      .stores(schemaV43)
      .upgrade(async () => {})

    this.version(DB_VERSION).stores(schemaV43)

    this.tasks = this.table(TABLES.tasks)
    this.notes = this.table(TABLES.notes)
    this.noteTags = this.table(TABLES.noteTags)
    this.noteAppearance = this.table(TABLES.noteAppearance)
    this.widgetTodos = this.table(TABLES.widgetTodos)
    this.focusSettings = this.table(TABLES.focusSettings)
    this.focusSessions = this.table(TABLES.focusSessions)
    this.diaryEntries = this.table(TABLES.diaryEntries)
    this.spends = this.table(TABLES.spends)
    this.spendCategories = this.table(TABLES.spendCategories)
    this.dashboardLayout = this.table(TABLES.dashboardLayout)
    this.lifeDashboardLayout = this.table(TABLES.lifeDashboardLayout)
    this.userSubscriptions = this.table(TABLES.userSubscriptions)
    this.featureInstallations = this.table(TABLES.featureInstallations)
    this.projects = this.table(TABLES.projects)
    this.projectPeople = this.table(TABLES.projectPeople)
    this.projectNoteLinks = this.table(TABLES.projectNoteLinks)
    this.taskNoteLinks = this.table(TABLES.taskNoteLinks)
    this.habits = this.table(TABLES.habits)
    this.habitLogs = this.table(TABLES.habitLogs)
    this.syncState = this.table(TABLES.syncState)
    this.syncBlobCache = this.table(TABLES.syncBlobCache)
    this.books = this.table(TABLES.books)
    this.stocks = this.table(TABLES.stocks)
    this.media = this.table(TABLES.media)
    this.lifeSubscriptions = this.table(TABLES.lifeSubscriptions)
    this.lifePodcasts = this.table(TABLES.lifePodcasts)
    this.lifePeople = this.table(TABLES.lifePeople)
    this.trips = this.table(TABLES.trips)
    this.syncedPreferences = this.table(TABLES.syncedPreferences)
    this.domainEvents = this.table(TABLES.domainEvents)
    this.timelineItems = this.table(TABLES.timelineItems)
  }
}

export const db = new WorkbenchDb()

const DB_RESET_SIGNAL_KEY = 'focusgo:db-reset-requested'
const DB_RESET_SIGNAL_EVENT = 'focusgo:db-reset-requested'

const handleDbResetSignal = () => {
  db.close()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DB_RESET_SIGNAL_KEY) handleDbResetSignal()
  })
  window.addEventListener(DB_RESET_SIGNAL_EVENT, handleDbResetSignal)
}

export const requestCrossTabDbReset = () => {
  handleDbResetSignal()
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(DB_RESET_SIGNAL_EVENT))
  window.localStorage.setItem(DB_RESET_SIGNAL_KEY, String(Date.now()))
}
