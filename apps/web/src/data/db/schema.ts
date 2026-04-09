export const DB_NAME = 'workbench-app'
export const DB_VERSION = 34

export const TABLES = {
  tasks: 'tasks',
  notes: 'notes',
  noteTags: 'note_tags',
  noteAppearance: 'note_appearance',
  widgetTodos: 'widget_todos',
  focusSettings: 'focus_settings',
  focusSessions: 'focus_sessions',
  diaryEntries: 'diary_entries',
  spends: 'spends',
  spendCategories: 'spend_categories',
  dashboardLayout: 'dashboard_layout',
  lifeDashboardLayout: 'life_dashboard_layout',
  userSubscriptions: 'user_subscriptions',
  featureInstallations: 'feature_installations',
  habits: 'habits',
  habitLogs: 'habit_logs',
  syncOutbox: 'sync_outbox',
  syncState: 'sync_state',
  books: 'books',
  stocks: 'stocks',
  media: 'media',
  lifeSubscriptions: 'life_subscriptions',
  lifePodcasts: 'life_podcasts',
  lifePeople: 'life_people',
  trips: 'trips',
} as const

export const schemaV2 = {
  [TABLES.tasks]: 'id, status, priority, dueDate, createdAt, updatedAt',
  [TABLES.widgetTodos]: 'id, scope, priority, dueDate, createdAt, updatedAt',
  [TABLES.focusSettings]: 'id, createdAt, updatedAt',
  [TABLES.diaryEntries]: 'id, dateKey, deletedAt, expiredAt, createdAt, updatedAt',
  [TABLES.spends]: 'id, dateKey, categoryId, createdAt, updatedAt',
  [TABLES.spendCategories]: 'id, name, createdAt, updatedAt',
  [TABLES.dashboardLayout]: 'id, createdAt, updatedAt',
} as const

export const schemaV3 = {
  ...schemaV2,
} as const

export const schemaV4 = {
  ...schemaV3,
} as const

export const schemaV5 = {
  ...schemaV4,
} as const

export const schemaV6 = {
  ...schemaV5,
} as const

export const schemaV7 = {
  ...schemaV6,
} as const

export const schemaV8 = {
  ...schemaV7,
} as const

export const schemaV9 = {
  ...schemaV8,
  [TABLES.focusSessions]: 'id, status, taskId, createdAt, updatedAt, completedAt',
} as const

export const schemaV10 = {
  ...schemaV9,
} as const

export const schemaV11 = {
  ...schemaV10,
} as const

export const schemaV12 = {
  ...schemaV10,
} as const

export const schemaV13 = {
  ...schemaV12,
  [TABLES.userSubscriptions]: 'id, userId, tier, createdAt, updatedAt',
  [TABLES.featureInstallations]: 'id, userId, featureKey, state, [userId+featureKey], createdAt, updatedAt',
} as const

export const schemaV14 = {
  ...schemaV13,
} as const

export const schemaV15 = {
  ...schemaV14,
  [TABLES.habits]: 'id, userId, archived, sortOrder, updatedAt, [userId+archived], [userId+sortOrder]',
  [TABLES.habitLogs]: 'id, userId, habitId, dateKey, status, [habitId+dateKey], [userId+dateKey], updatedAt',
} as const

export const schemaV16 = {
  ...schemaV15,
  [TABLES.tasks]: 'id, status, priority, dueDate, startDate, endDate, reminderAt, reminderFiredAt, createdAt, updatedAt',
} as const

export const schemaV17 = {
  ...schemaV16,
  [TABLES.tasks]:
    'id, pinned, status, priority, dueDate, startDate, endDate, reminderAt, reminderFiredAt, createdAt, updatedAt',
} as const

export const schemaV18 = {
  ...schemaV17,
} as const

export const schemaV19 = {
  ...schemaV18,
} as const

export const schemaV20 = {
  ...schemaV19,
} as const

export const schemaV21 = {
  ...schemaV20,
} as const

export const schemaV22 = {
  ...schemaV21,
} as const

export const schemaV23 = {
  ...schemaV22,
  [TABLES.notes]: 'id, collection, deletedAt, updatedAt, createdAt',
} as const

export const schemaV24 = {
  ...schemaV23,
  [TABLES.notes]: 'id, collection, pinned, deletedAt, updatedAt, createdAt',
  [TABLES.noteTags]: 'id, parentId, pinned, sortOrder, updatedAt, createdAt',
  [TABLES.noteAppearance]: 'id, updatedAt, createdAt',
} as const

export const schemaV25 = {
  ...schemaV24,
} as const

export const schemaV26 = {
  ...schemaV25,
} as const

export const schemaV27 = {
  ...schemaV26,
  [TABLES.diaryEntries]: 'id, dateKey, entryAt, deletedAt, expiredAt, createdAt, updatedAt',
} as const

export const schemaV28 = {
  ...schemaV27,
  [TABLES.syncOutbox]: 'id, entityType, entityId, updatedAt, nextRetryAt, createdAt',
  [TABLES.syncState]: 'id, updatedAt, createdAt',
} as const

export const schemaV29 = {
  ...schemaV28,
  [TABLES.books]: 'id, title, status, progress, createdAt, updatedAt',
  [TABLES.media]: 'id, title, status, progress, createdAt, updatedAt',
  [TABLES.lifeSubscriptions]: 'id, name, amount, cycle, createdAt, updatedAt',
} as const

export const schemaV30 = {
  ...schemaV29,
  [TABLES.books]: 'id, source, sourceId, title, status, progress, isbn13, updatedAt, createdAt',
  [TABLES.lifeDashboardLayout]: 'id, createdAt, updatedAt',
  [TABLES.stocks]: 'id, symbol, name, pinned, updatedAt, createdAt',
} as const

export const schemaV31 = {
  ...schemaV30,
  [TABLES.media]: 'id, source, sourceId, tmdbId, mediaType, title, status, progress, releaseDate, updatedAt, createdAt',
} as const

export const schemaV32 = {
  ...schemaV31,
  [TABLES.tasks]:
    'id, pinned, isToday, status, priority, dueDate, startDate, endDate, reminderAt, reminderFiredAt, createdAt, updatedAt',
} as const

export const schemaV33 = {
  ...schemaV32,
  [TABLES.trips]: 'id, destination, status, startDate, endDate, updatedAt, createdAt',
} as const

export const schemaV34 = {
  ...schemaV33,
  [TABLES.lifePodcasts]: 'id, source, sourceId, collectionId, name, author, updatedAt, createdAt',
  [TABLES.lifePeople]: 'id, name, group, birthday, lastInteraction, updatedAt, createdAt',
} as const
