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

const taskProgressLogSchema = z
  .object({
    id: z.string().min(1),
    content: z.string(),
    createdAt: z.number(),
  })
  .strict()

const taskActivityLogSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['status', 'progress', 'details']),
    message: z.string(),
    createdAt: z.number(),
  })
  .strict()

const taskItemSchema = baseEntitySchema.extend({
  title: z.string(),
  description: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  dueDate: z.string().optional(),
  tags: z.array(z.string()),
  subtasks: z.array(taskSubtaskSchema),
  progressLogs: z.array(taskProgressLogSchema),
  activityLogs: z.array(taskActivityLogSchema),
})

const taskCreateInputSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: z.string().optional(),
    tags: z.array(z.string()).optional(),
    subtasks: z.array(taskSubtaskSchema).optional(),
  })
  .strict()

const widgetTodoScopeSchema = z.enum(['day', 'week', 'month'])
const widgetTodoSchema = baseEntitySchema.extend({
  scope: widgetTodoScopeSchema,
  title: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  dueDate: z.string().optional(),
  done: z.boolean(),
})

const widgetTodoCreateInputSchema = z
  .object({
    scope: widgetTodoScopeSchema,
    title: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
    dueDate: z.string().optional(),
    done: z.boolean(),
    userId: z.string().optional(),
    workspaceId: z.string().optional(),
  })
  .strict()

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
  'db:tasks:appendProgress': z.object({ id: z.string().min(1), content: z.string() }).strict(),
  'db:tasks:clearAllTags': emptySchema,
  'db:widgetTodos:list': z.object({ scope: widgetTodoScopeSchema.optional() }).strict(),
  'db:widgetTodos:add': widgetTodoCreateInputSchema,
  'db:widgetTodos:update': z.object({ item: widgetTodoSchema }).strict(),
  'db:widgetTodos:remove': idSchema,
  'db:focus:get': emptySchema,
  'db:focus:upsert': focusSettingsUpsertInputSchema,
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
  'db:tasks:appendProgress': responseSchema(taskItemSchema.nullable()),
  'db:tasks:clearAllTags': responseSchema(z.null()),
  'db:widgetTodos:list': responseSchema(z.array(widgetTodoSchema)),
  'db:widgetTodos:add': responseSchema(widgetTodoSchema),
  'db:widgetTodos:update': responseSchema(widgetTodoSchema),
  'db:widgetTodos:remove': responseSchema(z.null()),
  'db:focus:get': responseSchema(focusSettingsSchema.nullable()),
  'db:focus:upsert': responseSchema(focusSettingsSchema),
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
} as const satisfies Record<IpcChannel, ZodTypeAny>

export type IpcRequestByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcRequestSchemas)[K]>
}

export type IpcResponseByChannel = {
  [K in IpcChannel]: z.infer<(typeof ipcResponseSchemas)[K]>
}
