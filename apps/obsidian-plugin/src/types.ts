// Mirrors the subset of `apps/web/src/data/models/types.ts` this plugin touches.
// Deliberately structural rather than imported: the plugin bundles standalone and
// must not pull the web app's module graph in.

export type TaskStatus = 'todo' | 'doing' | 'done'
export type TaskPriority = 'high' | 'medium' | 'low'

export const TASK_STATUSES: readonly TaskStatus[] = ['todo', 'doing', 'done']
export const TASK_PRIORITIES: readonly TaskPriority[] = ['high', 'medium', 'low']

export type TaskSubtask = {
  id: string
  title: string
  done: boolean
}

export type TaskItem = {
  id: string
  createdAt: number
  updatedAt: number
  title: string
  description: string
  pinned: boolean
  isToday: boolean
  status: TaskStatus
  priority: TaskPriority | null
  projectId?: string
  dueDate?: string
  startDate?: string
  endDate?: string
  tags: string[]
  subtasks: TaskSubtask[]
  taskNoteBlocks: unknown[]
  taskNoteContentMd?: string
  taskNoteContentJson?: Record<string, unknown> | null
  // Everything else on the real TaskItem (activityLogs, attachments,
  // progressHistory, dependency ids…) is carried through untouched and is
  // deliberately not modelled here.
  [key: string]: unknown
}

/**
 * The fields this plugin is allowed to write back. Anything outside this set is
 * preserved verbatim from the last-known remote document — see `applyMapped`.
 */
export type MappedTaskFields = {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority | null
  dueDate?: string
  startDate?: string
  endDate?: string
  tags: string[]
  pinned: boolean
  isToday: boolean
  subtasks: TaskSubtask[]
  taskNoteContentMd: string
}

export const MAPPED_FIELD_KEYS = [
  'title',
  'description',
  'status',
  'priority',
  'dueDate',
  'startDate',
  'endDate',
  'tags',
  'pinned',
  'isToday',
  'subtasks',
  'taskNoteContentMd',
] as const satisfies readonly (keyof MappedTaskFields)[]

/** A document in the shape the sync wire protocol uses. */
export type WireDocument = Record<string, unknown> & {
  id: string
  updatedAt: number
  _deleted?: boolean
}

export type SyncWireBlob = {
  hash: string
  contentType: string
  compression: string
  rawByteLength: number
  byteLength: number
  dataBase64: string
}
