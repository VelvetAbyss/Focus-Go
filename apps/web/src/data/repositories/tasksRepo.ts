import type { TaskItem, TaskProgressEntry, TaskStatus } from '../models/types'
import { dbService } from '../services/dbService'

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
  async remove(id: string) {
    await dbService.tasks.remove(id)
    try {
      const { taskNoteLinksRepo } = await import('./taskNoteLinksRepo')
      await taskNoteLinksRepo.unlinkAllForTask(id)
    } catch (error) {
      console.error('[tasksRepo] unlinkAllForTask failed', id, error)
    }
  },
  async updateStatus(id: string, status: TaskStatus) {
    return dbService.tasks.updateStatus(id, status)
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
    const toReset = all.filter((t) => t.isToday && t.status === 'done')
    if (toReset.length === 0) return
    await Promise.all(toReset.map((t) => dbService.tasks.update({ ...t, isToday: false })))
  },
}
