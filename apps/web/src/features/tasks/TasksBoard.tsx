import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, CheckSquare, ChevronDown, LayoutGrid, Plus, Square, Tag, Trash2 } from 'lucide-react'
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
import { TASK_STATUS_CONFIG, formatTaskDate, getUpcomingDeadlineAlert, type TaskDeadlineAlert } from './components/taskPresentation'
import { useI18n } from '../../shared/i18n/useI18n'
import { useAuthGate } from '../auth/AuthGateContext'
import { DiscoveryEmptyState } from '../../shared/ui/EmptyState'
import { DiscoveryHint } from '../../shared/ui/DiscoveryHint'
import { resolveProjectColor } from '../../shared/design/tokens'
import { createTask, parseQuickAddTaskInput } from './application/taskActions'
import { useTaskDeletion } from './application/useTaskDeletion'
import ActiveIndicator from '../../shared/motion/ActiveIndicator'
import {  SELECTED_TAB } from '../../shared/motion/indicatorSelectors'
import { AppNumber } from '../../shared/ui/AppNumber'
import { isTaskClosed, isTaskInToday, isTaskOpen, isTaskOverdue } from './domain/taskRules'
import { buildNextOccurrence } from './domain/taskRecurrence'
import { toDateKey } from '../../shared/utils/time'
import { rememberCurrentUserRecentCommandTarget } from '../../shared/ui/recentCommandTargets'
import { useOpenRequest } from '../../shared/navigation/openRequest'

const tabs: { key: TaskStatus }[] = [
  { key: 'todo' },
  { key: 'doing' },
  { key: 'waiting' },
  { key: 'verify' },
  { key: 'done' },
  { key: 'dropped' },
]
const TASK_STATUSES = tabs.map((tab) => tab.key)
// Everyday statuses always have a tab; the others appear once something is in them.
const ALWAYS_SHOWN_STATUSES = new Set<TaskStatus>(['todo', 'doing', 'done'])
const emptyStatusRecord = <T,>(value: T) =>
  Object.fromEntries(TASK_STATUSES.map((status) => [status, value])) as Record<TaskStatus, T>

type SortMode = 'importance' | 'time'
type TopView = 'board' | 'today' | 'list' | 'analytics'
type BoardGroupBy = 'status' | 'project' | 'today'
type BoardScope = { kind: 'all' } | { kind: 'project'; projectId: string } | { kind: 'today' }

const STORAGE_TAB_KEY = 'tasks_active_tab'
const STORAGE_SORT_KEY = 'tasks_sort_mode'
const STORAGE_TAGS_MIGRATION_KEY = 'tasks_tags_select_v2_migrated'
const STORAGE_GROUP_BY_KEY = 'tasks_group_by_v1'
const STORAGE_PROJECT_FILTER_KEY = 'tasks_project_filter_v1'
const STORAGE_OVERDUE_COLLAPSED_KEY = 'tasks_today_overdue_collapsed_v1'

const OVERDUE_SECTION_ID = '__overdue__'
// A few late tasks stay open at the top of 今日; a pile folds into its header so today's plan
// isn't pushed below the fold. Opening or closing it by hand sticks.
const OVERDUE_AUTO_COLLAPSE_AT = 4

type OverdueReschedule = 'today' | 'tomorrow' | 'none'

const priorityOrder: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

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
  const [, setSearchParams] = useSearchParams()
  const useTaskLink = !asCard && scope.kind === 'all'
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [bulkProjectDraft, setBulkProjectDraft] = useState('')
  const [composerProjectId, setComposerProjectId] = useState<string | undefined>(undefined)
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const activeTaskId = activeTask?.id ?? null

  useEffect(() => {
    if (activeTaskId) rememberCurrentUserRecentCommandTarget({ kind: 'task', id: activeTaskId })
  }, [activeTaskId])
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const deleteTasks = useTaskDeletion()
  const [overdueCollapsedPref, setOverdueCollapsedPref] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null
    const stored = window.localStorage.getItem(STORAGE_OVERDUE_COLLAPSED_KEY)
    return stored === '1' ? true : stored === '0' ? false : null
  })
  const [overdueMenuOpen, setOverdueMenuOpen] = useState(false)
  const [tasksLoaded, setTasksLoaded] = useState(false)
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
    return TASK_STATUSES.includes(stored as TaskStatus) ? (stored as TaskStatus) : 'todo'
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
    setTasksLoaded(true)
    setActiveTask((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
    setDeleteTarget((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
  }, [])

  useSyncDataRefresh(loadTasks, ['tasks', 'projects'])

  useEffect(() => {
    if (!tasksLoaded || !useTaskLink) return
    const syncFromUrl = () => {
      const id = new URLSearchParams(window.location.search).get('task')
      if (!id) {
        setActiveTask(null)
        return
      }
      const task = tasks.find((item) => item.id === id)
      if (task) setActiveTask(task)
      else {
        setActiveTask(null)
        setSearchParams((current) => {
          const next = new URLSearchParams(current)
          next.delete('task')
          return next
        }, { replace: true })
      }
    }
    syncFromUrl()
    window.addEventListener('popstate', syncFromUrl)
    return () => window.removeEventListener('popstate', syncFromUrl)
  }, [tasks, tasksLoaded, useTaskLink, setSearchParams])

  // Search can open a task while this page is already mounted, before the URL navigation settles.
  useOpenRequest('task', tasksLoaded && useTaskLink, (id) => {
    const task = tasks.find((item) => item.id === id)
    if (task) setActiveTask(task)
  })

  const openTask = (task: TaskItem) => {
    setActiveTask(task)
    if (!useTaskLink) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('task', task.id)
      next.delete('from')
      return next
    })
  }

  const closeTask = () => {
    setActiveTask(null)
    if (!useTaskLink) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('task')
      next.delete('from')
      return next
    }, { replace: true })
  }

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
    if (typeof window === 'undefined' || overdueCollapsedPref === null) return
    window.localStorage.setItem(STORAGE_OVERDUE_COLLAPSED_KEY, overdueCollapsedPref ? '1' : '0')
  }, [overdueCollapsedPref])

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
    const counts = emptyStatusRecord(0)
    const countBase = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId)
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => isTaskInToday(task))
        : tasks
    countBase.filter((task) =>
      (scope.kind !== 'all' || projectFilterIds.size === 0 || Boolean(task.projectId && projectFilterIds.has(task.projectId)))
      && (tagFilter.length === 0 || tagFilter.some((tag) => task.tags.some((item) => item.trim().toLowerCase() === tag)))
    ).forEach((task) => {
      if (task.status in counts) counts[task.status]++
    })
    return counts
  }, [scope, tasks, topView, projectFilterIds, tagFilter])

  const deadlineAlertTitle = (alert: TaskDeadlineAlert) =>
    alert.kind === 'overdue'
      ? t('tasks.deadlineAlert.overdue', { n: alert.overdueCount })
      : alert.kind === 'today'
        ? t('tasks.deadlineAlert.today')
        : t('tasks.deadlineAlert', { days: alert.daysRemaining })
  const deadlineAlertBadge = (alert: TaskDeadlineAlert) =>
    alert.kind === 'overdue'
      ? t('tasks.deadlineAlert.overdueBadge')
      : alert.kind === 'today'
        ? t('tasks.deadlineAlert.todayBadge')
        : t('tasks.deadlineAlert.daysBadge', { days: alert.daysRemaining })

  const statusDeadlineAlerts = useMemo(() => {
    const alerts = emptyStatusRecord<ReturnType<typeof getUpcomingDeadlineAlert>>(null)
    const alertBase = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId)
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => isTaskInToday(task))
        : tasks
    tabs.forEach((status) => {
      alerts[status.key] = getUpcomingDeadlineAlert(alertBase.filter((task) => task.status === status.key
        && (scope.kind !== 'all' || projectFilterIds.size === 0 || Boolean(task.projectId && projectFilterIds.has(task.projectId)))
        && (tagFilter.length === 0 || tagFilter.some((tag) => task.tags.some((item) => item.trim().toLowerCase() === tag)))))
    })
    return alerts
  }, [scope, tasks, topView, projectFilterIds, tagFilter])

  const filteredTasks = useMemo(() => {
    let result = scope.kind === 'project'
      ? tasks.filter((task) => task.projectId === scope.projectId && (effectiveGroupBy !== 'status' || topView === 'list' || task.status === activeStatus))
      : scope.kind === 'today' || topView === 'today'
        ? tasks.filter((task) => isTaskInToday(task))
        : topView === 'list'
          ? tasks
          : effectiveGroupBy === 'status'
            ? tasks.filter((task) => task.status === activeStatus)
            : tasks
    // Dropped tasks are archived: only their own status tab shows them.
    const usesStatusTabs = topView !== 'list' && topView !== 'today' && scope.kind !== 'today' && effectiveGroupBy === 'status'
    if (!usesStatusTabs) result = result.filter((task) => task.status !== 'dropped')
    if (scope.kind === 'all' && projectFilterIds.size > 0) {
      result = result.filter((task) => task.projectId && projectFilterIds.has(task.projectId))
    }
    if (tagFilter.length > 0) {
      result = result.filter((task) => tagFilter.some((tag) => task.tags.some((item) => item.trim().toLowerCase() === tag)))
    }
    const ordered = result.slice()
    ordered.sort((a, b) => {
      if (topView === 'today' && isTaskClosed(a) !== isTaskClosed(b)) return isTaskClosed(a) ? 1 : -1
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
    if (topView === 'today') return tasks.filter((task) => isTaskInToday(task))
    if (topView === 'list') return tasks.filter((task) => task.status !== 'dropped')
    if (effectiveGroupBy === 'status') return tasks.filter((task) => task.status === activeStatus)
    if (effectiveGroupBy === 'today') return tasks.filter(isTaskOpen)
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

  // Every tag in use, once (case-insensitive), in the spelling first seen. Feeds both the
  // filter and the bulk tag picker, so a #tag typed in quick-add can be filtered on.
  const tagOptions = useMemo(() => {
    const seen = new Map<string, string>()
    tasks.forEach((task) => {
      task.tags.forEach((tag) => {
        const key = tag.trim().toLowerCase()
        // Old data can hold the literal strings "undefined"/"null"; rows hide those too.
        if (!key || key === 'undefined' || key === 'null' || seen.has(key)) return
        seen.set(key, tag.trim())
      })
    })
    return [...seen.entries()]
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [tasks])

  // A tag that no task carries any more can't match anything; drop it from the filter.
  useEffect(() => {
    setTagFilter((prev) => {
      if (prev.length === 0) return prev
      const inUse = new Set(tagOptions.map((option) => option.key))
      const next = prev.filter((key) => inUse.has(key))
      return next.length === prev.length ? prev : next
    })
  }, [tagOptions])

  const handleStatusChange = useCallback(async (taskId: string, nextStatus: TaskStatus) => {
    if (statusActionLoadingTaskId) return
    setStatusActionLoadingTaskId(taskId)
    setStatusActionLoadingKey(nextStatus)
    const previousTask = tasks.find((item) => item.id === taskId)
    const previousStatus = previousTask?.status
    try {
      const updated = await tasksRepo.updateStatus(taskId, nextStatus)
      if (!updated) return
      emitTasksChanged('tasks-board:update-status')
      // A completed task leaves the list at once; one click away from undoing a mis-click.
      if (nextStatus === 'done' && previousStatus && previousStatus !== 'done') {
        const nextDue = previousTask?.recurrence && updated.recurrenceNextId ? buildNextOccurrence(previousTask)?.dueDate : undefined
        toast.push({
          message: nextDue
            ? t('tasks.completedRecurringToast', { title: updated.title, date: formatTaskDate(nextDue) ?? nextDue })
            : t('tasks.completedToast', { title: updated.title }),
          variant: 'success',
          actionLabel: t('tasks.undo'),
          onAction: () => {
            void tasksRepo.updateStatus(taskId, previousStatus).then((reverted) => {
              if (!reverted) return
              emitTasksChanged('tasks-board:undo-complete')
              setTasks((prev) => prev.map((item) => (item.id === taskId ? reverted : item)))
            })
          },
        })
      }
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
  }, [statusActionLoadingTaskId, t, tasks, toast])

  const handleDelete = useCallback(async (task: TaskItem) => {
    setDeleteTarget(null)
    await deleteTasks([task], 'tasks-board')
    setTasks((prev) => prev.filter((item) => item.id !== task.id))
    setActiveTask((prev) => (prev?.id === task.id ? null : prev))
  }, [deleteTasks])

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

  // Moves the late tasks in view all at once. Today keeps them in 今日 as a fresh commitment;
  // tomorrow or no date takes them out of 今日 (the hand-set flag too). Undo puts back the old dates.
  const handleRescheduleOverdue = useCallback(async (overdueTasks: TaskItem[], target: OverdueReschedule) => {
    setOverdueMenuOpen(false)
    if (overdueTasks.length === 0) return
    const now = new Date()
    const dueDate = target === 'none'
      ? undefined
      : toDateKey(target === 'today' ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
    const updates = await Promise.all(overdueTasks.map((task) => tasksRepo.update({
      ...task,
      dueDate,
      isToday: target === 'today' ? task.isToday : false,
    })))
    const updatedById = new Map(updates.map((item) => [item.id, item]))
    emitTasksChanged('tasks-board:reschedule-overdue')
    setTasks((prev) => prev.map((task) => updatedById.get(task.id) ?? task))
    toast.push({
      message: t('tasks.overdue.rescheduledToast', { count: updates.length }),
      actionLabel: t('tasks.undo'),
      durationMs: 8000,
      onAction: () => {
        void Promise.all(overdueTasks.map((task) => tasksRepo.update(task))).then((reverted) => {
          const revertedById = new Map(reverted.map((item) => [item.id, item]))
          emitTasksChanged('tasks-board:undo-reschedule-overdue')
          setTasks((prev) => prev.map((task) => revertedById.get(task.id) ?? task))
        })
      },
    })
  }, [t, toast])

  const handleAddTask = useCallback(async (rawTitle: string, attachments?: TaskItem['attachments'], selectedProjectId?: string) => {
    const fallbackProjectId = scope.kind === 'project'
      ? scope.projectId
      : selectedProjectId ?? (projectFilterIds.size === 1 ? [...projectFilterIds][0] : undefined)
    const parsed = await parseQuickAddTaskInput(rawTitle, { projects, fallbackProjectId })
    const created = await createTask({
      title: parsed.title,
      status: parsed.waitingOn
        ? 'waiting'
        : topView === 'today' || effectiveGroupBy !== 'status' || activeStatus === 'dropped' ? 'todo' : activeStatus,
      waitingOn: parsed.waitingOn,
      isToday: topView === 'today' || parsed.isToday === true,
      priority: parsed.priority,
      projectId: parsed.projectId,
      dueDate: parsed.dueDate,
      reminderAt: parsed.reminderAt,
      recurrence: parsed.recurrence,
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
    setBulkDeleteOpen(false)
    const selected = tasks.filter((task) => selectedTaskIds.has(task.id))
    if (selected.length === 0) return
    await deleteTasks(selected, 'tasks-board:bulk')
    setTasks((prev) => prev.filter((task) => !selectedTaskIds.has(task.id)))
    setSelectedTaskIds(new Set())
  }, [deleteTasks, selectedTaskIds, tasks])

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
      // 今日 leads with what's already late; the rest groups by project as before.
      const overdueTasks = topView === 'today' ? filteredTasks.filter((task) => isTaskOverdue(task)) : []
      const overdueIds = new Set(overdueTasks.map((task) => task.id))
      const remaining = filteredTasks.filter((task) => !overdueIds.has(task.id))
      const sections = activeProjects
        .map((project) => ({
          id: project.id,
          title: project.title,
          color: resolveProjectColor(project),
          tasks: remaining.filter((task) => task.projectId === project.id),
        }))
        .filter((section) => section.tasks.length > 0)
      const inboxTasks = remaining.filter((task) => !task.projectId)
      if (inboxTasks.length > 0 && scope.kind !== 'project') {
        sections.push({ id: '__inbox__', title: t('tasks.board.sectionInbox'), color: 'var(--ink-4)', tasks: inboxTasks })
      }
      if (overdueTasks.length > 0) {
        sections.unshift({ id: OVERDUE_SECTION_ID, title: t('tasks.board.sectionOverdue'), color: 'var(--tone-urgent)', tasks: overdueTasks })
      }
      return sections
    }
    if (effectiveGroupBy === 'today') {
      return [
        { id: 'today', title: t('tasks.board.sectionToday'), color: 'var(--accent)', tasks: filteredTasks.filter((task) => isTaskInToday(task)) },
        { id: 'next', title: t('tasks.board.sectionNext'), color: 'var(--ink-3)', tasks: filteredTasks.filter((task) => !isTaskInToday(task) && isTaskOpen(task)) },
        { id: 'done', title: t('tasks.board.sectionDone'), color: 'var(--tone-done)', tasks: filteredTasks.filter((task) => task.status === 'done' && !isTaskInToday(task)) },
      ].filter((section) => section.tasks.length > 0)
    }
    return [{ id: activeStatus, title: t(TASK_STATUS_CONFIG[activeStatus].labelKey), color: 'var(--text-primary)', tasks: filteredTasks }]
  }, [activeProjects, activeStatus, effectiveGroupBy, filteredTasks, scope.kind, t, topView])

  // The quick moves a card offers on hover; the drawer has every status.
  const statusActionsFor = (task: TaskItem) => {
    const to = (key: string, label: string, status: TaskStatus) => ({
      key,
      label,
      onClick: async (nextTask: TaskItem) => handleStatusChange(nextTask.id, status),
    })
    switch (task.status) {
      case 'todo':
        return [to('doing', t('tasks.status.start'), 'doing'), to('done', t('tasks.status.complete'), 'done')]
      case 'doing':
        return [to('todo', t('tasks.status.todo'), 'todo'), to('done', t('tasks.status.complete'), 'done')]
      case 'waiting':
        return [to('resume', t('tasks.status.resume'), 'doing'), to('done', t('tasks.status.complete'), 'done')]
      case 'verify':
        return [to('verified', t('tasks.status.verified'), 'done'), to('todo', t('tasks.status.markTodo'), 'todo')]
      case 'dropped':
        return [to('restore', t('tasks.status.restore'), 'todo')]
      default:
        return [to('todo', t('tasks.status.reopen'), 'todo')]
    }
  }

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
        project={!asCard && (scope.kind === 'project' || projectFilterIds.has(task.projectId ?? '')) ? null : cardProject}
        dependencyTasks={dependencyTasks}
        onProjectClick={scope.kind === 'all' ? toggleProjectFilter : undefined}
        onSelect={openTask}
        onClick={(nextTask) => {
          if (bulkMode) toggleTaskSelection(nextTask.id)
          else openTask(nextTask)
        }}
        onDelete={(nextTask) => setDeleteTarget(nextTask)}
        onTogglePin={(nextTask) => {
          void handlePin(nextTask.id)
        }}
        onToggleToday={(nextTask) => {
          void handleToggleToday(nextTask.id)
        }}
        statusActions={statusActionsFor(task)}
        loadingActionKey={statusActionLoadingTaskId === task.id ? statusActionLoadingKey : null}
        successActionKey={statusActionSuccessTaskId === task.id ? statusActionSuccessKey : null}
        compact={asCard}
        showStatus={topView === 'today' || effectiveGroupBy !== 'status'}
        selected={selectedTaskIds.has(task.id)}
        selectionMode={bulkMode}
      />
    )
  }

  const isFirstTimeEmpty = tasks.length === 0
  const tasksEmptyState = isFirstTimeEmpty ? (
    <div className="px-1 py-8">
      <DiscoveryEmptyState
        variant="first-time"
        illustration="coffee"
        title={t('emptyState.tasks.title')}
        body={t('emptyState.tasks.body')}
        relatedFeature={{ label: t('emptyState.tasks.related') }}
      />
    </div>
  ) : topView === 'today' ? (
    <div className="px-1 py-8">
      <DiscoveryEmptyState
        variant="first-time"
        illustration="plant"
        title={t('tasks.today.emptyTitle')}
        body={t('tasks.today.emptyDescription')}
      />
    </div>
  ) : (
    <div className="px-1 py-8">
      <DiscoveryEmptyState variant="filtered" title={t('emptyState.tasks.filtered.title')} />
    </div>
  )

  // The row mark advances todo → doing → done; anything waiting or to verify is finished by it,
  // anything closed reopens.
  const cycleTaskStatus = (task: TaskItem) => {
    const next: TaskStatus = task.status === 'todo'
      ? 'doing'
      : task.status === 'doing' || task.status === 'waiting' || task.status === 'verify'
        ? 'done'
        : 'todo'
    void handleStatusChange(task.id, next)
  }

  const analyticsTasks = tasks.filter((task) =>
    scope.kind === 'project' ? task.projectId === scope.projectId
      : scope.kind === 'today' ? isTaskInToday(task) : true)

  const boardContent = topView === 'analytics'
    ? (
      <TasksAnalyticsView tasks={analyticsTasks} projects={projects} />
    )
    : topView === 'list'
      ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {showTasksEmptyState ? (
            tasksEmptyState
          ) : (
            <TaskListView
              tasks={filteredTasks}
              selectionMode={bulkMode}
              selectedTaskIds={selectedTaskIds}
              projectById={projectById}
              onTaskClick={(task) => {
                if (bulkMode) toggleTaskSelection(task.id)
                else openTask(task)
              }}
              onCycleStatus={cycleTaskStatus}
              onDelete={(task) => setDeleteTarget(task)}
              onTogglePin={(task) => { void handlePin(task.id) }}
              onMoveTask={bulkMode ? undefined : (task, status) => { void handleStatusChange(task.id, status) }}
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
                {groupSections.map((section) => {
                  const isOverdueSection = section.id === OVERDUE_SECTION_ID
                  const overdueCollapsed = isOverdueSection
                    && (overdueCollapsedPref ?? section.tasks.length >= OVERDUE_AUTO_COLLAPSE_AT)
                  return (
                    <section key={section.id} className="tasks-fg__group">
                      {isOverdueSection ? (
                        <header className="tasks-fg__group-header">
                          <h3 className="tasks-fg__group-heading">
                            <button
                              type="button"
                              className="tasks-fg__group-disclosure"
                              aria-expanded={!overdueCollapsed}
                              aria-controls="tasks-overdue-group"
                              onClick={() => setOverdueCollapsedPref(!overdueCollapsed)}
                            >
                              <span className="tasks-fg__project-dot" style={{ background: section.color }} aria-hidden />
                              <span>{section.title}</span>
                              <span className="tasks-fg__group-count">{section.tasks.length}</span>
                              <ChevronDown className={cn('tasks-fg__group-chevron', overdueCollapsed && 'is-collapsed')} aria-hidden />
                            </button>
                          </h3>
                          <Popover open={overdueMenuOpen} onOpenChange={setOverdueMenuOpen}>
                            <PopoverTrigger asChild>
                              <button type="button" className="tasks-fg__group-action">
                                <CalendarClock className="size-3.5" strokeWidth={1.8} aria-hidden />
                                {t('tasks.overdue.reschedule')}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-1.5" align="start">
                              <div className="space-y-0.5">
                                {([
                                  { key: 'today', label: t('tasks.overdue.toToday') },
                                  { key: 'tomorrow', label: t('tasks.overdue.toTomorrow') },
                                  { key: 'none', label: t('tasks.overdue.clearDue') },
                                ] satisfies Array<{ key: OverdueReschedule; label: string }>).map((option) => (
                                  <button
                                    key={option.key}
                                    type="button"
                                    className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs transition hover:bg-accent"
                                    onClick={() => void handleRescheduleOverdue(section.tasks, option.key)}
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </header>
                      ) : (effectiveGroupBy !== 'status' || topView === 'today' || scope.kind === 'project') ? (
                        <header className="tasks-fg__group-header">
                          <span className="tasks-fg__project-dot" style={{ background: section.color }} aria-hidden />
                          <h3>{section.title}</h3>
                          <span>{section.tasks.length}</span>
                        </header>
                      ) : null}
                      {overdueCollapsed ? null : (
                        <div
                          id={isOverdueSection ? 'tasks-overdue-group' : undefined}
                          className={cn(
                            'tasks-fg__card-grid grid grid-cols-1 items-start gap-3 p-1 pb-4 sm:grid-cols-2',
                            asCard ? 'lg:grid-cols-2 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4',
                          )}
                        >
                          {section.tasks.map(renderTaskCard)}
                        </div>
                      )}
                    </section>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )

  const plain = (
    // Transparent in both modes: as a dashboard widget the card around it is the
    // surface (frosted glass under an ambient scene), so an opaque fill here
    // would show as a white block.
    <div className={cn('tasks-fg flex h-full min-h-0 flex-col bg-transparent', !asCard && 'tasks-fg--plain')}>
      {topView === 'board' || topView === 'today' || topView === 'list' ? (
        <div className="tasks-workspace-toolbar">
          <div className="flex flex-col gap-3">
            {!asCard && scope.kind === 'all' ? (
              <div className="tasks-fg__project-filter" aria-label={t('tasks.board.projectFiltersAria')}>
                <button
                  type="button"
                  className={cn('tasks-fg__project-chip', projectFilterIds.size === 0 && 'tasks-fg__project-chip--active')}
                  aria-pressed={projectFilterIds.size === 0}
                  onClick={() => setProjectFilterIds(new Set())}
                >
                  <span className="tasks-fg__project-chip__label">{t('tasks.board.allProjects')}</span>
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

          <div className="tasks-workspace-filter-row">
            <div className="tasks-workspace-filters">
              {topView === 'board' && effectiveGroupBy === 'status' ? (
                <div className="tasks-fg__status-group flex items-center gap-0.5" role="tablist" aria-label={t('tasks.workspace.groupStatus')}>
                  <ActiveIndicator selector={SELECTED_TAB} />
                  {tabs.map((status) => {
                    const cfg = TASK_STATUS_CONFIG[status.key]
                    const count = statusCounts[status.key]
                    const isActive = activeStatus === status.key
                    if (!ALWAYS_SHOWN_STATUSES.has(status.key) && count === 0 && !isActive) return null
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
                        title={alert ? deadlineAlertTitle(alert) : undefined}
                        onClick={() => setActiveStatus(status.key)}
                      >
                        <span aria-hidden="true" />
                        {t(cfg.labelKey)}
                        <span><AppNumber value={count} /></span>
                        {alert ? (
                          <span className="deadline-alert__badge" aria-label={deadlineAlertTitle(alert)}>
                            {deadlineAlertBadge(alert)}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : topView === 'today' ? (
                <div className="rounded-full border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">
                  {t('tasks.today.badge')}
                </div>
              ) : null}

              {!asCard ? (
                <>

                  {topView === 'board' && scope.kind === 'all' ? (
                    <ShadcnSelect value={groupBy} onValueChange={(value) => setGroupBy(value as BoardGroupBy)}>
                      <SelectTrigger aria-label={t('tasks.board.groupAria')} className="tasks-workspace-group-select">
                        <LayoutGrid className="size-3.5" aria-hidden />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="status">{t('tasks.workspace.groupStatus')}</SelectItem>
                        <SelectItem value="project">{t('tasks.workspace.groupProject')}</SelectItem>
                        <SelectItem value="today">{t('tasks.workspace.groupToday')}</SelectItem>
                      </SelectContent>
                    </ShadcnSelect>
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
                    <PopoverContent className="w-52 p-2" align="start">
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {tagOptions.length === 0 ? (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('tasks.tagFilterEmpty')}</p>
                        ) : null}
                        {tagOptions.map((tag) => {
                          const checked = tagFilter.includes(tag.key)
                          return (
                            <button
                              key={tag.key}
                              type="button"
                              className={cn('flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-xs transition hover:bg-accent', checked && 'bg-accent')}
                              aria-pressed={checked}
                              onClick={() => {
                                setTagFilter((prev) => checked ? prev.filter((item) => item !== tag.key) : [...prev, tag.key])
                              }}
                            >
                              <span className="min-w-0 truncate">#{tag.label}</span>
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
                      {t('tasks.selectAll')}
                    </button>
                    <span className="px-1 text-xs text-muted-foreground">{t('tasks.selected', { count: selectedCount })}</span>
                    <div className="h-4 w-px bg-border" />
                    <div className="inline-flex items-center gap-1">
                      <ShadcnSelect value={bulkTagDraft} onValueChange={setBulkTagDraft}>
                        <SelectTrigger aria-label={t('tasks.bulkTag')} className="h-7 min-w-[108px] rounded border-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] bg-[var(--bg-elevated)] px-2 text-xs">
                          <SelectValue placeholder={t('tasks.selectTag')} />
                        </SelectTrigger>
                        <SelectContent>
                          {tagOptions.map(({ label }) => (
                            <SelectItem key={label} value={label}>
                              {label}
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
                    <button type="button" aria-label={t('tasks.delete')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-tone-urgent" onClick={() => setBulkDeleteOpen(true)} disabled={selectedCount === 0}>
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

      <div className="relative min-h-0 flex-1 overflow-visible pt-4">
        {boardContent}
      </div>

      {topView !== 'analytics' ? (
        <div className="flex flex-col">
          {showTasksEmptyState ? (
            <div className="px-4 pt-2 pb-1 text-label text-muted-foreground/80">
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
        onClose={closeTask}
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
              void handleDelete(deleteTarget)
            }}>
              {t('tasks.delete')}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={bulkDeleteOpen} title={t('tasks.bulkDeleteTitle', { count: selectedCount })} onClose={() => setBulkDeleteOpen(false)}>
        <div className="dialog__body">
          <p>{t('tasks.bulkDeleteConfirm', { count: selectedCount })}</p>
          <div className="dialog__actions">
            <Button variant="outline" type="button" onClick={() => setBulkDeleteOpen(false)}>
              {t('tasks.cancel')}
            </Button>
            <Button variant="destructive" type="button" onClick={() => void handleBulkDelete()}>
              {t('tasks.delete')}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

export default TasksBoard
