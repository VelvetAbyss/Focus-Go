import { db } from '../db'
import type { TaskItem, TaskStatus } from '../models/types'
import { touch, withBase } from './base'
import { createId } from '../../shared/utils/ids'

type TaskCreateInput = {
  title: string
  description?: string
  status: TaskStatus
  priority: TaskItem['priority']
  dueDate?: string
  tags?: string[]
  subtasks?: TaskItem['subtasks']
}

const statusLabelMap: Record<TaskStatus, string> = {
  todo: 'Todo',
  doing: 'Doing',
  done: 'Done',
}

const normalizeTask = (task: TaskItem): TaskItem => ({
  ...task,
  description: typeof task.description === 'string' ? task.description : '',
  tags: Array.isArray(task.tags) ? task.tags : [],
  subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  progressLogs: Array.isArray(task.progressLogs) ? task.progressLogs : [],
  activityLogs: Array.isArray(task.activityLogs) ? task.activityLogs : [],
})

export const tasksRepo = {
  async list() {
    const tasks = await db.tasks.toArray()
    const normalized = tasks.map((task) => normalizeTask(task))
    const changed = tasks.some((task, index) => {
      const next = normalized[index]
      return (
        task.description !== next.description ||
        task.tags !== next.tags ||
        task.subtasks !== next.subtasks ||
        task.progressLogs !== next.progressLogs ||
        task.activityLogs !== next.activityLogs
      )
    })
    if (changed) await db.tasks.bulkPut(normalized)
    return normalized
  },
  async add(data: TaskCreateInput) {
    const task: TaskItem = withBase({
      title: data.title,
      description: data.description ?? '',
      status: data.status,
      priority: data.priority ?? null,
      dueDate: data.dueDate,
      tags: data.tags ?? [],
      subtasks: data.subtasks ?? [],
      progressLogs: [],
      activityLogs: [],
    })
    const now = Date.now()
    task.activityLogs = [
      {
        id: createId(),
        type: 'status' as const,
        message: `Created in ${statusLabelMap[task.status]}`,
        createdAt: now,
      },
    ]
    await db.tasks.add(task)
    return task
  },
  async update(task: TaskItem) {
    const next = touch(normalizeTask(task))
    await db.tasks.put(next)
    return next
  },
  async remove(id: string) {
    await db.tasks.delete(id)
  },
  async updateStatus(id: string, status: TaskStatus) {
    const task = await db.tasks.get(id)
    if (!task) return undefined
    const normalized = normalizeTask(task)
    if (normalized.status === status) return normalized
    const now = Date.now()
    const next = touch({
      ...normalized,
      status,
      activityLogs: [
        ...normalized.activityLogs,
        {
          id: createId(),
          type: 'status' as const,
          message: `Status changed to ${statusLabelMap[status]}`,
          createdAt: now,
        },
      ],
    })
    await db.tasks.put(next)
    return next
  },
  async appendProgress(id: string, content: string) {
    const task = await db.tasks.get(id)
    if (!task) return undefined
    const normalized = normalizeTask(task)
    const text = content.trim()
    if (!text) return normalized
    const now = Date.now()
    const next = touch({
      ...normalized,
      progressLogs: [
        ...normalized.progressLogs,
        {
          id: createId(),
          content: text,
          createdAt: now,
        },
      ],
      activityLogs: [
        ...normalized.activityLogs,
        {
          id: createId(),
          type: 'progress' as const,
          message: `Progress added: ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`,
          createdAt: now,
        },
      ],
    })
    await db.tasks.put(next)
    return next
  },
  async clearAllTags() {
    const tasks = await db.tasks.toArray()
    const tagged = tasks.map((task) => normalizeTask(task)).filter((task) => task.tags.length > 0)
    if (tagged.length === 0) return
    await db.tasks.bulkPut(tagged.map((task) => touch({ ...task, tags: [] })))
  },
}
