import { db } from '../db'
import type { ProjectHealth, ProjectItem, ProjectStatus } from '../models/types'
import { enqueueSyncOperation } from '../sync/repository'
import type { DomainEvent } from '../models/types'
import { finalizeDomainEvent } from '../events/domainEventsRepo'
import { publishDomainEvent } from '../events/publisher'
import { touch, withBase } from './base'
import { noteTagsRepo } from './noteTagsRepo'
import { summarizeProject } from '../../features/projects/domain/projectSummary'

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

export const projectTagName = toProjectTag

export const projectsRepo = {
  async list() {
    const [projects, tasks] = await Promise.all([db.projects.orderBy('updatedAt').reverse().toArray(), db.tasks.toArray()])
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id)
      return summarizeProject(project, projectTasks)
    })
  },
  async getById(id: string) {
    const [project, tasks] = await Promise.all([db.projects.get(id), db.tasks.toArray()])
    if (!project) return null
    const projectTasks = tasks.filter((task) => task.projectId === id)
    return summarizeProject(project, projectTasks)
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
    let event: DomainEvent | undefined
    await db.transaction('rw', db.projects, db.domainEvents, async () => {
      await db.projects.add(project)
      event = await publishDomainEvent({
        type: 'project.created',
        occurredAt: project.createdAt,
        subject: { domain: 'productivity', type: 'project', id: project.id },
        payload: {
          title: project.title,
          status: project.status,
          priority: project.priority,
          dueDate: project.dueDate,
        },
        dedupeKey: `project.created:${project.id}`,
      })
    })
    await enqueueSyncOperation('projects', 'upsert', project)
    await finalizeDomainEvent(event)
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
    const previousStatus = current.status
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
    let event: DomainEvent | undefined
    await db.transaction('rw', db.projects, db.domainEvents, async () => {
      await db.projects.put(next)
      if (previousStatus !== 'archived' && next.status === 'archived') {
        event = await publishDomainEvent({
          type: 'project.archived',
          occurredAt: next.updatedAt,
          subject: { domain: 'productivity', type: 'project', id: next.id },
          payload: {
            title: next.title,
            archivedAt: next.updatedAt,
          },
          dedupeKey: `project.archived:${next.id}:${next.updatedAt}`,
        })
      }
    })
    await enqueueSyncOperation('projects', 'upsert', next)
    await finalizeDomainEvent(event)
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
