import type { TaskItem, TaskStatus } from '../models/types'
import { dbService } from '../services/dbService'

type TaskCreateInput = {
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
  },
  async updateStatus(id: string, status: TaskStatus) {
    return dbService.tasks.updateStatus(id, status)
  },
  async clearAllTags() {
    await dbService.tasks.clearAllTags()
  },
  /** On a new day, remove completed tasks from the today list while keeping incomplete ones. */
  async clearDoneToday() {
    const all = await dbService.tasks.list()
    const toReset = all.filter((t) => t.isToday && t.status === 'done')
    if (toReset.length === 0) return
    await Promise.all(toReset.map((t) => dbService.tasks.update({ ...t, isToday: false })))
  },
}
