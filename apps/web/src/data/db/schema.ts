export const DB_NAME = 'workbench-app'
export const DB_VERSION = 8

export const TABLES = {
  tasks: 'tasks',
  widgetTodos: 'widget_todos',
  focusSettings: 'focus_settings',
  diaryEntries: 'diary_entries',
  spends: 'spends',
  spendCategories: 'spend_categories',
  dashboardLayout: 'dashboard_layout',
} as const

export const schemaV2 = {
  [TABLES.tasks]: 'id, status, priority, dueDate, createdAt, updatedAt',
  [TABLES.widgetTodos]: 'id, scope, priority, dueDate, createdAt, updatedAt',
  [TABLES.focusSettings]: 'id, createdAt, updatedAt',
  [TABLES.diaryEntries]: 'id, dateKey, deletedAt, expiredAt, createdAt, updatedAt',
  [TABLES.spends]: 'id, dateKey, categoryId, createdAt, updatedAt',
  [TABLES.spendCategories]: 'id, name, createdAt, updatedAt',
  kb_notes: 'id, title, createdAt, updatedAt',
  [TABLES.dashboardLayout]: 'id, createdAt, updatedAt',
} as const

export const schemaV3 = {
  [TABLES.tasks]: 'id, status, priority, dueDate, createdAt, updatedAt',
  [TABLES.widgetTodos]: 'id, scope, priority, dueDate, createdAt, updatedAt',
  [TABLES.focusSettings]: 'id, createdAt, updatedAt',
  [TABLES.diaryEntries]: 'id, dateKey, deletedAt, expiredAt, createdAt, updatedAt',
  [TABLES.spends]: 'id, dateKey, categoryId, createdAt, updatedAt',
  [TABLES.spendCategories]: 'id, name, createdAt, updatedAt',
  kb_notes: null,
  [TABLES.dashboardLayout]: 'id, createdAt, updatedAt',
} as const

export const schemaV4 = {
  ...schemaV3,
  scratchpad_notes: 'id, createdAt, updatedAt',
} as const

export const schemaV5 = {
  ...schemaV4,
  scratchpad_assets: 'id, noteId, createdAt, updatedAt',
} as const

export const schemaV6 = {
  ...schemaV5,
  scratchpad_notes: null,
  scratchpad_assets: null,
  notes: 'id, title, categoryId, *tags, pinned, status, createdAt, updatedAt',
  note_categories: 'id, name, createdAt, updatedAt',
  note_assets: 'id, noteId, createdAt, updatedAt',
} as const

export const schemaV7 = {
  ...schemaV6,
  note_v2_tags: 'id, name, isLocked, isPin, sortOrder, createdAt, updatedAt',
  note_v2_marks: 'id, tagId, type, deleted, createdAt, updatedAt',
  note_v2_notes: 'id, tagId, title, locale, createdAt, updatedAt',
} as const

export const schemaV8 = {
  ...schemaV7,
  notes: null,
  note_categories: null,
  note_assets: null,
  note_v2_tags: null,
  note_v2_marks: null,
  note_v2_notes: null,
} as const
