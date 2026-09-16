import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, FolderKanban, LayoutGrid, Plus, Square, SunMedium, Tag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { projectsRepo } from '../../data/repositories/projectsRepo'
import type { ProjectItem } from '../../data/models/types'
import type { TaskItem, TaskPriority, TaskStatus } from './tasks.types'
import TaskDrawer from './TaskDrawer'
import Card from '../../shared/ui/Card'
import Dialog from '../../shared/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import TaskCard from './components/TaskCard'
import TaskAddComposer, { type TaskAddComposerHandle } from './components/TaskAddComposer'
import TasksAnalyticsView from './components/TasksAnalyticsView'
import TaskListView from './components/TaskListView'
import { useToast } from '../../shared/ui/toast/toast'
import { emitTasksChanged, subscribeTasksChanged } from './taskSync'
import { useSyncDataRefresh } from '../../data/sync/service'
import { readTaskTodayBucket, shouldClearTodayDoneTasks, writeTaskTodayBucket } from './taskTodayRefresh'
import { TASK_STATUS_CONFIG, getUpcomingDeadlineAlert } from './components/taskPresentation'
import { useI18n } from '../../shared/i18n/useI18n'
import { useAuthGate } from '../auth/AuthGateContext'
import { DiscoveryEmptyState } from '../../shared/ui/EmptyState'
import { DiscoveryHint } from '../../shared/ui/DiscoveryHint'
import { resolveProjectColor } from '../../shared/design/tokens'
import { createTask, parseQuickAddTaskInput } from './application/taskActions'

const tabs: { key: TaskStatus }[] = [{ key: 'todo' }, { key: 'doing' }, { key: 'done' }]

type SortMode = 'importance' | 'time'
type TagFilterMode = 'all' | 'work' | 'life' | 'health' | 'study' | 'finance' | 'family'
type TopView = 'board' | 'today' | 'list' | 'analytics'
type BoardGroupBy = 'status' | 'project' | 'today'
type BoardScope = { kind: 'all' } | { kind: 'project'; projectId: string } | { kind: 'today' }

const STORAGE_TAB_KEY = 'tasks_active_tab'
const STORAGE_SORT_KEY = 'tasks_sort_mode'
const STORAGE_TAGS_MIGRATION_KEY = 'tasks_tags_select_v2_migrated'
const STORAGE_GROUP_BY_KEY = 'tasks_group_by_v1'
const STORAGE_PROJECT_FILTER_KEY = 'tasks_project_filter_v1'

const priorityOrder: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const tagFilterOptions: { value: TagFilterMode; label: string }[] = [
  { value: 'all', label: 'All tags' },
  { value: 'work', label: 'Work' },
  { value: 'life', label: 'Life' },
  { value: 'health', label: 'Health' },
  { value: 'study', label: 'Study' },
  { value: 'finance', label: 'Finance' },
  { value: 'family', label: 'Family' },
]

const sortByImportance = (a: TaskItem, b: TaskItem) => {
  const pa = a.priority ? priorityOrder[a.priority] : Number.POSITIVE_INFINITY
  const pb = b.priority ? priorityOrder[b.priority] : Number.POSITIVE_INFINITY
  if (pa !== pb) return pa - pb
  return b.createdAt - a.createdAt
}

const sortByTime = (a: TaskItem, b: TaskItem) => b.createdAt - a.createdAt

type TasksBoardProps = {
  asCard?: boolean
  className?: string
  topView?: TopView
  scope?: BoardScope
}

const TasksBoard = ({
  asCard = true,
  className,
  topView = 'board',
  scope = { kind: 'all' },
}: TasksBoardProps) => {
  const { t } = useI18n()
  const { isGated, requireAuth } = useAuthGate()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [bulkProjectDraft, setBulkProjectDraft] = useState('')
  const [composerProjectId, setComposerProjectId] = useState<string | undefined>(undefined)
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'importance'
    const stored = window.localStorage.getItem(STORAGE_SORT_KEY)
    return stored === 'time' || stored === 'importance' ? stored : 'importance'
  })
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [statusActionLoadingTaskId, setStatusActionLoadingTaskId] = useState<string | null>(null)
  const [statusActionLoadingKey, setStatusActionLoadingKey] = useState<string | null>(null)
  const [statusActionSuccessTaskId, setStatusActionSuccessTaskId] = useState<string | null>(null)
  const [statusActionSuccessKey, setStatusActionSuccessKey] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [bulkTagDraft, setBulkTagDraft] = useState('')
  const [groupBy, setGroupBy] = useState<BoardGroupBy>(() => {
    if (typeof window === 'undefined') return 'status'
    const stored = window.localStorage.getItem(STORAGE_GROUP_BY_KEY)
    return stored === 'project' || stored === 'today' || stored === 'status' ? stored : 'status'
  })
  const [projectFilterIds, setProjectFilterIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    const stored = window.localStorage.getItem(STORAGE_PROJECT_FILTER_KEY)
    if (!stored) return new Set()
    try {
      const parsed = JSON.parse(stored)
      if (typeof parsed === 'string') return new Set([parsed])
      if (Array.isArray(parsed)) {
        const first = parsed.find((item): item is string => typeof item === 'string')
        return first ? new Set([first]) : new Set()
      }
      return new Set()
    } catch {
      return new Set()
    }
  })
  const [activeStatus, setActiveStatus] = useState<TaskStatus>(() => {
    if (typeof window === 'undefined') return 'todo'
    const stored = window.localStorage.getItem(STORAGE_TAB_KEY)
    return stored === 'todo' || stored === 'doing' || stored === 'done' ? stored : 'todo'
  })
  const statusActionSuccessTimerRef = useRef<number | null>(null)
  const tasksReloadTokenRef = useRef(0)
  const composerRef = useRef<TaskAddComposerHandle | null>(null)
  const toast = useToast()
  const effectiveGroupBy = scope.kind === 'project' ? 'status' : groupBy
  const scopeKind = scope.kind
  const scopeProjectId = scope.kind === 'project' ? scope.projectId : undefined

  const loadTasks = useCallback(async () => {
    const token = tasksReloadTokenRef.current + 1
    tasksReloadTokenRef.current = token
    const [items, projectItems] = await Promise.all([tasksRepo.list(), projectsRepo.list()])
    if (tasksReloadTokenRef.current !== token) return
    setTasks(items)
    setProjects(projectItems)
    setActiveTask((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
    setDeleteTarget((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
  }, [])

  useSyncDataRefresh(loadTasks, ['tasks', 'projects'])

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window !== 'undefined' && !window.localStorage.getItem(STORAGE_TAGS_MIGRATION_KEY)) {
        await tasksRepo.clearAllTags()
        window.localStorage.setItem(STORAGE_TAGS_MIGRATION_KEY, '1')
      }
      // Daily refresh: clear completed tasks from today list when a new day starts.
      // Incomplete today-tasks are kept so nothing gets lost.
      const storedBucket = readTaskTodayBucket()
      const { shouldClear, currentBucket } = shouldClearTodayDoneTasks(storedBucket)
      if (shouldClear) await tasksRepo.clearDoneToday()
      writeTaskTodayBucket(currentBucket)
      await loadTasks()
    }
    void bootstrap()
    return subscribeTasksChanged(() => {
      void loadTasks()
    })
  }, [loadTasks])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_TAB_KEY, activeStatus)
  }, [activeStatus])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_SORT_KEY, sortMode)
  }, [sortMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_GROUP_BY_KEY, groupBy)
  }, [groupBy])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_PROJECT_FILTER_KEY, JSON.stringify([...projectFilterIds]))
  }, [projectFilterIds])

  useEffect(() => {
    return () => {
      if (statusActionSuccessTimerRef.current) window.clearTimeout(statusActionSuccessTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isCmdK) {
        event.preventDefault()
        composerRef.current?.focus()
        return
      }
      if (isEditable) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === 'n' || event.key === 'N') {
        event.preventDefault()
        composerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 }
    const countBase = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId)
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => task.isToday)
        : tasks
    countBase.forEach((task) => counts[task.status]++)
    return counts
  }, [scope, tasks, topView])

  const statusDeadlineAlerts = useMemo(() => {
    const alerts: Record<TaskStatus, ReturnType<typeof getUpcomingDeadlineAlert>> = { todo: null, doing: null, done: null }
    const alertBase = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId)
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => task.isToday)
        : tasks
    tabs.forEach((status) => {
      alerts[status.key] = getUpcomingDeadlineAlert(alertBase.filter((task) => task.status === status.key))
    })
    return alerts
  }, [scope, tasks, topView])

  const filteredTasks = useMemo(() => {
    let result = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId && (effectiveGroupBy !== 'status' || topView === 'list' || task.status === activeStatus))
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => task.isToday)
        : topView === 'list'
          ? tasks
          : effectiveGroupBy === 'status'
            ? tasks.filter((task) => task.status === activeStatus)
            : tasks
    if (scope.kind === 'all' && projectFilterIds.size > 0) {
      result = result.filter((task) => task.projectId && projectFilterIds.has(task.projectId))
    }
    if (tagFilter.length > 0) {
      result = result.filter((task) => tagFilter.some((tag) => task.tags.some((item) => item.toLowerCase() === tag)))
    }
    const ordered = result.slice()
    ordered.sort((a, b) => {
      if (topView === 'today' && a.status === 'done' && b.status !== 'done') return 1
      if (topView === 'today' && a.status !== 'done' && b.status === 'done') return -1
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sortMode === 'time') return sortByTime(a, b)
      return sortByImportance(a, b)
    })
    return ordered
  }, [tasks, scope, topView, effectiveGroupBy, activeStatus, projectFilterIds, tagFilter, sortMode])
  const filteredTaskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks])
  const projectById = useMemo(() => {
    const map = new Map<string, ProjectItem>()
    projects.forEach((project) => map.set(project.id, project))
    return map
  }, [projects])
  const activeProjects = useMemo(() => projects.filter((project) => project.status !== 'archived'), [projects])
  const lockedComposerProjectId = scopeProjectId
  const effectiveComposerProjectId = lockedComposerProjectId ?? composerProjectId

  useEffect(() => {
    if (projectFilterIds.size === 0 || activeProjects.length === 0) return
    const validProjectIds = new Set(activeProjects.map((project) => project.id))
    setProjectFilterIds((prev) => {
      const next = [...prev].filter((projectId) => validProjectIds.has(projectId))
      if (next.length === prev.size) return prev
      return new Set(next.slice(0, 1))
    })
  }, [activeProjects, projectFilterIds.size])

  useEffect(() => {
    if (scopeKind === 'project' && scopeProjectId) {
      setComposerProjectId(scopeProjectId)
      return
    }
    const validProjectIds = new Set(activeProjects.map((project) => project.id))
    const filteredProjectId = !asCard && projectFilterIds.size === 1 ? [...projectFilterIds][0] : undefined
    setComposerProjectId((current) => {
      if (filteredProjectId && validProjectIds.has(filteredProjectId)) return filteredProjectId
      if (current && validProjectIds.has(current)) return current
      return undefined
    })
  }, [activeProjects, asCard, projectFilterIds, scopeKind, scopeProjectId])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task] as const)), [tasks])
  const projectFilterBaseTasks = useMemo(() => {
    if (scope.kind !== 'all') return []
    if (topView === 'today') return tasks.filter((task) => task.isToday)
    if (effectiveGroupBy === 'status') return tasks.filter((task) => task.status === activeStatus)
    if (effectiveGroupBy === 'today') return tasks.filter((task) => task.status !== 'done')
    return tasks
  }, [activeStatus, effectiveGroupBy, scope.kind, tasks, topView])
  const projectFilterCounts = useMemo(() => {
    const counts = new Map<string, number>()
    projectFilterBaseTasks.forEach((task) => {
      if (!task.projectId) return
      counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1)
    })
    return counts
  }, [projectFilterBaseTasks])
  const selectedCount = selectedTaskIds.size

  const bulkTagOptions = useMemo(() => {
    const seen = new Map<string, string>()
    tasks.forEach((task) => {
      task.tags.forEach((tag) => {
        const key = tag.trim().toLowerCase()
        if (!key || seen.has(key)) return
        seen.set(key, tag.trim())
      })
    })
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [tasks])

  const handleStatusChange = useCallback(async (taskId: string, nextStatus: TaskStatus) => {
    if (statusActionLoadingTaskId) return
    setStatusActionLoadingTaskId(taskId)
    setStatusActionLoadingKey(nextStatus)
    try {
      const updated = await tasksRepo.updateStatus(taskId, nextStatus)
      if (!updated) return
      emitTasksChanged('tasks-board:update-status')
      setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
      setActiveTask((prev) => (prev?.id === taskId ? updated : prev))
      setStatusActionSuccessTaskId(taskId)
      setStatusActionSuccessKey(nextStatus)
      if (statusActionSuccessTimerRef.current) window.clearTimeout(statusActionSuccessTimerRef.current)
      statusActionSuccessTimerRef.current = window.setTimeout(() => {
        setStatusActionSuccessTaskId(null)
        setStatusActionSuccessKey(null)
        statusActionSuccessTimerRef.current = null
      }, 700)
    } finally {
      setStatusActionLoadingTaskId(null)
      setStatusActionLoadingKey(null)
    }
  }, [statusActionLoadingTaskId])

  const handleDelete = useCallback(async (taskId: string) => {
    await tasksRepo.remove(taskId)
    emitTasksChanged('tasks-board:delete')
    setTasks((prev) => prev.filter((item) => item.id !== taskId))
    setActiveTask((prev) => (prev?.id === taskId ? null : prev))
    setDeleteTarget(null)
  }, [])

  const handlePin = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const updated = await tasksRepo.update({ ...task, pinned: !task.pinned })
    setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
    setActiveTask((prev) => (prev?.id === taskId ? updated : prev))
    emitTasksChanged('tasks-board:toggle-pin')
    if (task.pinned) {
      toast.push({
        message: t('tasks.unpinned'),
        actionLabel: t('tasks.undo'),
        onAction: () => {
          void (async () => {
            const restored = await tasksRepo.update({ ...updated, pinned: true })
            setTasks((prev) => prev.map((item) => (item.id === taskId ? restored : item)))
            setActiveTask((prev) => (prev?.id === taskId ? restored : prev))
            emitTasksChanged('tasks-board:undo-unpin')
          })()
        },
      })
    }
  }, [t, tasks, toast])

  const handleUpdateTask = useCallback((updated: TaskItem) => {
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setActiveTask((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const handleAddTask = useCallback(async (rawTitle: string, attachments?: TaskItem['attachments'], selectedProjectId?: string) => {
    const fallbackProjectId = scope.kind === 'project'
      ? scope.projectId
      : selectedProjectId ?? (projectFilterIds.size === 1 ? [...projectFilterIds][0] : undefined)
    const parsed = await parseQuickAddTaskInput(rawTitle, { projects, fallbackProjectId })
    const created = await createTask({
      title: parsed.title,
      status: topView === 'today' || effectiveGroupBy !== 'status' ? 'todo' : activeStatus,
      isToday: topView === 'today' || parsed.isToday === true,
      priority: parsed.priority,
      projectId: parsed.projectId,
      dueDate: parsed.dueDate,
      tags: parsed.tags,
      subtasks: [],
      attachments,
    })
    emitTasksChanged('tasks-board:create')
    setTasks((prev) => [created, ...prev])
    return true
  }, [activeStatus, effectiveGroupBy, projectFilterIds, projects, scope, topView])

  const toggleProjectFilter = useCallback((projectId: string) => {
    setProjectFilterIds((prev) => {
      if (prev.has(projectId)) return new Set()
      return new Set([projectId])
    })
  }, [])

  const handleToggleToday = useCallback(async (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const updated = await tasksRepo.update({ ...task, isToday: !task.isToday })
    setTasks((prev) => prev.map((item) => (item.id === taskId ? updated : item)))
    setActiveTask((prev) => (prev?.id === taskId ? updated : prev))
    emitTasksChanged('tasks-board:toggle-today')
  }, [tasks])

  useEffect(() => {
    setSelectedTaskIds((prev) => {
      if (prev.size === 0) return prev
      const visible = new Set(filteredTaskIds)
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [filteredTaskIds])

  const toggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedTaskIds((prev) => {
      const allVisible = filteredTaskIds.length > 0 && filteredTaskIds.every((id) => prev.has(id))
      if (allVisible) return new Set()
      return new Set(filteredTaskIds)
    })
  }, [filteredTaskIds])

  const handleBulkMarkDone = useCallback(async () => {
    if (selectedTaskIds.size === 0) return
    const ids = [...selectedTaskIds]
    const updates = await Promise.all(ids.map((id) => tasksRepo.updateStatus(id, 'done')))
    const updatedById = new Map(updates.filter((item): item is TaskItem => Boolean(item)).map((item) => [item.id, item]))
    if (updatedById.size === 0) return
    emitTasksChanged('tasks-board:bulk-done')
    setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task))
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds])

  const handleBulkDelete = useCallback(async () => {
    if (selectedTaskIds.size === 0) return
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map((id) => tasksRepo.remove(id)))
    emitTasksChanged('tasks-board:bulk-delete')
    setTasks((prev) => prev.filter((task) => !selectedTaskIds.has(task.id)))
    setSelectedTaskIds(new Set())
  }, [selectedTaskIds])

  const handleBulkAssignProject = useCallback(async (rawValue: string) => {
    if (selectedTaskIds.size === 0) return
    const nextProjectId = rawValue === '__none__' ? undefined : rawValue
    const selected = tasks.filter((task) => selectedTaskIds.has(task.id))
    if (selected.length === 0) return
    const updates = await Promise.all(
      selected.map((task) => {
        if ((task.projectId ?? undefined) === nextProjectId) return Promise.resolve(task)
        return tasksRepo.update({ ...task, projectId: nextProjectId })
      }),
    )
    const updatedById = new Map(updates.map((item) => [item.id, item]))
    emitTasksChanged('tasks-board:bulk-assign-project')
    setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task))
    setBulkProjectDraft('')
  }, [selectedTaskIds, tasks])

  const handleBulkAddTag = useCallback(async () => {
    const nextTag = bulkTagDraft.trim()
    if (!nextTag || selectedTaskIds.size === 0) return
    const selected = tasks.filter((task) => selectedTaskIds.has(task.id))
    if (selected.length === 0) return
    const updates = await Promise.all(
      selected.map((task) => {
        const exists = task.tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())
        if (exists) return Promise.resolve(task)
        return tasksRepo.update({ ...task, tags: [...task.tags, nextTag] })
      }),
    )
    const updatedById = new Map(updates.map((item) => [item.id, item]))
    emitTasksChanged('tasks-board:bulk-add-tag')
    setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task))
    setBulkTagDraft('')
  }, [bulkTagDraft, selectedTaskIds, tasks])

  const showTasksEmptyState = filteredTasks.length === 0 && topView !== 'analytics'
  const groupSections = useMemo(() => {
    if (effectiveGroupBy === 'project' || topView === 'today' || scope.kind === 'project') {
      const sections = activeProjects
        .map((project) => ({
          id: project.id,
          title: project.title,
          color: resolveProjectColor(project),
          tasks: filteredTasks.filter((task) => task.projectId === project.id),
        }))
        .filter((section) => section.tasks.length > 0)
      const inboxTasks = filteredTasks.filter((task) => !task.projectId)
      if (inboxTasks.length > 0 && scope.kind !== 'project') {
        sections.push({ id: '__inbox__', title: 'Inbox', color: '#9A8F83', tasks: inboxTasks })
      }
      return sections
    }
    if (effectiveGroupBy === 'today') {
      return [
        { id: 'today', title: 'Today', color: '#B07830', tasks: filteredTasks.filter((task) => task.isToday) },
        { id: 'next', title: 'Next', color: '#3D7A4E', tasks: filteredTasks.filter((task) => !task.isToday && task.status !== 'done') },
        { id: 'done', title: 'Done', color: '#0D7A54', tasks: filteredTasks.filter((task) => task.status === 'done') },
      ].filter((section) => section.tasks.length > 0)
    }
    return [{ id: activeStatus, title: t(TASK_STATUS_CONFIG[activeStatus].labelKey), color: 'var(--text-primary)', tasks: filteredTasks }]
  }, [activeProjects, activeStatus, effectiveGroupBy, filteredTasks, scope.kind, t, topView])

  const renderTaskCard = (task: TaskItem) => {
    const taskProject = task.projectId ? projectById.get(task.projectId) : undefined
    const cardProject = taskProject && taskProject.status !== 'archived'
      ? { id: taskProject.id, title: taskProject.title, color: resolveProjectColor(taskProject) }
      : null
    const dependencyTasks = (task.blockedByTaskIds ?? task.dependencyTaskIds ?? [])
      .map((id) => taskById.get(id))
      .filter((item): item is TaskItem => Boolean(item))
    return (
      <TaskCard
        key={task.id}
        task={task}
        project={cardProject}
        dependencyTasks={dependencyTasks}
        onProjectClick={scope.kind === 'all' ? toggleProjectFilter : undefined}
        onSelect={setActiveTask}
        onClick={(nextTask) => {
          if (bulkMode) toggleTaskSelection(nextTask.id)
          else setActiveTask(nextTask)
        }}
        onDelete={(nextTask) => setDeleteTarget(nextTask)}
        onTogglePin={(nextTask) => {
          void handlePin(nextTask.id)
        }}
        onToggleToday={(nextTask) => {
          void handleToggleToday(nextTask.id)
        }}
        statusActions={
          task.status === 'todo'
            ? [
                { key: 'doing', label: t('tasks.status.start'), onClick: async (nextTask) => handleStatusChange(nextTask.id, 'doing') },
                { key: 'done', label: t('tasks.status.complete'), onClick: async (nextTask) => handleStatusChange(nextTask.id, 'done') },
              ]
            : task.status === 'doing'
              ? [
                  { key: 'todo', label: t('tasks.status.todo'), onClick: async (nextTask) => handleStatusChange(nextTask.id, 'todo') },
                  { key: 'done', label: t('tasks.status.complete'), onClick: async (nextTask) => handleStatusChange(nextTask.id, 'done') },
                ]
              : [{ key: 'todo', label: t('tasks.status.reopen'), onClick: async (nextTask) => handleStatusChange(nextTask.id, 'todo') }]
        }
        loadingActionKey={statusActionLoadingTaskId === task.id ? statusActionLoadingKey : null}
        successActionKey={statusActionSuccessTaskId === task.id ? statusActionSuccessKey : null}
        compact={asCard}
        selected={selectedTaskIds.has(task.id)}
        selectionMode={bulkMode}
      />
    )
  }

  const isFirstTimeEmpty = tasks.length === 0
  const tasksEmptyState = isFirstTimeEmpty ? (
    <div className="tasks-fg__empty px-1 py-8">
      <DiscoveryEmptyState
        variant="first-time"
        title={t('emptyState.tasks.title')}
        body={t('emptyState.tasks.body')}
        relatedFeature={{ label: t('emptyState.tasks.related') }}
      />
    </div>
  ) : (
    <div className="tasks-fg__empty px-1 py-8">
      <DiscoveryEmptyState
        variant="filtered"
        title={topView === 'today' ? t('tasks.today.emptyTitle') : t('emptyState.tasks.filtered.title')}
      />
    </div>
  )

  const cycleTaskStatus = (task: TaskItem) => {
    const next: TaskStatus = task.status === 'todo' ? 'doing' : task.status === 'doing' ? 'done' : 'todo'
    void handleStatusChange(task.id, next)
  }

  const boardContent = topView === 'analytics'
    ? (
      <TasksAnalyticsView tasks={tasks} projects={projects} />
    )
    : topView === 'list'
      ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {showTasksEmptyState ? (
            tasksEmptyState
          ) : (
            <TaskListView
              tasks={filteredTasks}
              projectById={projectById}
              onTaskClick={(task) => {
                if (bulkMode) toggleTaskSelection(task.id)
                else setActiveTask(task)
              }}
              onCycleStatus={cycleTaskStatus}
              onDelete={(task) => setDeleteTarget(task)}
              onTogglePin={(task) => { void handlePin(task.id) }}
            />
          )}
        </div>
      )
      : (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {showTasksEmptyState ? (
            tasksEmptyState
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="tasks-fg__group-stack">
                {groupSections.map((section) => (
                  <section key={section.id} className="tasks-fg__group">
                    {(effectiveGroupBy !== 'status' || topView === 'today' || scope.kind === 'project') ? (
                      <header className="tasks-fg__group-header">
                        <span className="tasks-fg__project-dot" style={{ background: section.color }} aria-hidden />
                        <h3>{section.title}</h3>
                        <span>{section.tasks.length}</span>
                      </header>
                    ) : null}
                    <div
                      className={cn(
                        'tasks-fg__card-grid grid grid-cols-1 items-start gap-3 p-1 pb-4 sm:grid-cols-2',
                        asCard ? 'lg:grid-cols-2 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4',
                      )}
                    >
                      {section.tasks.map(renderTaskCard)}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      )

  const plain = (
    <div className={cn('tasks-fg flex h-full min-h-0 flex-col', asCard ? 'bg-background' : 'bg-transparent', !asCard && 'tasks-fg--plain')}>
      {topView === 'board' || topView === 'today' || topView === 'list' ? (
        <div className="mb-0 border-b pb-3">
          <div className="flex flex-col gap-3">
            {!asCard && scope.kind === 'all' ? (
              <div className="tasks-fg__project-filter" aria-label="Project filters">
                <button
                  type="button"
                  className={cn('tasks-fg__project-chip', projectFilterIds.size === 0 && 'tasks-fg__project-chip--active')}
                  aria-pressed={projectFilterIds.size === 0}
                  onClick={() => setProjectFilterIds(new Set())}
                >
                  <span className="tasks-fg__project-chip__label">All</span>
                  <span className="tasks-fg__project-chip__count">{projectFilterBaseTasks.length}</span>
                </button>
                {activeProjects.map((project) => {
                  const selected = projectFilterIds.has(project.id)
                  const count = projectFilterCounts.get(project.id) ?? 0
                  if (count === 0) return null
                  const projectColor = resolveProjectColor(project)
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={cn('tasks-fg__project-chip', selected && 'tasks-fg__project-chip--active')}
                      style={{ ['--project-color' as string]: projectColor }}
                      aria-pressed={selected}
                      onClick={() => toggleProjectFilter(project.id)}
                    >
                      <span className="tasks-fg__project-dot" aria-hidden />
                      <span className="tasks-fg__project-chip__label">{project.title}</span>
                      <span className="tasks-fg__project-chip__count">{count}</span>
                    </button>
                  )
                })}
              </div>
            ) : null}

          <div className="tasks-fg__toolbar flex flex-wrap items-center justify-between gap-4">
            <div className="tasks-fg__toolbar-group flex flex-wrap items-center gap-4">
              {topView === 'board' && effectiveGroupBy === 'status' ? (
                <div className="tasks-fg__status-tabs flex flex-wrap items-center gap-0.5">
                  {tabs.map((status) => {
                    const cfg = TASK_STATUS_CONFIG[status.key]
                    const count = statusCounts[status.key]
                    const isActive = activeStatus === status.key
                    const alert = statusDeadlineAlerts[status.key]
                    return (
                      <button
                        key={status.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        data-status={status.key}
                        className={cn(
                          'tasks-fg__status-tab',
                          alert && `deadline-alert deadline-alert--${alert.level}`,
                        )}
                        title={alert ? t('tasks.deadlineAlert', { days: alert.daysRemaining }) : undefined}
                        onClick={() => setActiveStatus(status.key)}
                      >
                        <span aria-hidden="true" />
                        {t(cfg.labelKey)}
                        <span>{count}</span>
                        {alert ? (
                          <span className="deadline-alert__badge" aria-label={t('tasks.deadlineAlert', { days: alert.daysRemaining })}>
                            {alert.label}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : topView === 'list' ? null : (
                <div className="rounded-full border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
                  {t('tasks.today.badge')}
                </div>
              )}

              {!asCard ? (
                <>
                  <div className="h-5 w-px bg-border" />

                  {topView === 'board' && scope.kind === 'all' ? (
                    <div className="tasks-fg__group-toggle" role="group" aria-label="Group tasks">
                      {([
                        { key: 'status', label: 'Status', Icon: LayoutGrid },
                        { key: 'project', label: 'Project', Icon: FolderKanban },
                        { key: 'today', label: 'Today', Icon: SunMedium },
                      ] satisfies Array<{ key: BoardGroupBy; label: string; Icon: typeof LayoutGrid }>).map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          className={cn('tasks-fg__mode-tab', groupBy === key && 'tasks-fg__mode-tab--active')}
                          aria-pressed={groupBy === key}
                          onClick={() => setGroupBy(key)}
                        >
                          <Icon className="size-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'tasks-fg__filter-btn',
                          tagFilter.length > 0 && 'is-active',
                        )}
                      >
                        <Tag className="size-3.5" strokeWidth={1.8} />
                        {t('tasks.selectTag')}
                        {tagFilter.length > 0 ? (
                          <span>{tagFilter.length}</span>
                        ) : null}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start">
                      <div className="space-y-1">
                        {tagFilterOptions.slice(1).map((tag) => {
                          const checked = tagFilter.includes(tag.value)
                          return (
                            <button
                              key={tag.value}
                              type="button"
                              className={cn('flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition hover:bg-accent', checked && 'bg-accent')}
                              onClick={() => {
                                setTagFilter((prev) => checked ? prev.filter((item) => item !== tag.value) : [...prev, tag.value])
                              }}
                            >
                              <span>{tag.label}</span>
                              {checked ? <span className="text-primary">✓</span> : null}
                            </button>
                          )
                        })}
                        {tagFilter.length > 0 ? (
                          <button type="button" className="w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => setTagFilter([])}>
                            {t('tasks.clearFilters')}
                          </button>
                        ) : null}
                      </div>
                    </PopoverContent>
                  </Popover>

                  <ShadcnSelect value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                    <SelectTrigger className="tasks-fg__sort-trigger">
                      <SelectValue placeholder={t('tasks.sortBy')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="importance">{t('tasks.sort.priority')}</SelectItem>
                      <SelectItem value="time">{t('tasks.sort.created')}</SelectItem>
                    </SelectContent>
                  </ShadcnSelect>
                </>
              ) : null}

                  <span className="tasks-fg__count-meta">{t('tasks.taskCount', { count: filteredTasks.length })}</span>
            </div>

            <div className="flex items-center gap-2">
              {!asCard ? (
                bulkMode ? (
                  <div className="tasks-fg__bulk-bar flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] px-2 py-1">
                    <button type="button" aria-label={t('tasks.selectAll')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-primary)]" onClick={toggleSelectAllVisible}>
                      {filteredTaskIds.length > 0 && filteredTaskIds.every((id) => selectedTaskIds.has(id)) ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                      全选
                    </button>
                    <span className="px-1 text-xs text-muted-foreground">{t('tasks.selected', { count: selectedCount })}</span>
                    <div className="h-4 w-px bg-border" />
                    <div className="inline-flex items-center gap-1">
                      <ShadcnSelect value={bulkTagDraft} onValueChange={setBulkTagDraft}>
                        <SelectTrigger aria-label={t('tasks.bulkTag')} className="h-7 min-w-[108px] rounded border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] bg-[var(--bg-elevated)] px-2 text-xs">
                          <SelectValue placeholder={t('tasks.selectTag')} />
                        </SelectTrigger>
                        <SelectContent>
                          {bulkTagOptions.map((tag) => (
                            <SelectItem key={tag} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>
                      <button type="button" aria-label={t('tasks.applyTag')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-primary)]" onClick={() => void handleBulkAddTag()} disabled={selectedCount === 0 || !bulkTagDraft.trim()}>
                        <Plus className="size-3.5" />
                        <Tag className="size-3.5" />
                      </button>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <ShadcnSelect
                        value={bulkProjectDraft}
                        onValueChange={(value) => {
                          setBulkProjectDraft(value)
                          void handleBulkAssignProject(value)
                        }}
                        disabled={selectedCount === 0}
                      >
                        <SelectTrigger aria-label={t('tasks.bulk.assignProject')} className="h-7 min-w-[128px] rounded border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] bg-[var(--bg-elevated)] px-2 text-xs">
                          <SelectValue placeholder={t('tasks.bulk.assignProject')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">{t('tasks.drawer.projectUnassigned')}</SelectItem>
                          {activeProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>
                    </div>
                    <button type="button" aria-label={t('tasks.markDone')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--text-primary)]" onClick={() => void handleBulkMarkDone()} disabled={selectedCount === 0}>
                      <CheckSquare className="size-3.5" />
                      {t('tasks.markDone').split(' ').pop()}
                    </button>
                    <button type="button" aria-label={t('tasks.delete')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-rose-600" onClick={() => void handleBulkDelete()} disabled={selectedCount === 0}>
                      <Trash2 className="size-3.5" />
                      {t('tasks.delete')}
                    </button>
                    <button
                      type="button"
                      className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground"
                      onClick={() => {
                        setBulkMode(false)
                        setSelectedTaskIds(new Set())
                        setBulkTagDraft('')
                      }}
                    >
                      {t('tasks.cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="tasks-fg__bulk-toggle"
                    onClick={() => setBulkMode(true)}
                  >
                    <CheckSquare className="size-3.5" strokeWidth={1.8} />
                    {t('tasks.bulkEdit')}
                  </button>
                )
              ) : null}
            </div>
          </div>
          </div>
        </div>
      ) : null}

      {!showTasksEmptyState && topView !== 'analytics' && (
        <div className="px-1 pt-3">
          <DiscoveryHint region="tasks" />
        </div>
      )}

      <div className="tasks-fg__content relative min-h-0 flex-1 overflow-visible pt-4">
        {boardContent}
      </div>

      {topView !== 'analytics' ? (
        <div className="tasks-fg__composer-section flex flex-col">
          {showTasksEmptyState ? (
            <div className="px-4 pt-2 pb-1 text-[12px] text-muted-foreground/80">
              {t('modules.tasks.addPlaceholder')} ↓
            </div>
          ) : null}
          <TaskAddComposer
            ref={composerRef}
            onSubmit={(title, attachments, projectId) => {
              if (isGated) {
                requireAuth(() => undefined)
                return Promise.resolve(false)
              }
              return handleAddTask(title, attachments, projectId)
            }}
            hero
            placeholder={topView === 'today' ? t('tasks.today.addPlaceholder') : undefined}
            projects={activeProjects}
            selectedProjectId={effectiveComposerProjectId}
            onProjectChange={setComposerProjectId}
            projectLocked={Boolean(lockedComposerProjectId)}
          />
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      {asCard ? (
        <Card
          title={t('dashboard.widget.tasks')}
          eyebrow={t('tasks.kanban')}
          className={cn('dashboard-widget-card dashboard-widget-card--shadow-safe dashboard-widget-card--tasks', className)}
        >
          {plain}
        </Card>
      ) : (
        <section className={cn('tasks-board-surface h-full min-h-0', className)}>{plain}</section>
      )}

      <TaskDrawer
        open={Boolean(activeTask)}
        task={activeTask}
        projects={projects}
        onClose={() => setActiveTask(null)}
        onUpdated={handleUpdateTask}
        onDeleted={(id) => setTasks((prev) => prev.filter((task) => task.id !== id))}
        onRequestDelete={setDeleteTarget}
      />

      <Dialog open={Boolean(deleteTarget)} title={t('tasks.deleteTitle')} onClose={() => setDeleteTarget(null)}>
        <div className="dialog__body">
          <p>{t('tasks.deleteConfirm', { title: deleteTarget?.title ?? '' })}</p>
          <div className="dialog__actions">
            <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>
              {t('tasks.cancel')}
            </Button>
            <Button variant="destructive" type="button" onClick={() => {
              if (!deleteTarget) return
              void handleDelete(deleteTarget.id)
            }}>
              {t('tasks.delete')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

export default TasksBoard
