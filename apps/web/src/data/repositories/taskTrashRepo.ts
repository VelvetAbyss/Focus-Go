import { db } from '../db'
import type { TaskItem, TaskNoteLink, TaskTrashEntry } from '../models/types'

export const TASK_TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Deleted tasks, kept on this device for 30 days.
 *
 * The delete itself still syncs as a delete, so every device (including older builds) drops the
 * task. Restoring writes it back with a fresh updatedAt, which the server takes over its tombstone.
 */
export const taskTrashRepo = {
  async keep(task: TaskItem, links: TaskNoteLink[], deletedAt = Date.now()) {
    await db.taskTrash.put({ id: task.id, task, links, deletedAt })
  },
  /** Newest first; drops what has been there longer than 30 days. */
  async list(now = Date.now()): Promise<TaskTrashEntry[]> {
    await db.taskTrash.where('deletedAt').below(now - TASK_TRASH_RETENTION_MS).delete()
    return db.taskTrash.orderBy('deletedAt').reverse().toArray()
  },
  async get(id: string) {
    return db.taskTrash.get(id)
  },
  async discard(id: string) {
    await db.taskTrash.delete(id)
  },
  async clear() {
    await db.taskTrash.clear()
  },
}
