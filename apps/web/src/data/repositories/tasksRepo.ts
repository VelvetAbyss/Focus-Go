import type { TaskItem, TaskNoteLink, TaskProgressEntry, TaskStatus } from '../models/types'
import { dbService } from '../services/dbService'
import { buildNextOccurrence } from '../../features/tasks/domain/taskRecurrence'
import { isTaskClosed } from '../../features/tasks/domain/taskRules'

type TaskCreateInput = {
  title: string
  description?: string
  pinned?: boolean
  isToday?: boolean
  status: TaskStatus
  priority: TaskItem['priority']
  projectId?: string
  ownerId?: string
  collaboratorIds?: string[]
  dependencyTaskIds?: string[]
  blockedByTaskIds?: string[]
  isBlocked?: boolean
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
  attachments?: TaskItem['attachments']
  waitingOn?: TaskItem['waitingOn']
  recurrence?: TaskItem['recurrence']
}

export const tasksRepo = {
  async list() {
    return dbService.tasks.list()
  },
  async add(data: TaskCreateInput) {
    return dbService.tasks.add(data)
  },
  async update(task: TaskItem) {
    return dbService.tasks.update(task)
  },
  /** Deletes the task and its note links; returns the links so `restore` can undo it. */
  async remove(id: string): Promise<TaskNoteLink[]> {
    await dbService.tasks.remove(id)
    try {
      const { taskNoteLinksRepo } = await import('./taskNoteLinksRepo')
      return await taskNoteLinksRepo.unlinkAllForTask(id)
    } catch (error) {
      console.error('[tasksRepo] unlinkAllForTask failed', id, error)
      return []
    }
  },
  /** Undoes `remove`: writes the task back (with a fresh updatedAt, so sync treats it as newer than the delete). */
  async restore(task: TaskItem, links: TaskNoteLink[] = []) {
    const restored = await dbService.tasks.update(task)
    if (links.length > 0) {
      const { taskNoteLinksRepo } = await import('./taskNoteLinksRepo')
      await taskNoteLinksRepo.restoreLinks(links)
    }
    return restored
  },
  /** Changes status and applies what the new status implies; returns the task as finally stored. */
  async updateStatus(id: string, status: TaskStatus) {
    const updated = await dbService.tasks.updateStatus(id, status)
    if (!updated) return updated
    return applyStatusSideEffects(updated)
  },
  async clearAllTags() {
    await dbService.tasks.clearAllTags()
  },
  async setProgressNote(task: TaskItem, text: string) {
    const trimmed = text.trim()
    const previousText = (task.progressNote ?? '').trim()
    const history: TaskProgressEntry[] = Array.isArray(task.progressHistory) ? [...task.progressHistory] : []
    if (previousText && previousText !== trimmed) {
      history.unshift({
        id:
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        text: previousText,
        createdAt: task.progressNoteUpdatedAt ?? task.updatedAt ?? Date.now(),
      })
    }
    const next: TaskItem = {
      ...task,
      progressNote: trimmed || undefined,
      progressNoteUpdatedAt: trimmed ? Date.now() : task.progressNoteUpdatedAt,
      progressHistory: history.slice(0, 50),
    }
    return dbService.tasks.update(next)
  },
  async removeProgressEntry(task: TaskItem, entryId: string) {
    const history = (task.progressHistory ?? []).filter((entry) => entry.id !== entryId)
    return dbService.tasks.update({ ...task, progressHistory: history })
  },
  /** On a new day, remove completed tasks from the today list while keeping incomplete ones. */
  async clearDoneToday() {
    const all = await dbService.tasks.list()
    const toReset = all.filter((t) => t.isToday && isTaskClosed(t))
    if (toReset.length === 0) return
    await Promise.all(toReset.map((t) => dbService.tasks.update({ ...t, isToday: false })))
  },
}

/**
 * What a status means beyond the status field. Idempotent, so re-applying a status is harmless:
 * - waiting records since when (for "waited 6 days"); leaving waiting clears it.
 * - dropped leaves 今日; leaving dropped forgets the reason.
 * - finishing or dropping a repeating task creates the next occurrence and hands it the rule.
 * - reopening takes that occurrence back if it hasn't been touched, and the rule with it.
 */
const applyStatusSideEffects = async (task: TaskItem): Promise<TaskItem> => {
  const patch: Partial<TaskItem> = {}
  if (task.status === 'waiting') {
    if (typeof task.waitingSince !== 'number') patch.waitingSince = Date.now()
  } else if (task.waitingSince !== undefined) {
    patch.waitingSince = undefined
  }
  if (task.status === 'dropped') {
    if (task.isToday) patch.isToday = false
  } else if (task.dropReason !== undefined) {
    patch.dropReason = undefined
  }

  if (isTaskClosed(task) && task.recurrence && !task.recurrenceNextId) {
    const next = buildNextOccurrence(task)
    if (next) {
      const created = await dbService.tasks.add(next)
      patch.recurrence = undefined
      patch.recurrenceNextId = created.id
    }
  } else if (!isTaskClosed(task) && task.recurrenceNextId) {
    const next = (await dbService.tasks.list()).find((item) => item.id === task.recurrenceNextId)
    // Untouched since it was created: safe to take back. Otherwise it has a life of its own and
    // keeps the rule; this one stays a one-off.
    if (next && next.status === 'todo' && next.updatedAt === next.createdAt) {
      await tasksRepo.remove(next.id)
      patch.recurrence = next.recurrence
    }
    patch.recurrenceNextId = undefined
  }

  if (Object.keys(patch).length === 0) return task
  return dbService.tasks.update({ ...task, ...patch })
}
