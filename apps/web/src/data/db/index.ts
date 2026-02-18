import Dexie from 'dexie'
import type { Table } from 'dexie'
import type {
  DashboardLayout,
  DiaryEntry,
  FocusSettings,
  SpendCategory,
  SpendEntry,
  TaskItem,
  WidgetTodo,
} from '../models/types'
import { DB_NAME, DB_VERSION, schemaV2, schemaV3, schemaV4, schemaV5, schemaV6, schemaV7, schemaV8, TABLES } from './schema'

export class WorkbenchDb extends Dexie {
  tasks!: Table<TaskItem, string>
  widgetTodos!: Table<WidgetTodo, string>
  focusSettings!: Table<FocusSettings, string>
  diaryEntries!: Table<DiaryEntry, string>
  spends!: Table<SpendEntry, string>
  spendCategories!: Table<SpendCategory, string>
  dashboardLayout!: Table<DashboardLayout, string>

  constructor() {
    super(DB_NAME)
    this.version(2).stores(schemaV2)
    this.version(3).stores(schemaV3)
    this.version(4).stores(schemaV4)
    this.version(5).stores(schemaV5)
    this.version(6).stores(schemaV6)
    this.version(7).stores(schemaV7)
    this.version(DB_VERSION).stores(schemaV8)

    this.tasks = this.table(TABLES.tasks)
    this.widgetTodos = this.table(TABLES.widgetTodos)
    this.focusSettings = this.table(TABLES.focusSettings)
    this.diaryEntries = this.table(TABLES.diaryEntries)
    this.spends = this.table(TABLES.spends)
    this.spendCategories = this.table(TABLES.spendCategories)
    this.dashboardLayout = this.table(TABLES.dashboardLayout)
  }
}

export const db = new WorkbenchDb()
