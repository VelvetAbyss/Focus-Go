import type { ProjectItem } from '../../../data/models/types'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import type { TaskItem, TaskStatus } from '../tasks.types'
import { parseQuickAdd, type ParsedQuickAdd } from '../parseQuickAdd'

export type CreateTaskInput = {
  title: string
  description?: string
  pinned?: boolean
  isToday?: boolean
  status?: TaskStatus
  priority?: TaskItem['priority']
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
  tags?: string[]
  subtasks?: TaskItem['subtasks']
  taskNoteBlocks?: TaskItem['taskNoteBlocks']
  taskNoteContentMd?: TaskItem['taskNoteContentMd']
  taskNoteContentJson?: TaskItem['taskNoteContentJson']
}

export type CreateProjectTaskInput = Omit<CreateTaskInput, 'projectId'> & {
  projectId: string
}

export type QuickAddTaskContext = {
  projects: ProjectItem[]
  fallbackProjectId?: string
}

export const parseQuickAddTaskInput = (
  rawTitle: string,
  context: QuickAddTaskContext,
): Promise<ParsedQuickAdd> => parseQuickAdd(rawTitle, context.projects, context.fallbackProjectId)

export const createTask = (input: CreateTaskInput) =>
  tasksRepo.add({
    title: input.title,
    description: input.description,
    pinned: input.pinned,
    isToday: input.isToday,
    status: input.status ?? 'todo',
    priority: input.priority ?? null,
    projectId: input.projectId,
    ownerId: input.ownerId,
    collaboratorIds: input.collaboratorIds,
    dependencyTaskIds: input.dependencyTaskIds,
    blockedByTaskIds: input.blockedByTaskIds,
    isBlocked: input.isBlocked,
    dueDate: input.dueDate,
    startDate: input.startDate,
    endDate: input.endDate,
    reminderAt: input.reminderAt,
    tags: input.tags,
    subtasks: input.subtasks,
    taskNoteBlocks: input.taskNoteBlocks,
    taskNoteContentMd: input.taskNoteContentMd,
    taskNoteContentJson: input.taskNoteContentJson,
  })

export const createProjectTask = (input: CreateProjectTaskInput) =>
  createTask({
    ...input,
    projectId: input.projectId,
    tags: input.tags ?? [],
    subtasks: input.subtasks ?? [],
    collaboratorIds: input.collaboratorIds ?? [],
    dependencyTaskIds: input.dependencyTaskIds ?? [],
    blockedByTaskIds: input.blockedByTaskIds ?? [],
    isBlocked: input.isBlocked ?? false,
  })

export const updateTaskStatus = (id: string, status: TaskStatus) => tasksRepo.updateStatus(id, status)
