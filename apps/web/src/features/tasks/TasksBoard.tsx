import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CheckSquare, Columns3, LayoutGrid, Plus, Square, Tag, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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
import type { TaskItem, TaskPriority, TaskStatus } from './tasks.types'
import TaskDrawer from './TaskDrawer'
import Card from '../../shared/ui/Card'
import Dialog from '../../shared/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import TaskCard from './components/TaskCard'
import TaskAddComposer from './components/TaskAddComposer'
import TaskCalendarWidget from './components/TaskCalendarWidget'
import TasksAnalyticsView from './components/TasksAnalyticsView'
import { useToast } from '../../shared/ui/toast/toast'
import { ROUTES } from '../../app/routes/routes'
import { emitTasksChanged, subscribeTasksChanged } from './taskSync'
import { TASK_STATUS_CONFIG } from './components/taskPresentation'
import { useI18n } from '../../shared/i18n/useI18n'
import { completeOnboarding, markFeatureSeen, resetOnboarding, setPendingCoachmark } from '../onboarding/onboarding.runtime'
import EmptyState from '../../shared/ui/EmptyState'

const tabs: { key: TaskStatus }[] = [{ key: 'todo' }, { key: 'doing' }, { key: 'done' }]

type SortMode = 'importance' | 'time'
type TagFilterMode = 'all' | 'work' | 'life' | 'health' | 'study' | 'finance' | 'family'
type BoardMode = 'kanban' | 'calendar'
type TopView = 'board' | 'analytics'

const STORAGE_TAB_KEY = 'tasks_active_tab'
const STORAGE_SORT_KEY = 'tasks_sort_mode'
const STORAGE_TAGS_MIGRATION_KEY = 'tasks_tags_select_v2_migrated'

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

const getNextStatus = (status: TaskStatus) => {
  if (status === 'todo') return { next: 'doing' as const, label: '开始' }
  if (status === 'doing') return { next: 'done' as const, label: '完成' }
  return { next: 'todo' as const, label: '重新打开' }
}

type TasksBoardProps = {
  asCard?: boolean
  className?: string
  topView?: TopView
  onboardingMode?: boolean
  onOnboardingTaskCreated?: (task: TaskItem) => void
}

const TasksBoard = ({
  asCard = true,
  className,
  topView = 'board',
  onboardingMode = false,
  onOnboardingTaskCreated,
}: TasksBoardProps) => {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null)
  const [onboardingDrawerOpen, setOnboardingDrawerOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TaskItem | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === 'undefined') return 'importance'
    const stored = window.localStorage.getItem(STORAGE_SORT_KEY)
    return stored === 'time' || stored === 'importance' ? stored : 'importance'
  })
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [boardMode, setBoardMode] = useState<BoardMode>('kanban')
  const [statusActionLoadingTaskId, setStatusActionLoadingTaskId] = useState<string | null>(null)
  const [statusActionLoadingKey, setStatusActionLoadingKey] = useState<string | null>(null)
  const [statusActionSuccessTaskId, setStatusActionSuccessTaskId] = useState<string | null>(null)
  const [statusActionSuccessKey, setStatusActionSuccessKey] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [bulkTagDraft, setBulkTagDraft] = useState('')
  const [activeStatus, setActiveStatus] = useState<TaskStatus>(() => {
    if (typeof window === 'undefined') return 'todo'
    const stored = window.localStorage.getItem(STORAGE_TAB_KEY)
    return stored === 'todo' || stored === 'doing' || stored === 'done' ? stored : 'todo'
  })
  const statusActionSuccessTimerRef = useRef<number | null>(null)
  const tasksReloadTokenRef = useRef(0)
  const toast = useToast()
  const navigate = useNavigate()

  const loadTasks = useCallback(async () => {
    const token = tasksReloadTokenRef.current + 1
    tasksReloadTokenRef.current = token
    const items = await tasksRepo.list()
    if (tasksReloadTokenRef.current !== token) return
    setTasks(items)
    setActiveTask((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
    setDeleteTarget((prev) => (prev ? items.find((item) => item.id === prev.id) ?? null : prev))
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      if (typeof window !== 'undefined' && !window.localStorage.getItem(STORAGE_TAGS_MIGRATION_KEY)) {
        await tasksRepo.clearAllTags()
        window.localStorage.setItem(STORAGE_TAGS_MIGRATION_KEY, '1')
      }
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
    return () => {
      if (statusActionSuccessTimerRef.current) window.clearTimeout(statusActionSuccessTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!onboardingMode) {
      setOnboardingDrawerOpen(false)
      return
    }
    setOnboardingDrawerOpen(true)
  }, [onboardingMode])

  const statusCounts = useMemo(() => {
    const counts: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0 }
    tasks.forEach((task) => counts[task.status]++)
    return counts
  }, [tasks])

  const filteredTasks = useMemo(() => {
    let result = tasks.filter((task) => task.status === activeStatus)
    if (tagFilter.length > 0) {
      result = result.filter((task) => tagFilter.some((tag) => task.tags.some((item) => item.toLowerCase() === tag)))
    }
    const ordered = result.slice()
    ordered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      if (sortMode === 'time') return sortByTime(a, b)
      return sortByImportance(a, b)
    })
    return ordered
  }, [tasks, activeStatus, tagFilter, sortMode])
  const filteredTaskIds = useMemo(() => filteredTasks.map((task) => task.id), [filteredTasks])
  const selectedCount = selectedTaskIds.size

  const allFilteredTasks = useMemo(() => {
    if (tagFilter.length === 0) return tasks
    return tasks.filter((task) => tagFilter.some((tag) => task.tags.some((item) => item.toLowerCase() === tag)))
  }, [tasks, tagFilter])
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
  }, [tasks, toast])

  const handleUpdateTask = useCallback((updated: TaskItem) => {
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setActiveTask((prev) => (prev?.id === updated.id ? updated : prev))
  }, [])

  const handleAddTask = useCallback(async (title: string) => {
    const created = await tasksRepo.add({
      title,
      status: activeStatus,
      priority: null,
      dueDate: undefined,
      tags: [],
      subtasks: [],
    })
    emitTasksChanged('tasks-board:create')
    setTasks((prev) => [created, ...prev])
    return true
  }, [activeStatus])

  const handleOnboardingCreated = useCallback(
    (task: TaskItem) => {
      setTasks((prev) => [task, ...prev])
      setOnboardingDrawerOpen(false)
      markFeatureSeen('tasks')
      completeOnboarding()
      setPendingCoachmark('focus')
      toast.push({
        variant: 'success',
        title: t('tasks.onboarding.focusReady'),
        message: t('tasks.onboarding.focusHint'),
      })
      onOnboardingTaskCreated?.(task)
    },
    [onOnboardingTaskCreated, t, toast],
  )

  const exitOnboarding = useCallback(() => {
    resetOnboarding()
    setOnboardingDrawerOpen(false)
    navigate(ROUTES.DASHBOARD)
  }, [navigate])

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

  const isKanbanMode = asCard || boardMode === 'kanban'
  const showTasksEmptyState = filteredTasks.length === 0 && topView === 'board' && isKanbanMode
  const tasksEmptyState = onboardingMode ? (
    <EmptyState
      icon={<LayoutGrid className="size-6" />}
      title={t('onboarding.empty.tasksTitle')}
      description={t('onboarding.empty.tasksDescription')}
      actionLabel={t('onboarding.empty.tasksAction')}
      onAction={() => setOnboardingDrawerOpen(true)}
      variant="onboarding"
      className="mx-auto my-10 max-w-xl"
    />
  ) : (
    <EmptyState
      icon={<LayoutGrid className="size-6" />}
      title="该状态下暂无任务"
      description="在下方创建新任务开始使用"
      className="mx-auto my-10 max-w-xl"
    />
  )

  const boardContent = topView === 'board'
    ? isKanbanMode
      ? (
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          {showTasksEmptyState ? (
            tasksEmptyState
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div
                className={cn(
                  'grid grid-cols-1 gap-3 p-1 pb-4 sm:grid-cols-2',
                  asCard ? 'lg:grid-cols-2 xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4',
                )}
              >
                {filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onSelect={setActiveTask}
                    onClick={(nextTask) => {
                      if (bulkMode) toggleTaskSelection(nextTask.id)
                      else setActiveTask(nextTask)
                    }}
                    onDelete={(nextTask) => setDeleteTarget(nextTask)}
                    onTogglePin={(nextTask) => {
                      void handlePin(nextTask.id)
                    }}
                    onFocusStart={(nextTask) => {
                      navigate(`${ROUTES.FOCUS}?taskId=${encodeURIComponent(nextTask.id)}&autostart=1`)
                    }}
                    statusActions={
                      task.status === 'todo'
                        ? [
                            { key: 'doing', label: '开始', onClick: async (nextTask) => handleStatusChange(nextTask.id, 'doing') },
                            { key: 'done', label: '完成', onClick: async (nextTask) => handleStatusChange(nextTask.id, 'done') },
                          ]
                        : [{ key: getNextStatus(task.status).next, label: getNextStatus(task.status).label, onClick: async (nextTask) => handleStatusChange(nextTask.id, getNextStatus(nextTask.status).next) }]
                    }
                    loadingActionKey={statusActionLoadingTaskId === task.id ? statusActionLoadingKey : null}
                    successActionKey={statusActionSuccessTaskId === task.id ? statusActionSuccessKey : null}
                    compact={asCard}
                    selected={selectedTaskIds.has(task.id)}
                    selectionMode={bulkMode}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        )
      : (
        <TaskCalendarWidget tasks={allFilteredTasks} onTaskCreated={(task) => setTasks((prev) => [task, ...prev])} onTaskUpdated={handleUpdateTask} onTaskDeleted={(id) => setTasks((prev) => prev.filter((task) => task.id !== id))} compact={asCard} plain />
        )
    : (
      <TasksAnalyticsView tasks={tasks} />
    )

  const plain = (
    <div className={cn('tasks-fg flex h-full min-h-0 flex-col', asCard ? 'bg-background' : 'bg-transparent', !asCard && 'tasks-fg--plain')}>
      {topView === 'board' ? (
        <div className="mb-0 border-b pb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-0.5">
                {tabs.map((status) => {
                  const cfg = TASK_STATUS_CONFIG[status.key]
                  const count = statusCounts[status.key]
                  const isActive = activeStatus === status.key
                  return (
                    <button
                      key={status.key}
                      className={cn(
                        'tasks-fg__status-tab flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-all',
                        isActive ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                      )}
                      onClick={() => setActiveStatus(status.key)}
                    >
                      <span className={cn('size-1.5 rounded-full', isActive ? cfg.dot : cfg.dot)} />
                      {t(cfg.labelKey)}
                      <span className={cn('min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums', isActive ? 'bg-background text-foreground/80' : 'bg-muted text-muted-foreground')}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="h-5 w-px bg-border" />

              {onboardingMode ? (
                <div className="rounded-full border border-[#3A3733]/10 bg-[#F5F3F0] px-3 py-1.5 text-xs text-[#3A3733]/72">
                  {t('tasks.onboarding.description')}
                </div>
              ) : (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="tasks-fg__filter-btn flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent">
                        <Tag className="size-3" />
                        {t('tasks.selectTag')}
                        {tagFilter.length > 0 ? (
                          <span className="min-w-[16px] rounded-full bg-primary px-1 text-center text-[10px] text-primary-foreground">{tagFilter.length}</span>
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

                  <div className="w-[132px]">
                    <ShadcnSelect value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                      <SelectTrigger className="h-9 rounded-md border-input bg-background/40 px-3 text-xs font-medium text-muted-foreground">
                        <SelectValue placeholder={t('tasks.sortBy')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="importance">{t('tasks.sort.priority')}</SelectItem>
                        <SelectItem value="time">{t('tasks.sort.created')}</SelectItem>
                      </SelectContent>
                    </ShadcnSelect>
                  </div>

                  <span className="text-xs tabular-nums text-muted-foreground">{t('tasks.taskCount', { count: filteredTasks.length })}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {topView === 'board' && isKanbanMode && !asCard && !onboardingMode ? (
                bulkMode ? (
                  <div className="tasks-fg__bulk-bar flex items-center gap-1.5 rounded-md border border-[#3a3733]/10 bg-white px-2 py-1">
                    <button type="button" aria-label={t('tasks.selectAll')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#3A3733]" onClick={toggleSelectAllVisible}>
                      {filteredTaskIds.length > 0 && filteredTaskIds.every((id) => selectedTaskIds.has(id)) ? <CheckSquare className="size-3.5" /> : <Square className="size-3.5" />}
                      全选
                    </button>
                    <span className="px-1 text-xs text-muted-foreground">{t('tasks.selected', { count: selectedCount })}</span>
                    <div className="h-4 w-px bg-border" />
                    <div className="inline-flex items-center gap-1">
                      <ShadcnSelect value={bulkTagDraft} onValueChange={setBulkTagDraft}>
                        <SelectTrigger aria-label={t('tasks.bulkTag')} className="h-7 min-w-[108px] rounded border-[#3a3733]/12 bg-white px-2 text-xs">
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
                      <button type="button" aria-label={t('tasks.applyTag')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#3A3733]" onClick={() => void handleBulkAddTag()} disabled={selectedCount === 0 || !bulkTagDraft.trim()}>
                        <Plus className="size-3.5" />
                        <Tag className="size-3.5" />
                      </button>
                    </div>
                    <button type="button" aria-label={t('tasks.markDone')} className="tasks-fg__bulk-btn inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[#3A3733]" onClick={() => void handleBulkMarkDone()} disabled={selectedCount === 0}>
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
                    className="tasks-fg__bulk-toggle inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                    onClick={() => setBulkMode(true)}
                  >
                    <CheckSquare className="size-3.5" />
                    {t('tasks.bulkEdit')}
                  </button>
                )
              ) : null}

              {!asCard && !onboardingMode ? (
                <div className="flex items-center gap-0.5 rounded-md bg-muted p-0.5">
                  <button
                    className={cn(
                      'tasks-fg__mode-tab flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-all',
                      boardMode === 'kanban' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setBoardMode('kanban')}
                  >
                    <Columns3 className="size-3" />
                    {t('tasks.kanban')}
                  </button>
                  <button
                    className={cn(
                      'tasks-fg__mode-tab flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-all',
                      boardMode === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                    onClick={() => setBoardMode('calendar')}
                  >
                    <CalendarDays className="size-3" />
                    {t('tasks.calendar')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-visible pt-4" data-coachmark-anchor="tasks-entry">
        {boardContent}
      </div>

      {topView === 'board' && isKanbanMode && !onboardingMode ? <TaskAddComposer onSubmit={handleAddTask} plain /> : null}
    </div>
  )

  return (
    <>
      {asCard ? (
        <Card
          title={t('dashboard.widget.tasks')}
          eyebrow={t('tasks.kanban')}
          className={className}
        >
          {plain}
        </Card>
      ) : (
        <section className={cn('tasks-board-surface h-full min-h-0', className)}>{plain}</section>
      )}

      <TaskDrawer
        open={Boolean(activeTask) || onboardingDrawerOpen}
        task={activeTask}
        mode={onboardingDrawerOpen ? 'onboarding' : 'normal'}
        onClose={() => {
          if (onboardingDrawerOpen) {
            exitOnboarding()
            return
          }
          setActiveTask(null)
        }}
        onUpdated={handleUpdateTask}
        onDeleted={(id) => setTasks((prev) => prev.filter((task) => task.id !== id))}
        onRequestDelete={setDeleteTarget}
        onCreated={handleOnboardingCreated}
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
