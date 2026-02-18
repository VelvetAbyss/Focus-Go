import type {
  DashboardLayout,
  DiaryEntry,
  FocusSettings,
  SpendCategory,
  SpendEntry,
  TaskItem,
  TaskStatus,
  WidgetTodo,
  WidgetTodoScope,
} from '../models'

export type TaskCreateInput = {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskItem['priority']
  dueDate?: string
  tags?: string[]
  subtasks?: TaskItem['subtasks']
}

export type WidgetTodoCreateInput = Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>
export type SpendEntryCreateInput = Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>
export type SpendCategoryCreateInput = Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>
export type FocusSettingsUpsertInput = Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>
export type DashboardLayoutUpsertInput = Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>
export type DiaryEntryCreateInput = Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>

export interface ITaskDataAccess {
  list(): Promise<TaskItem[]>
  add(data: TaskCreateInput): Promise<TaskItem>
  update(task: TaskItem): Promise<TaskItem>
  remove(id: string): Promise<void>
  updateStatus(id: string, status: TaskStatus): Promise<TaskItem | undefined>
  appendProgress(id: string, content: string): Promise<TaskItem | undefined>
  clearAllTags(): Promise<void>
}

export interface IWidgetTodoDataAccess {
  list(scope?: WidgetTodoScope): Promise<WidgetTodo[]>
  add(data: WidgetTodoCreateInput): Promise<WidgetTodo>
  update(item: WidgetTodo): Promise<WidgetTodo>
  remove(id: string): Promise<void>
}

export interface IFocusDataAccess {
  get(): Promise<FocusSettings | null>
  upsert(data: FocusSettingsUpsertInput): Promise<FocusSettings>
}

export interface IDiaryDataAccess {
  list(): Promise<DiaryEntry[]>
  listActive(): Promise<DiaryEntry[]>
  getByDate(dateKey: string): Promise<DiaryEntry | undefined>
  listByRange(dateFrom: string, dateTo: string, options?: { includeDeleted?: boolean }): Promise<DiaryEntry[]>
  listTrash(): Promise<DiaryEntry[]>
  softDeleteByDate(dateKey: string): Promise<DiaryEntry | null>
  restoreByDate(dateKey: string): Promise<DiaryEntry | null>
  markExpiredOlderThan(days?: number): Promise<number>
  hardDeleteByDate(dateKey: string): Promise<number>
  add(data: DiaryEntryCreateInput): Promise<DiaryEntry>
  update(entry: DiaryEntry): Promise<DiaryEntry>
}

export interface ISpendDataAccess {
  listEntries(): Promise<SpendEntry[]>
  addEntry(data: SpendEntryCreateInput): Promise<SpendEntry>
  deleteEntry(id: string): Promise<void>
  updateEntry(entry: SpendEntry): Promise<SpendEntry>
  listCategories(): Promise<SpendCategory[]>
  addCategory(data: SpendCategoryCreateInput): Promise<SpendCategory>
  updateCategory(category: SpendCategory): Promise<SpendCategory>
}

export interface IDashboardDataAccess {
  get(): Promise<DashboardLayout | null>
  upsert(data: DashboardLayoutUpsertInput): Promise<DashboardLayout>
}

export interface IDatabaseService {
  tasks: ITaskDataAccess
  widgetTodos: IWidgetTodoDataAccess
  focus: IFocusDataAccess
  diary: IDiaryDataAccess
  spend: ISpendDataAccess
  dashboard: IDashboardDataAccess
}
