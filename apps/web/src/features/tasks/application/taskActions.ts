import type { ProjectItem } from '../../../data/models/types'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import type { TaskItem, TaskStatus } from '../tasks.types'
import { parseQuickAdd, type ParsedQuickAdd } from '../parseQuickAdd'
import { playInteractionSound } from '../../../shared/sound/interactionSounds'

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
  attachments?: TaskItem['attachments']
  waitingOn?: TaskItem['waitingOn']
  recurrence?: TaskItem['recurrence']
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

export const createTask = async (input: CreateTaskInput) => {
  const created = await tasksRepo.add({
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
    attachments: input.attachments,
    waitingOn: input.waitingOn,
    recurrence: input.recurrence,
  })
  playInteractionSound('create')
  return created
}

/**
 * One line in the quick-add syntax ("明天下午3点 开会 #工作 !1", "等 Lisa 回复报价") becomes a task.
 * Used by ⌘K and the desktop quick-capture box.
 */
export const createTaskFromQuickInput = async (raw: string) => {
  const parsed = await parseQuickAddTaskInput(raw.trim(), { projects: await projectsRepo.list() })
  return createTask({
    title: parsed.title,
    status: parsed.waitingOn ? 'waiting' : 'todo',
    waitingOn: parsed.waitingOn,
    priority: parsed.priority,
    isToday: parsed.isToday,
    dueDate: parsed.dueDate,
    reminderAt: parsed.reminderAt,
    recurrence: parsed.recurrence,
    projectId: parsed.projectId,
    tags: parsed.tags,
    subtasks: [],
  })
}

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
