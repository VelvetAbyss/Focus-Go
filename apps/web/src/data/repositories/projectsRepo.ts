import { db } from '../db'
import type { ProjectHealth, ProjectItem, ProjectStatus, TaskItem } from '../models/types'
import { enqueueSyncOperation } from '../sync/repository'
import { touch, withBase } from './base'
import { noteTagsRepo } from './noteTagsRepo'
import { getDeterministicProjectColor } from '../../shared/design/tokens'

export type ProjectCreateInput = {
  title: string
  description?: string
  goal?: string
  status?: ProjectStatus
  priority?: ProjectItem['priority']
  ownerId?: string
  startDate?: string
  dueDate?: string
  nextAction?: string
  riskSummary?: string
  color?: string
}

const toProjectTag = (projectId: string) => `project:${projectId}`

const clampProgress = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

const deriveProjectProgress = (tasks: TaskItem[]) => {
  if (tasks.length === 0) return 0
  const doneCount = tasks.filter((task) => task.status === 'done').length
  return clampProgress((doneCount / tasks.length) * 100)
}

const deriveProjectHealth = (project: ProjectItem, tasks: TaskItem[]): ProjectHealth => {
  if (project.status === 'blocked') return 'blocked'
  const hasBlockedTask = tasks.some((task) => task.isBlocked || (task.blockedByTaskIds?.length ?? 0) > 0)
  if (hasBlockedTask) return 'blocked'
  const todayKey = new Date().toISOString().slice(0, 10)
  const overdueCount = tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate < todayKey).length
  if (overdueCount > 0) return 'at-risk'
  if (project.dueDate) {
    const due = new Date(project.dueDate).getTime()
    const daysLeft = Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000))
    if (daysLeft <= 7 && deriveProjectProgress(tasks) < 80) return 'at-risk'
  }
  return 'on-track'
}

const deriveNextAction = (project: ProjectItem, tasks: TaskItem[]) => {
  if (project.nextAction?.trim()) return project.nextAction.trim()
  const priorityOrder: Record<NonNullable<TaskItem['priority']>, number> = { high: 0, medium: 1, low: 2 }
  const candidate = [...tasks]
    .filter((task) => task.status !== 'done' && !task.isBlocked)
    .sort((left, right) => {
      const leftScore = left.priority ? priorityOrder[left.priority] : 99
      const rightScore = right.priority ? priorityOrder[right.priority] : 99
      if (leftScore !== rightScore) return leftScore - rightScore
      return (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31')
    })[0]
  return candidate?.title ?? ''
}

export const projectTagName = toProjectTag

export const projectsRepo = {
  async list() {
    const [projects, tasks] = await Promise.all([db.projects.orderBy('updatedAt').reverse().toArray(), db.tasks.toArray()])
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id)
      return {
        ...project,
        color: project.color ?? getDeterministicProjectColor(project.id),
        progress: deriveProjectProgress(projectTasks),
        health: deriveProjectHealth(project, projectTasks),
        nextAction: deriveNextAction(project, projectTasks),
      }
    })
  },
  async getById(id: string) {
    const [project, tasks] = await Promise.all([db.projects.get(id), db.tasks.toArray()])
    if (!project) return null
    const projectTasks = tasks.filter((task) => task.projectId === id)
    return {
      ...project,
      color: project.color ?? getDeterministicProjectColor(project.id),
      progress: deriveProjectProgress(projectTasks),
      health: deriveProjectHealth(project, projectTasks),
      nextAction: deriveNextAction(project, projectTasks),
    }
  },
  async create(data: ProjectCreateInput) {
    const project = withBase({
      title: data.title.trim(),
      description: data.description?.trim() ?? '',
      goal: data.goal?.trim() ?? '',
      color: data.color?.trim() || undefined,
      status: data.status ?? 'planning',
      priority: data.priority ?? 'medium',
      ownerId: data.ownerId,
      startDate: data.startDate,
      dueDate: data.dueDate,
      health: 'on-track' as ProjectHealth,
      progress: 0,
      nextAction: data.nextAction?.trim() ?? '',
      riskSummary: data.riskSummary?.trim() ?? '',
    } satisfies Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>)
    await db.projects.add(project)
    await enqueueSyncOperation('projects', 'upsert', project)
    const existingTags = await noteTagsRepo.list()
    const tagName = toProjectTag(project.id)
    if (!existingTags.find((tag) => tag.name === tagName)) {
      await noteTagsRepo.create({
        name: tagName,
        pinned: false,
        parentId: null,
        sortOrder: existingTags.length,
      })
    }
    return project
  },
  async update(id: string, patch: Partial<Omit<ProjectItem, 'id' | 'createdAt' | 'updatedAt'>>) {
    const current = await db.projects.get(id)
    if (!current) return null
    const next = touch({
      ...current,
      ...patch,
      title: typeof patch.title === 'string' ? patch.title.trim() : current.title,
      description: typeof patch.description === 'string' ? patch.description.trim() : current.description,
      goal: typeof patch.goal === 'string' ? patch.goal.trim() : current.goal,
      color: typeof patch.color === 'string' ? patch.color.trim() : current.color,
      nextAction: typeof patch.nextAction === 'string' ? patch.nextAction.trim() : current.nextAction,
      riskSummary: typeof patch.riskSummary === 'string' ? patch.riskSummary.trim() : current.riskSummary,
    })
    await db.projects.put(next)
    await enqueueSyncOperation('projects', 'upsert', next)
    return next
  },
  async archive(id: string) {
    return this.update(id, { status: 'archived' })
  },
  async remove(id: string) {
    const project = await db.projects.get(id)
    if (!project) return
    const deletedAt = Date.now()
    const [tasks, people, noteLinks] = await Promise.all([
      db.tasks.where('projectId').equals(id).toArray(),
      db.projectPeople.where('projectId').equals(id).toArray(),
      db.projectNoteLinks.where('projectId').equals(id).toArray(),
    ])
    const updatedTasks = tasks.map((task) => ({ ...task, projectId: undefined, updatedAt: deletedAt }))
    await db.transaction('rw', db.projects, db.tasks, db.projectPeople, db.projectNoteLinks, async () => {
      if (updatedTasks.length) await db.tasks.bulkPut(updatedTasks)
      await db.projectPeople.bulkDelete(people.map((person) => person.id))
      await db.projectNoteLinks.bulkDelete(noteLinks.map((link) => link.id))
      await db.projects.delete(id)
    })
    await Promise.all([
      enqueueSyncOperation('projects', 'delete', { id, updatedAt: deletedAt, title: project.title }, deletedAt),
      ...updatedTasks.map((task) => enqueueSyncOperation('tasks', 'upsert', task, deletedAt)),
      ...people.map((person) => enqueueSyncOperation('projectPeople', 'delete', { id: person.id, updatedAt: deletedAt, projectId: id }, deletedAt)),
      ...noteLinks.map((link) => enqueueSyncOperation('projectNoteLinks', 'delete', { id: link.id, updatedAt: deletedAt, projectId: id, noteId: link.noteId }, deletedAt)),
    ])
  },
}
