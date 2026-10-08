import type { TaskItem, TaskStatus } from '../../../data/models/types'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { blockedForExecution, localDateKey } from './taskWorkspaceModel'

export type WaitingDetails = { who: string; followUpDate: string }
export class WorkflowError extends Error {
  code: 'blocked' | 'waitingRequired' | 'missingTask'
  constructor(code: 'blocked' | 'waitingRequired' | 'missingTask') { super(code); this.code = code }
}
export const validLocalDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return Number.isFinite(date.getTime()) && localDateKey(date.getTime()) === value
}

/** Always re-read before mutation so a list snapshot cannot overwrite detail/sync edits. */
export const planTaskToday = async (id: string, planned: boolean) => {
  const task = (await tasksRepo.list()).find(item => item.id === id)
  if (!task) throw new WorkflowError('missingTask')
  return tasksRepo.update({ ...task, isToday: planned })
}

export const moveWorkflowTask = async (id: string, status: TaskStatus, waiting?: WaitingDetails) => {
  const all = await tasksRepo.list()
  const task = all.find(item => item.id === id)
  if (!task) throw new WorkflowError('missingTask')
  if (status === 'doing' && blockedForExecution(task, all)) throw new WorkflowError('blocked')
  if (status === 'waiting') {
    if (!waiting?.who.trim() || !validLocalDate(waiting.followUpDate)) throw new WorkflowError('waitingRequired')
    // Save the waiting context before status, so a failed status transition leaves no waiting task without context.
    await tasksRepo.update({ ...task, waitingOn: waiting.who.trim(), dueDate: waiting.followUpDate })
  }
  try {
    const result = await tasksRepo.updateStatus(id, status)
    if (!result) throw new WorkflowError('missingTask')
    return result
  } catch (error) {
    if (status === 'waiting' && waiting) {
      const latest = (await tasksRepo.list()).find(item => item.id === id)
      if (latest && latest.status === task.status && latest.waitingOn === waiting.who.trim() && latest.dueDate === waiting.followUpDate) {
        await tasksRepo.update({ ...latest, waitingOn: task.waitingOn, dueDate: task.dueDate })
      }
    }
    throw error
  }
}
export const rescheduleWorkflowTask = async (id: string, date: string | undefined) => {
  const latest = (await tasksRepo.list()).find(item => item.id === id)
  if (!latest) throw new WorkflowError('missingTask')
  if (date && !validLocalDate(date)) throw new WorkflowError('waitingRequired')
  return tasksRepo.update({ ...latest, dueDate: date, isToday: date === localDateKey(Date.now()) ? latest.isToday : false })
}
export const workflowNextStatus = (task: TaskItem): TaskStatus =>
  task.status === 'todo' || task.status === 'waiting' ? 'doing' : task.status === 'doing' ? 'done' : task.status === 'verify' ? 'done' : 'todo'
