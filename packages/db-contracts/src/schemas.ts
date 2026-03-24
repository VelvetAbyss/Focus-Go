import { z, type ZodTypeAny } from 'zod'
import type { IpcChannel } from './channels'

const emptySchema = z.object({}).strict()
const idSchema = z.object({ id: z.string().min(1) }).strict()
const taskStatusSchema = z.enum(['todo', 'doing', 'done'])
const taskPrioritySchema = z.enum(['high', 'medium', 'low']).nullable()

const baseEntitySchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const taskSubtaskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    done: z.boolean(),
  })
  .strict()

const taskActivityLogSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['status', 'details']),
    message: z.string(),
    createdAt: z.number(),
  })
  .strict()

const taskNoteParagraphBlockSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal('paragraph'),
    text: z.string(),
  })
  .strict()

const taskNoteBlockSchema = taskNoteParagraphBlockSchema
const noteCollectionSchema = z.enum(['all-notes', 'work', 'personal', 'ideas'])
const noteThemeModeSchema = z.enum(['paper', 'graphite'])
const noteFontFamilySchema = z.enum(['uiSans', 'humanistSans', 'cnSans', 'serif', 'cnSerif', 'mono'])

const noteHeadingSchema = z
  .object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string(),
    id: z.string().min(1),
  })
  .strict()

const noteBacklinkSchema = z
  .object({
    noteId: z.string().min(1),
    noteTitle: z.string(),
  })
  .strict()

const noteTagSchema = baseEntitySchema.extend({
  name: z.string(),
  icon: z.string().optional(),
  pinned: z.boolean(),
  parentId: z.string().nullable().optional(),
  noteCount: z.number(),
  sortOrder: z.number(),
})

const noteTagCreateInputSchema = z
  .object({
    name: z.string(),
    icon: z.string().optional(),
    pinned: z.boolean(),
    parentId: z.string().nullable().optional(),
    sortOrder: z.number(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const noteTagUpdateInputSchema = z
  .object({
    name: z.string().optional(),
    icon: z.string().optional(),
    pinned: z.boolean().optional(),
    parentId: z.string().nullable().optional(),
    noteCount: z.number().optional(),
    sortOrder: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const noteAppearanceSchema = baseEntitySchema.extend({
  id: z.literal('note_appearance'),
  theme: noteThemeModeSchema,
  font: noteFontFamilySchema,
  fontSize: z.number(),
  lineHeight: z.number(),
  contentWidth: z.number(),
  focusMode: z.boolean(),
})

const noteAppearanceUpsertInputSchema = z
  .object({
    id: z.literal('note_appearance'),
    theme: noteThemeModeSchema.optional(),
    font: noteFontFamilySchema.optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    contentWidth: z.number().optional(),
    focusMode: z.boolean().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const taskItemSchema = baseEntitySchema.extend({
  title: z.string(),
  description: z.string(),
  pinned: z.boolean(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reminderAt: z.number().optional(),
  reminderFiredAt: z.number().optional(),
  tags: z.array(z.string()),
  subtasks: z.array(taskSubtaskSchema),
  taskNoteBlocks: z.array(taskNoteBlockSchema),
  taskNoteContentMd: z.string().optional(),
  taskNoteContentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  activityLogs: z.array(taskActivityLogSchema),
})

const taskCreateInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    pinned: z.boolean().optional(),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reminderAt: z.number().optional(),
    reminderFiredAt: z.number().optional(),
    tags: z.array(z.string()).optional(),
    subtasks: z.array(taskSubtaskSchema).optional(),
    taskNoteBlocks: z.array(taskNoteBlockSchema).optional(),
    taskNoteContentMd: z.string().optional(),
    taskNoteContentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()

const widgetTodoScopeSchema = z.enum(['day', 'week', 'month'])
const noteEditorModeSchema = z.enum(['document', 'mindmap'])
const noteMindMapNodeSchema = z.object({
  id: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).strict(),
  data: z.object({
    label: z.string(),
  }).strict(),
}).strict()
const noteMindMapEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
}).strict()
const noteMindMapViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
}).strict()
const noteMindMapDocumentSchema = z.object({
  nodes: z.array(noteMindMapNodeSchema),
  edges: z.array(noteMindMapEdgeSchema),
  viewport: noteMindMapViewportSchema.nullable().optional(),
}).strict()
const noteItemSchema = baseEntitySchema.extend({
  title: z.string(),
  contentMd: z.string(),
  contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
  editorMode: noteEditorModeSchema,
  mindMap: noteMindMapDocumentSchema.nullable().optional(),
  collection: noteCollectionSchema,
  tags: z.array(z.string()),
  excerpt: z.string(),
  pinned: z.boolean(),
  wordCount: z.number(),
  charCount: z.number(),
  paragraphCount: z.number(),
  imageCount: z.number(),
  fileCount: z.number(),
  headings: z.array(noteHeadingSchema),
  backlinks: z.array(noteBacklinkSchema),
  deletedAt: z.number().nullable().optional(),
})

const noteCreateInputSchema = z
  .object({
    title: z.string().optional(),
    contentMd: z.string().optional(),
    contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
    editorMode: noteEditorModeSchema.optional(),
    mindMap: noteMindMapDocumentSchema.nullable().optional(),
    collection: noteCollectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    pinned: z.boolean().optional(),
    backlinks: z.array(noteBacklinkSchema).optional(),
  })
  .strict()

const noteUpdateInputSchema = z
  .object({
    title: z.string().optional(),
    contentMd: z.string().optional(),
    contentJson: z.record(z.string(), z.unknown()).nullable().optional(),
    editorMode: noteEditorModeSchema.optional(),
    mindMap: noteMindMapDocumentSchema.nullable().optional(),
    collection: noteCollectionSchema.optional(),
    tags: z.array(z.string()).optional(),
    excerpt: z.string().optional(),
    pinned: z.boolean().optional(),
    wordCount: z.number().optional(),
    charCount: z.number().optional(),
    paragraphCount: z.number().optional(),
    imageCount: z.number().optional(),
    fileCount: z.number().optional(),
    headings: z.array(noteHeadingSchema).optional(),
    backlinks: z.array(noteBacklinkSchema).optional(),
    deletedAt: z.number().nullable().optional(),
  })
  .strict()

const widgetTodoSchema = baseEntitySchema.extend({
  scope: widgetTodoScopeSchema,
  title: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().optional(),
  done: z.boolean(),
  linkedHabitId: z.string().optional(),
})

const widgetTodoCreateInputSchema = z
  .object({
    scope: widgetTodoScopeSchema,
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    dueDate: z.string().optional(),
    done: z.boolean(),
    linkedHabitId: z.string().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitTypeSchema = z.enum(['boolean', 'numeric', 'timer'])
const habitStatusSchema = z.enum(['completed', 'failed', 'frozen'])

const habitSchema = baseEntitySchema.extend({
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  type: habitTypeSchema,
  color: z.string(),
  archived: z.boolean(),
  target: z.number().optional(),
  freezesAllowed: z.number(),
  sortOrder: z.number(),
})

const habitCreateInputSchema = z
  .object({
    userId: z.string(),
    title: z.string(),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: habitTypeSchema,
    color: z.string(),
    archived: z.boolean(),
    target: z.number().optional(),
    freezesAllowed: z.number(),
    sortOrder: z.number(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitUpdateInputSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional(),
    type: habitTypeSchema.optional(),
    color: z.string().optional(),
    archived: z.boolean().optional(),
    target: z.number().optional(),
    freezesAllowed: z.number().optional(),
    sortOrder: z.number().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const habitLogSchema = baseEntitySchema.extend({
  userId: z.string(),
  habitId: z.string(),
  dateKey: z.string(),
  value: z.number().optional(),
  status: habitStatusSchema,
})

const habitListOptionsSchema = z.object({ archived: z.boolean().optional() }).strict()
const habitDailyProgressSchema = z.object({ completed: z.number(), total: z.number(), percent: z.number() }).strict()
const habitHeatmapCellSchema = z.object({ dateKey: z.string(), completed: z.number(), total: z.number() }).strict()

const noiseTrackSettingsSchema = z
  .object({
    enabled: z.boolean(),
    volume: z.number(),
  })
  .strict()

const noiseTracksSchema = z
  .object({
    cafe: noiseTrackSettingsSchema,
    fireplace: noiseTrackSettingsSchema,
    rain: noiseTrackSettingsSchema,
    wind: noiseTrackSettingsSchema,
    thunder: noiseTrackSettingsSchema,
    ocean: noiseTrackSettingsSchema,
  })
  .strict()

const focusSettingsSchema = baseEntitySchema.extend({
  focusMinutes: z.number(),
  breakMinutes: z.number(),
  longBreakMinutes: z.number(),
  noise: z
    .object({
      playing: z.boolean(),
      loop: z.boolean(),
      masterVolume: z.number(),
      tracks: noiseTracksSchema,
    })
    .strict()
    .optional(),
  noisePreset: z
    .object({
      presetId: z.string(),
      presetName: z.string(),
      scope: z.literal('focus-center'),
      isPlaying: z.boolean(),
      loop: z.boolean(),
      tracks: noiseTracksSchema,
    })
    .strict()
    .optional(),
  volume: z.number().optional(),
})

const focusSessionSchema = baseEntitySchema.extend({
  taskId: z.string().optional(),
  goal: z.string().optional(),
  plannedMinutes: z.number(),
  actualMinutes: z.number().optional(),
  status: z.enum(['active', 'completed', 'interrupted']),
  completedAt: z.number().optional(),
  interruptedAt: z.number().optional(),
  interruptionReason: z.string().optional(),
})

const focusSettingsUpsertInputSchema = z
  .object({
    focusMinutes: z.number(),
    breakMinutes: z.number(),
    longBreakMinutes: z.number(),
    noise: focusSettingsSchema.shape.noise,
    noisePreset: focusSettingsSchema.shape.noisePreset,
    volume: z.number().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const focusSessionStartInputSchema = z
  .object({
    taskId: z.string().optional(),
    goal: z.string().optional(),
    plannedMinutes: z.number().min(1),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const focusSessionCompleteInputSchema = z
  .object({
    id: z.string().min(1),
    actualMinutes: z.number().optional(),
    completedAt: z.number().optional(),
  })
  .strict()

const diaryEntrySchema = baseEntitySchema.extend({
  dateKey: z.string(),
  contentMd: z.string(),
  tags: z.array(z.string()),
  deletedAt: z.number().nullable().optional(),
  expiredAt: z.number().nullable().optional(),
})

const diaryEntryCreateInputSchema = z
  .object({
    dateKey: z.string(),
    contentMd: z.string(),
    tags: z.array(z.string()),
    deletedAt: z.number().nullable().optional(),
    expiredAt: z.number().nullable().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const spendEntrySchema = baseEntitySchema.extend({
  amount: z.number(),
  currency: z.string(),
  categoryId: z.string(),
  note: z.string().optional(),
  dateKey: z.string(),
})

const spendEntryCreateInputSchema = z
  .object({
    amount: z.number(),
    currency: z.string(),
    categoryId: z.string(),
    note: z.string().optional(),
    dateKey: z.string(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const spendCategorySchema = baseEntitySchema.extend({
  name: z.string(),
  icon: z.string().optional(),
})

const spendCategoryCreateInputSchema = z
  .object({
    name: z.string(),
    icon: z.string().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

const dashboardLayoutItemSchema = z
  .object({
    key: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  })
  .strict()

const dashboardLayoutSchema = baseEntitySchema.extend({
  items: z.array(dashboardLayoutItemSchema),
  hiddenCardIds: z.array(z.string()).optional(),
  themeOverride: z.enum(['light', 'dark']).nullable().optional(),
})

const dashboardLayoutUpsertInputSchema = z
  .object({
    items: z.array(dashboardLayoutItemSchema),
    hiddenCardIds: z.array(z.string()).optional(),
    themeOverride: z.enum(['light', 'dark']).nullable().optional(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

export const ipcRequestSchemas = {
  'db:tasks:list': emptySchema,
  'db:tasks:add': taskCreateInputSchema,
  'db:tasks:update': z.object({ task: taskItemSchema }).strict(),
  'db:tasks:remove': idSchema,
  'db:tasks:updateStatus': z.object({ id: z.string().min(1), status: taskStatusSchema }).strict(),
  'db:tasks:clearAllTags': emptySchema,
  'db:notes:list': emptySchema,
  'db:notes:listTrash': emptySchema,
  'db:notes:create': noteCreateInputSchema,
  'db:notes:update': z.object({ id: z.string().min(1), patch: noteUpdateInputSchema }).strict(),
  'db:notes:softDelete': idSchema,
  'db:notes:restore': idSchema,
  'db:notes:hardDelete': idSchema,
  'db:noteTags:list': emptySchema,
  'db:noteTags:create': noteTagCreateInputSchema,
  'db:noteTags:update': z.object({ id: z.string().min(1), patch: noteTagUpdateInputSchema }).strict(),
  'db:noteTags:remove': idSchema,
  'db:noteAppearance:get': emptySchema,
  'db:noteAppearance:upsert': noteAppearanceUpsertInputSchema,
  'db:widgetTodos:list': z.object({ scope: widgetTodoScopeSchema.optional() }).strict(),
  'db:widgetTodos:add': widgetTodoCreateInputSchema,
  'db:widgetTodos:update': z.object({ item: widgetTodoSchema }).strict(),
  'db:widgetTodos:resetDone': z.object({ scope: widgetTodoScopeSchema }).strict(),
  'db:widgetTodos:remove': idSchema,
  'db:focus:get': emptySchema,
  'db:focus:upsert': focusSettingsUpsertInputSchema,
  'db:focusSessions:list': z.object({ limit: z.number().int().positive().max(200).optional() }).strict(),
  'db:focusSessions:start': focusSessionStartInputSchema,
  'db:focusSessions:complete': focusSessionCompleteInputSchema,
  'db:diary:list': emptySchema,
  'db:diary:listActive': emptySchema,
  'db:diary:getByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:listByRange': z
    .object({
      dateFrom: z.string(),
      dateTo: z.string(),
      options: z.object({ includeDeleted: z.boolean().optional() }).strict().optional(),
    })
    .strict(),
  'db:diary:listTrash': emptySchema,
  'db:diary:softDeleteByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:restoreByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:markExpiredOlderThan': z.object({ days: z.number().optional() }).strict(),
  'db:diary:hardDeleteByDate': z.object({ dateKey: z.string() }).strict(),
  'db:diary:add': diaryEntryCreateInputSchema,
  'db:diary:update': z.object({ entry: diaryEntrySchema }).strict(),
  'db:spend:listEntries': emptySchema,
  'db:spend:addEntry': spendEntryCreateInputSchema,
  'db:spend:deleteEntry': idSchema,
  'db:spend:updateEntry': z.object({ entry: spendEntrySchema }).strict(),
  'db:spend:listCategories': emptySchema,
  'db:spend:addCategory': spendCategoryCreateInputSchema,
  'db:spend:updateCategory': z.object({ category: spendCategorySchema }).strict(),
  'db:dashboard:get': emptySchema,
  'db:dashboard:upsert': dashboardLayoutUpsertInputSchema,
  'db:habits:list': z.object({ userId: z.string().min(1), options: habitListOptionsSchema.optional() }).strict(),
  'db:habits:create': habitCreateInputSchema,
  'db:habits:update': z.object({ id: z.string().min(1), patch: habitUpdateInputSchema }).strict(),
  'db:habits:archive': idSchema,
  'db:habits:restore': idSchema,
  'db:habits:reorder': z.object({ userId: z.string().min(1), ids: z.array(z.string().min(1)) }).strict(),
  'db:habits:recordCompletion': z.object({ habitId: z.string().min(1), dateKey: z.string(), value: z.number().optional() }).strict(),
  'db:habits:undoCompletion': z.object({ habitId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:listLogs': z.object({ habitId: z.string().min(1) }).strict(),
  'db:habits:computeStreak': z.object({ habitId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:getDailyProgress': z.object({ userId: z.string().min(1), dateKey: z.string() }).strict(),
  'db:habits:getHeatmap': z.object({ userId: z.string().min(1), days: z.number().int().positive() }).strict(),
} as const satisfies Record<IpcChannel, ZodTypeAny>

const ipcErrorSchema = z.object({ code: z.string(), message: z.string() }).strict()

const responseSchema = <T extends ZodTypeAny>(dataSchema: T) =>
  z.union([
    z.object({ ok: z.literal(true), data: dataSchema }).strict(),
    z.object({ ok: z.literal(false), error: ipcErrorSchema }).strict(),
  ])

export const ipcResponseSchemas = {
  'db:tasks:list': responseSchema(z.array(taskItemSchema)),
  'db:tasks:add': responseSchema(taskItemSchema),
  'db:tasks:update': responseSchema(taskItemSchema),
  'db:tasks:remove': responseSchema(z.null()),
  'db:tasks:updateStatus': responseSchema(taskItemSchema.nullable()),
  'db:tasks:clearAllTags': responseSchema(z.null()),
  'db:notes:list': responseSchema(z.array(noteItemSchema)),
  'db:notes:listTrash': responseSchema(z.array(noteItemSchema)),
  'db:notes:create': responseSchema(noteItemSchema),
  'db:notes:update': responseSchema(noteItemSchema.nullable()),
  'db:notes:softDelete': responseSchema(noteItemSchema.nullable()),
  'db:notes:restore': responseSchema(noteItemSchema.nullable()),
  'db:notes:hardDelete': responseSchema(z.null()),
  'db:noteTags:list': responseSchema(z.array(noteTagSchema)),
  'db:noteTags:create': responseSchema(noteTagSchema),
  'db:noteTags:update': responseSchema(noteTagSchema.nullable()),
  'db:noteTags:remove': responseSchema(z.null()),
  'db:noteAppearance:get': responseSchema(noteAppearanceSchema.nullable()),
  'db:noteAppearance:upsert': responseSchema(noteAppearanceSchema),
  'db:widgetTodos:list': responseSchema(z.array(widgetTodoSchema)),
  'db:widgetTodos:add': responseSchema(widgetTodoSchema),
  'db:widgetTodos:update': responseSchema(widgetTodoSchema),
  'db:widgetTodos:resetDone': responseSchema(z.array(widgetTodoSchema)),
  'db:widgetTodos:remove': responseSchema(z.null()),
  'db:focus:get': responseSchema(focusSettingsSchema.nullable()),
  'db:focus:upsert': responseSchema(focusSettingsSchema),
  'db:focusSessions:list': responseSchema(z.array(focusSessionSchema)),
  'db:focusSessions:start': responseSchema(focusSessionSchema),
  'db:focusSessions:complete': responseSchema(focusSessionSchema.nullable()),
  'db:diary:list': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:listActive': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:getByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:listByRange': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:listTrash': responseSchema(z.array(diaryEntrySchema)),
  'db:diary:softDeleteByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:restoreByDate': responseSchema(diaryEntrySchema.nullable()),
  'db:diary:markExpiredOlderThan': responseSchema(z.number()),
  'db:diary:hardDeleteByDate': responseSchema(z.number()),
  'db:diary:add': responseSchema(diaryEntrySchema),
  'db:diary:update': responseSchema(diaryEntrySchema),
  'db:spend:listEntries': responseSchema(z.array(spendEntrySchema)),
  'db:spend:addEntry': responseSchema(spendEntrySchema),
  'db:spend:deleteEntry': responseSchema(z.null()),
  'db:spend:updateEntry': responseSchema(spendEntrySchema),
  'db:spend:listCategories': responseSchema(z.array(spendCategorySchema)),
  'db:spend:addCategory': responseSchema(spendCategorySchema),
  'db:spend:updateCategory': responseSchema(spendCategorySchema),
  'db:dashboard:get': responseSchema(dashboardLayoutSchema.nullable()),
  'db:dashboard:upsert': responseSchema(dashboardLayoutSchema),
  'db:habits:list': responseSchema(z.array(habitSchema)),
  'db:habits:create': responseSchema(habitSchema),
  'db:habits:update': responseSchema(habitSchema.nullable()),
  'db:habits:archive': responseSchema(habitSchema.nullable()),
  'db:habits:restore': responseSchema(habitSchema.nullable()),
  'db:habits:reorder': responseSchema(z.null()),
  'db:habits:recordCompletion': responseSchema(habitLogSchema),
  'db:habits:undoCompletion': responseSchema(z.null()),
  'db:habits:listLogs': responseSchema(z.array(habitLogSchema)),
  'db:habits:computeStreak': responseSchema(z.number()),
  'db:habits:getDailyProgress': responseSchema(habitDailyProgressSchema),
  'db:habits:getHeatmap': responseSchema(z.array(habitHeatmapCellSchema)),
} as const satisfies Record<IpcChannel, ZodTypeAny>

export type IpcRequestByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcRequestSchemas)[K]>
}

export type IpcResponseByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcResponseSchemas)[K]>
}
