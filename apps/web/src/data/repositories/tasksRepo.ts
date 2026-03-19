import type { TaskItem, TaskStatus } from '../models/types'
import { dbService } from '../services/dbService'

type TaskCreateInput = {
  title: string
  description?: string
  pinned?: boolean
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
}
