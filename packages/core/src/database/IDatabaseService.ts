import type {
  BookItem,
  DashboardLayout,
  DiaryEntry,
  FocusSession,
  FocusSettings,
  LifeSubscription,
  MediaItem,
  NoteAppearanceSettings,
  LifeDashboardLayout,
  Habit,
  HabitLog,
  NoteItem,
  NoteTag,
  SpendCategory,
  SpendEntry,
  StockItem,
  TaskItem,
  TripRecord,
  TaskStatus,
  WidgetTodo,
  WidgetTodoScope,
} from '../models'

export type TaskCreateInput = {
  title: string
  description?: string
  pinned?: boolean
  isToday?: boolean
  status: TaskStatus
  priority: TaskItem['priority']
  dueDate?: string
  startDate?: string
  endDate?: string
  reminderAt?: number
  reminderFiredAt?: number
  tags?: string[]
  subtasks?: TaskItem['subtasks']
  taskNoteBlocks?: TaskItem['taskNoteBlocks']
  taskNoteContentMd?: TaskItem['taskNoteContentMd']
  taskNoteContentJson?: TaskItem['taskNoteContentJson']
}

export type WidgetTodoCreateInput = Omit<WidgetTodo, 'id' | 'createdAt' | 'updatedAt'>
export type NoteCreateInput = Partial<
  Pick<NoteItem, 'title' | 'contentMd' | 'contentJson' | 'editorMode' | 'collection' | 'tags' | 'pinned' | 'backlinks'>
>
export type NoteUpdateInput = Partial<
  Pick<
    NoteItem,
    'title' | 'contentMd' | 'contentJson' | 'editorMode' | 'collection' | 'tags' | 'excerpt' | 'pinned' | 'wordCount' | 'charCount' | 'paragraphCount' | 'imageCount' | 'fileCount' | 'headings' | 'backlinks' | 'deletedAt'
  >
>
export type NoteTagCreateInput = Omit<NoteTag, 'id' | 'createdAt' | 'updatedAt' | 'noteCount'>
export type NoteTagUpdateInput = Partial<Omit<NoteTag, 'id' | 'createdAt' | 'updatedAt'>>
export type NoteAppearanceUpsertInput = Omit<NoteAppearanceSettings, 'createdAt' | 'updatedAt'>
export type SpendEntryCreateInput = Omit<SpendEntry, 'id' | 'createdAt' | 'updatedAt'>
export type SpendCategoryCreateInput = Omit<SpendCategory, 'id' | 'createdAt' | 'updatedAt'>
export type FocusSettingsUpsertInput = Omit<FocusSettings, 'id' | 'createdAt' | 'updatedAt'>
export type FocusSessionStartInput = {
  taskId?: string
  goal?: string
  plannedMinutes: number
  userId?: string
  workspaceId?: string
}
export type FocusSessionCompleteInput = {
  actualMinutes?: number
  completedAt?: number
}
export type DashboardLayoutUpsertInput = Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>
export type LifeDashboardLayoutUpsertInput = Omit<LifeDashboardLayout, 'id' | 'createdAt' | 'updatedAt'>
export type DiaryEntryCreateInput = Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>
export type HabitCreateInput = Omit<Habit, 'id' | 'createdAt' | 'updatedAt'>
export type HabitUpdateInput = Partial<Omit<Habit, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
export type HabitListOptions = { archived?: boolean }
export type HabitHeatmapCell = { dateKey: string; completed: number; total: number }
export type HabitDailyProgress = { completed: number; total: number; percent: number }
export type BookCreateInput = Omit<BookItem, 'id' | 'createdAt' | 'updatedAt'>
export type BookUpdateInput = Partial<Omit<BookItem, 'id' | 'createdAt' | 'updatedAt'>>
export type MediaCreateInput = Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>
export type MediaUpdateInput = Partial<Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>>
export type StockCreateInput = Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>
export type StockUpdateInput = Partial<Omit<StockItem, 'id' | 'createdAt' | 'updatedAt'>>
export type LifeSubscriptionCreateInput = Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>
export type LifeSubscriptionUpdateInput = Partial<Omit<LifeSubscription, 'id' | 'createdAt' | 'updatedAt'>>
export type TripCreateInput = Omit<TripRecord, 'id' | 'createdAt' | 'updatedAt'>
export type TripUpdateInput = Partial<Omit<TripRecord, 'id' | 'createdAt' | 'updatedAt'>>

export interface ITaskDataAccess {
  list(): Promise<TaskItem[]>
  add(data: TaskCreateInput): Promise<TaskItem>
  update(task: TaskItem): Promise<TaskItem>
  remove(id: string): Promise<void>
  updateStatus(id: string, status: TaskStatus): Promise<TaskItem | undefined>
  clearAllTags(): Promise<void>
}

export interface IWidgetTodoDataAccess {
  list(scope?: WidgetTodoScope): Promise<WidgetTodo[]>
  add(data: WidgetTodoCreateInput): Promise<WidgetTodo>
  update(item: WidgetTodo): Promise<WidgetTodo>
  resetDone(scope: WidgetTodoScope): Promise<WidgetTodo[]>
  remove(id: string): Promise<void>
}

export interface INoteDataAccess {
  list(): Promise<NoteItem[]>
  listTrash(): Promise<NoteItem[]>
  create(data?: NoteCreateInput): Promise<NoteItem>
  update(id: string, patch: NoteUpdateInput): Promise<NoteItem | undefined>
  softDelete(id: string): Promise<NoteItem | undefined>
  restore(id: string): Promise<NoteItem | undefined>
  hardDelete(id: string): Promise<void>
}

export interface INoteTagDataAccess {
  list(): Promise<NoteTag[]>
  create(data: NoteTagCreateInput): Promise<NoteTag>
  update(id: string, patch: NoteTagUpdateInput): Promise<NoteTag | undefined>
  remove(id: string): Promise<void>
}

export interface INoteAppearanceDataAccess {
  get(): Promise<NoteAppearanceSettings | null>
  upsert(data: Partial<NoteAppearanceUpsertInput> & Pick<NoteAppearanceUpsertInput, 'id'>): Promise<NoteAppearanceSettings>
}

export interface IFocusDataAccess {
  get(): Promise<FocusSettings | null>
  upsert(data: FocusSettingsUpsertInput): Promise<FocusSettings>
}

export interface IFocusSessionDataAccess {
  list(limit?: number): Promise<FocusSession[]>
  start(data: FocusSessionStartInput): Promise<FocusSession>
  complete(id: string, data?: FocusSessionCompleteInput): Promise<FocusSession | undefined>
}

export interface IDiaryDataAccess {
  list(): Promise<DiaryEntry[]>
  listActive(): Promise<DiaryEntry[]>
  getByDate(dateKey: string): Promise<DiaryEntry | undefined>
  listByDate(dateKey: string): Promise<DiaryEntry[]>
  listByRange(dateFrom: string, dateTo: string, options?: { includeDeleted?: boolean }): Promise<DiaryEntry[]>
  listTrash(): Promise<DiaryEntry[]>
  softDeleteByDate(dateKey: string): Promise<DiaryEntry | null>
  softDeleteById(id: string): Promise<DiaryEntry | null>
  restoreByDate(dateKey: string): Promise<DiaryEntry | null>
  restoreById(id: string): Promise<DiaryEntry | null>
  markExpiredOlderThan(days?: number): Promise<number>
  hardDeleteByDate(dateKey: string): Promise<number>
  hardDeleteById(id: string): Promise<number>
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

export interface ILifeDashboardDataAccess {
  get(): Promise<LifeDashboardLayout | null>
  upsert(data: LifeDashboardLayoutUpsertInput): Promise<LifeDashboardLayout>
}

export interface IBookDataAccess {
  list(): Promise<BookItem[]>
  create(data: BookCreateInput): Promise<BookItem>
  update(id: string, patch: BookUpdateInput): Promise<BookItem | undefined>
  remove(id: string): Promise<void>
}

export interface IMediaDataAccess {
  list(): Promise<MediaItem[]>
  create(data: MediaCreateInput): Promise<MediaItem>
  update(id: string, patch: MediaUpdateInput): Promise<MediaItem | undefined>
  remove(id: string): Promise<void>
}

export interface IStockDataAccess {
  list(): Promise<StockItem[]>
  create(data: StockCreateInput): Promise<StockItem>
  update(id: string, patch: StockUpdateInput): Promise<StockItem | undefined>
  remove(id: string): Promise<void>
}

export interface ILifeSubscriptionDataAccess {
  list(): Promise<LifeSubscription[]>
  create(data: LifeSubscriptionCreateInput): Promise<LifeSubscription>
  update(id: string, patch: LifeSubscriptionUpdateInput): Promise<LifeSubscription | undefined>
  remove(id: string): Promise<void>
}

export interface ITripDataAccess {
  list(): Promise<TripRecord[]>
  create(data: TripCreateInput): Promise<TripRecord>
  update(id: string, patch: TripUpdateInput): Promise<TripRecord | undefined>
  remove(id: string): Promise<void>
}

export interface IHabitDataAccess {
  listHabits(userId: string, options?: HabitListOptions): Promise<Habit[]>
  createHabit(data: HabitCreateInput): Promise<Habit>
  updateHabit(id: string, patch: HabitUpdateInput): Promise<Habit | undefined>
  archiveHabit(id: string): Promise<Habit | undefined>
  restoreHabit(id: string): Promise<Habit | undefined>
  reorderHabits(userId: string, ids: string[]): Promise<void>
  recordHabitCompletion(habitId: string, dateKey: string, value?: number): Promise<HabitLog>
  undoHabitCompletion(habitId: string, dateKey: string): Promise<void>
  listHabitLogs(habitId: string): Promise<HabitLog[]>
  computeHabitStreak(habitId: string, dateKey: string): Promise<number>
  getDailyProgress(userId: string, dateKey: string): Promise<HabitDailyProgress>
  getHeatmap(userId: string, days: number): Promise<HabitHeatmapCell[]>
}

export interface IDatabaseService {
  tasks: ITaskDataAccess
  notes: INoteDataAccess
  noteTags: INoteTagDataAccess
  noteAppearance: INoteAppearanceDataAccess
  widgetTodos: IWidgetTodoDataAccess
  focus: IFocusDataAccess
  focusSessions: IFocusSessionDataAccess
  diary: IDiaryDataAccess
  spend: ISpendDataAccess
  dashboard: IDashboardDataAccess
  lifeDashboard: ILifeDashboardDataAccess
  books: IBookDataAccess
  media: IMediaDataAccess
  stocks: IStockDataAccess
  lifeSubscriptions: ILifeSubscriptionDataAccess
  trips: ITripDataAccess
  habits: IHabitDataAccess
}
