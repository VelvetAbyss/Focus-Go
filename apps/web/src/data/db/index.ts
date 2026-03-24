import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  DashboardLayout,
  DiaryEntry,
  FeatureInstallation,
  FocusSession,
  FocusSettings,
  NoteAppearanceSettings,
  Habit,
  HabitLog,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  TaskItem,
  UserSubscription,
  WidgetTodo,
} from '../models/types'
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
  userSubscriptions!: Table<UserSubscription, string>
  featureInstallations!: Table<FeatureInstallation, string>
  habits!: Table<Habit, string>
  habitLogs!: Table<HabitLog, string>

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
    this.version(DB_VERSION)
      .stores(schemaV26)
      .upgrade(async (tx) => {
        const noteRows = await tx.table(TABLES.notes).toArray()
        if (noteRows.length === 0) return
        const migratedNotes = noteRows.map((row) => ({
          ...row,
          editorMode: row.editorMode === 'mindmap' ? 'mindmap' : 'document',
          mindMap:
            row.mindMap &&
            typeof row.mindMap === 'object' &&
            Array.isArray((row.mindMap as { nodes?: unknown[] }).nodes) &&
            Array.isArray((row.mindMap as { edges?: unknown[] }).edges)
              ? row.mindMap
              : null,
        }))
        await tx.table(TABLES.notes).bulkPut(migratedNotes as NoteItem[])
      })

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
    this.userSubscriptions = this.table(TABLES.userSubscriptions)
    this.featureInstallations = this.table(TABLES.featureInstallations)
    this.habits = this.table(TABLES.habits)
    this.habitLogs = this.table(TABLES.habitLogs)
  }
}

export const db = new WorkbenchDb()
