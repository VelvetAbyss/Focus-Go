import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  DashboardLayout,
  DiaryEntry,
  FeatureInstallation,
  FocusSession,
  FocusSettings,
  Habit,
  HabitLog,
  NoteAssetEntity,
  NoteEntity,
  RssEntry,
  RssReadState,
  RssSource,
  RssSourceGroup,
  SpendCategory,
  SpendEntry,
  TaskItem,
  UserSubscription,
  WidgetTodo,
} from '../models/types'
import {
  DB_NAME,
  DB_VERSION,
  LEGACY_TABLES,
  schemaV10,
  schemaV11,
  schemaV13,
  schemaV16,
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
  widgetTodos!: Table<WidgetTodo, string>
  focusSettings!: Table<FocusSettings, string>
  focusSessions!: Table<FocusSession, string>
  diaryEntries!: Table<DiaryEntry, string>
  spends!: Table<SpendEntry, string>
  spendCategories!: Table<SpendCategory, string>
  dashboardLayout!: Table<DashboardLayout, string>
  noteEntries!: Table<NoteEntity, string>
  noteAssets!: Table<NoteAssetEntity, string>
  userSubscriptions!: Table<UserSubscription, string>
  featureInstallations!: Table<FeatureInstallation, string>
  rssSourceGroups!: Table<RssSourceGroup, string>
  rssSources!: Table<RssSource, string>
  rssEntries!: Table<RssEntry, string>
  rssReadStates!: Table<RssReadState, string>
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
      .upgrade(async (tx) => {
        const legacyRows = await tx.table(LEGACY_TABLES.knowledgeNotes).toArray()
        if (!legacyRows.length) return
        await tx.table(TABLES.noteEntries).bulkPut(legacyRows as NoteEntity[])
      })
    this.version(13)
      .stores(schemaV13)
      .upgrade(async (tx) => {
        const rows = await tx.table(TABLES.noteEntries).toArray()
        if (!rows.length) return

        const migrated = rows.map((row) => ({
          ...row,
          contentJson: row.contentJson ?? null,
          manualTags: Array.isArray(row.manualTags) ? row.manualTags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
          tags: Array.isArray(row.tags) ? row.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
        }))

        await tx.table(TABLES.noteEntries).bulkPut(migrated as NoteEntity[])
      })
    this.version(DB_VERSION)
      .stores(schemaV16)
      .upgrade(async (tx) => {
        const rssRows = await tx.table(TABLES.rssSources).toArray()
        if (!rssRows.length) return

        const migrated = rssRows.map((row) => ({
          ...row,
          groupId: row.groupId ?? null,
          starredAt: row.starredAt ?? null,
          lastEntryAt: row.lastEntryAt ?? row.lastSuccessAt,
        }))

        await tx.table(TABLES.rssSources).bulkPut(migrated as RssSource[])
      })

    this.tasks = this.table(TABLES.tasks)
    this.widgetTodos = this.table(TABLES.widgetTodos)
    this.focusSettings = this.table(TABLES.focusSettings)
    this.focusSessions = this.table(TABLES.focusSessions)
    this.diaryEntries = this.table(TABLES.diaryEntries)
    this.spends = this.table(TABLES.spends)
    this.spendCategories = this.table(TABLES.spendCategories)
    this.dashboardLayout = this.table(TABLES.dashboardLayout)
    this.noteEntries = this.table(TABLES.noteEntries)
    this.noteAssets = this.table(TABLES.noteAssets)
    this.userSubscriptions = this.table(TABLES.userSubscriptions)
    this.featureInstallations = this.table(TABLES.featureInstallations)
    this.rssSourceGroups = this.table(TABLES.rssSourceGroups)
    this.rssSources = this.table(TABLES.rssSources)
    this.rssEntries = this.table(TABLES.rssEntries)
    this.rssReadStates = this.table(TABLES.rssReadStates)
    this.habits = this.table(TABLES.habits)
    this.habitLogs = this.table(TABLES.habitLogs)
  }
}

export const db = new WorkbenchDb()
