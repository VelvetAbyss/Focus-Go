import type { ProjectHealth, ProjectItem, TaskItem } from '../../../data/models/types'
import { getDeterministicProjectColor } from '../../../shared/design/tokens'
import { isTaskBlocked, isTaskDone, isTaskOpen, isTaskOverdue, rankNextActionTask } from '../../tasks/domain/taskRules'

export const clampProjectProgress = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

export const deriveProjectProgress = (tasks: TaskItem[]) => {
  // Dropped tasks are out of scope: they neither count as done nor hold the bar back.
  const inScope = tasks.filter((task) => task.status !== 'dropped')
  if (inScope.length === 0) return 0
  const doneCount = inScope.filter(isTaskDone).length
  return clampProjectProgress((doneCount / inScope.length) * 100)
}

export const deriveProjectHealth = (project: ProjectItem, tasks: TaskItem[], now = Date.now()): ProjectHealth => {
  if (project.status === 'blocked') return 'blocked'
  if (tasks.some(isTaskBlocked)) return 'blocked'
  if (tasks.some((task) => isTaskOverdue(task, now))) return 'at-risk'
  if (project.dueDate) {
    const due = new Date(project.dueDate).getTime()
    const daysLeft = Math.ceil((due - now) / (24 * 60 * 60 * 1000))
    if (daysLeft <= 7 && deriveProjectProgress(tasks) < 80) return 'at-risk'
  }
  return 'on-track'
}

export const deriveNextAction = (project: ProjectItem, tasks: TaskItem[]) => {
  if (project.nextAction?.trim()) return project.nextAction.trim()
  const candidate = [...tasks]
    // The next action is something you can do now: not finished, not blocked, not in someone else's hands.
    .filter((task) => isTaskOpen(task) && task.status !== 'waiting' && !isTaskBlocked(task))
    .sort(rankNextActionTask)[0]
  return candidate?.title ?? ''
}

export const summarizeProject = (project: ProjectItem, tasks: TaskItem[], now = Date.now()): ProjectItem => ({
  ...project,
  color: project.color ?? getDeterministicProjectColor(project.id),
  progress: deriveProjectProgress(tasks),
  health: deriveProjectHealth(project, tasks, now),
  nextAction: deriveNextAction(project, tasks),
})
