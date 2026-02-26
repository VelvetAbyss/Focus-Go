import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, PanelLeftOpen, PanelRightOpen, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AnimatedScrollList from '../../../shared/ui/AnimatedScrollList'
import { useAddInputComposer } from '../../../shared/hooks/useAddInputComposer'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { emitTasksChanged, subscribeTasksChanged } from '../../tasks/taskSync'
import type { TaskItem } from '../../tasks/tasks.types'
import { formatTaskDateRange, taskCoversDate } from '../../tasks/taskDates'
import { fetchIcsEventsWithFallback, filterEventsInMonth } from '../calendar.ics'
import {
  buildInitialCalendarSubscriptions,
  buildSampleMonthEvents,
  formatMonthLabel,
  getMonthGridDateKeys,
  isDateInMonth,
  removeAllSystemSubscriptions,
  removeSubscriptionHard,
  reorderSubscriptions,
  sortSubscriptions,
  toggleSubscriptionEnabled,
  updateSubscriptionColor,
  type CalendarEvent,
  type CalendarProvider,
  type CalendarSubscription,
} from '../calendar.model'

const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const STORAGE_SUBSCRIPTIONS_KEY = 'focusgo.calendar.subscriptions.v1'
const STORAGE_ICS_EVENTS_KEY = 'focusgo.calendar.icsEvents.v1'
const CALENDAR_PRESET_COLORS = ['#94a3b8', '#60a5fa', '#2563eb', '#0ea5e9', '#10b981', '#22c55e', '#f59e0b', '#ef4444', '#64748b', '#0f766e']
const CALENDAR_PRESET_SUBSCRIPTION_PLACEHOLDERS = [
  {
    id: 'preset-cn-holidays',
    name: 'China Public Holidays',
    description: 'Official public holiday calendar',
  },
  {
    id: 'preset-us-holidays',
    name: 'US Federal Holidays',
    description: 'Federal holiday schedule',
  },
  {
    id: 'preset-moon',
    name: 'Moon Phases',
    description: 'Lunar phase events',
  },
]

type SubscriptionSyncState = {
  status: 'idle' | 'loading' | 'ok' | 'error'
  message?: string
}

const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const hasCjk = (text: string) => /[\u3400-\u9FFF]/.test(text)

const formatDateTimeLocalInput = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const date = new Date(value)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return `${y}-${m}-${d}T${hh}:${mm}`
}

const parseDateTimeLocalInput = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const ts = new Date(trimmed).getTime()
  return Number.isFinite(ts) ? ts : undefined
}

const formatReminderLabel = (value?: number) => {
  if (typeof value !== 'number') return 'No reminder'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TaskCardDraft = {
  startDate: string
  endDate: string
  reminderAtInput: string
  priority: TaskItem['priority']
}

const buildTaskCardDraft = (task: TaskItem): TaskCardDraft => ({
  startDate: task.startDate ?? '',
  endDate: task.endDate ?? '',
  reminderAtInput: formatDateTimeLocalInput(task.reminderAt),
  priority: task.priority,
})

const providerLabel: Record<CalendarProvider, string> = {
  builtin: 'Built-in',
  ics: 'ICS/webcal',
  google: 'Google',
  apple: 'Apple',
  outlook: 'Outlook',
}

const readStoredSubscriptions = () => {
  if (typeof window === 'undefined') return buildInitialCalendarSubscriptions()

  try {
    const raw = window.localStorage.getItem(STORAGE_SUBSCRIPTIONS_KEY)
    if (!raw) return buildInitialCalendarSubscriptions()
    const parsed = JSON.parse(raw) as CalendarSubscription[]
    if (!Array.isArray(parsed) || parsed.length === 0) return buildInitialCalendarSubscriptions()
    return sortSubscriptions(removeAllSystemSubscriptions(parsed))
  } catch {
    return buildInitialCalendarSubscriptions()
  }
}

const readStoredIcsEvents = () => {
  if (typeof window === 'undefined') return {} as Record<string, CalendarEvent[]>

  try {
    const raw = window.localStorage.getItem(STORAGE_ICS_EVENTS_KEY)
    if (!raw) return {} as Record<string, CalendarEvent[]>
    const parsed = JSON.parse(raw) as Record<string, CalendarEvent[]>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {} as Record<string, CalendarEvent[]>
  }
}

type SortableSubscriptionItemProps = {
  sub: CalendarSubscription
  syncState?: SubscriptionSyncState
  onToggleSubscription: (subscriptionId: string) => void
  onUpdateColor: (subscriptionId: string, color: string) => void
  onRemoveSubscription: (subscriptionId: string) => void
  onMoveByStep: (subscriptionId: string, step: -1 | 1) => void
}

const SortableSubscriptionItem = ({
  sub,
  syncState,
  onToggleSubscription,
  onUpdateColor,
  onRemoveSubscription,
  onMoveByStep,
}: SortableSubscriptionItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: sub.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`calendar-subscriptions__item${isDragging ? ' is-dragging' : ''}${isOver ? ' is-over' : ''}${sub.enabled ? '' : ' is-disabled'}`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="calendar-subscriptions__drag-handle"
        aria-label={`Reorder ${sub.name}`}
        title={`Reorder ${sub.name}`}
        {...attributes}
        {...listeners}
        onKeyDown={(event) => {
          if (!event.altKey) return
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            onMoveByStep(sub.id, -1)
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            onMoveByStep(sub.id, 1)
          }
        }}
      >
        <GripVertical />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="calendar-subscriptions__visibility"
        aria-label={`Toggle visibility for ${sub.name}`}
        onClick={() => onToggleSubscription(sub.id)}
      >
        {sub.enabled ? <Eye /> : <EyeOff />}
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="calendar-subscriptions__dot-trigger"
            aria-label={`Open color picker for ${sub.name}`}
            style={{ background: sub.color }}
          />
        </PopoverTrigger>
        <PopoverContent className="calendar-color-popover" align="end">
          <div className="calendar-color-popover__title">Preset colors</div>
          <div className="calendar-color-grid" role="listbox" aria-label={`Preset colors for ${sub.name}`}>
            {CALENDAR_PRESET_COLORS.map((presetColor) => (
              <button
                key={`${sub.id}-${presetColor}`}
                type="button"
                className={`calendar-color-swatch${sub.color.toLowerCase() === presetColor.toLowerCase() ? ' is-selected' : ''}`}
                style={{ background: presetColor }}
                onClick={() => onUpdateColor(sub.id, presetColor)}
                aria-label={`Set ${sub.name} color to ${presetColor}`}
              />
            ))}
          </div>
          <Label htmlFor={`color-${sub.id}`}>Custom</Label>
          <Input
            id={`color-${sub.id}`}
            type="color"
            aria-label={`Color for ${sub.name}`}
            value={sub.color}
            onChange={(event) => onUpdateColor(sub.id, event.currentTarget.value)}
          />
        </PopoverContent>
      </Popover>
      <span className="calendar-subscriptions__name">{sub.name}</span>
      <div className="calendar-subscriptions__meta">
        {sub.provider === 'google' ? (
          <Badge variant="outline" className="calendar-provider-badge">
            {providerLabel[sub.provider]}
          </Badge>
        ) : null}
        {syncState?.status === 'loading' ? <Badge variant="outline">Syncing</Badge> : null}
        {syncState?.status === 'error' ? (
          <Badge variant="destructive" title={syncState.message} className="calendar-sync-error">
            !
          </Badge>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="calendar-subscriptions__remove"
        aria-label={`Remove ${sub.name}`}
        onClick={() => onRemoveSubscription(sub.id)}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

const CalendarPage = () => {
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>(readStoredSubscriptions)
  const [icsEventsBySubscription, setIcsEventsBySubscription] = useState<Record<string, CalendarEvent[]>>(readStoredIcsEvents)
  const [syncStateBySubscription, setSyncStateBySubscription] = useState<Record<string, SubscriptionSyncState>>({})
  const [allTasks, setAllTasks] = useState<TaskItem[]>([])
  const [creatingSelectedDayTask, setCreatingSelectedDayTask] = useState(false)
  const [deletingTaskIds, setDeletingTaskIds] = useState<Record<string, boolean>>({})
  const [savingTaskCardIds, setSavingTaskCardIds] = useState<Record<string, boolean>>({})
  const [taskCardDrafts, setTaskCardDrafts] = useState<Record<string, TaskCardDraft>>({})
  const [taskDeleteError, setTaskDeleteError] = useState<string | null>(null)
  const [taskCardError, setTaskCardError] = useState<string | null>(null)

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'google' | 'ics'>('google')
  const [icsName, setIcsName] = useState('')
  const [icsUrl, setIcsUrl] = useState('')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [pendingDeleteSubscriptionId, setPendingDeleteSubscriptionId] = useState<string | null>(null)

  const [createDateKey, setCreateDateKey] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [creatingGridTask, setCreatingGridTask] = useState(false)
  const tasksLoadRequestRef = useRef(0)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const monthGridDateKeys = useMemo(() => getMonthGridDateKeys(anchorDate), [anchorDate])
  const todayDateKey = toDateKey(new Date())
  const visibleSubscriptionIds = useMemo(
    () => new Set(subscriptions.filter((sub) => sub.enabled).map((sub) => sub.id)),
    [subscriptions]
  )

  const syncSubscription = useCallback(async (subscription: CalendarSubscription) => {
    if (!subscription.url) return

    setSyncStateBySubscription((prev) => ({ ...prev, [subscription.id]: { status: 'loading' } }))

    try {
      const events = await fetchIcsEventsWithFallback(subscription.url, subscription.id)
      setIcsEventsBySubscription((prev) => ({ ...prev, [subscription.id]: events }))
      setSyncStateBySubscription((prev) => ({ ...prev, [subscription.id]: { status: 'ok' } }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync this calendar source'
      setIcsEventsBySubscription((prev) => ({ ...prev, [subscription.id]: [] }))
      setSyncStateBySubscription((prev) => ({ ...prev, [subscription.id]: { status: 'error', message } }))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_SUBSCRIPTIONS_KEY, JSON.stringify(subscriptions))
  }, [subscriptions])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_ICS_EVENTS_KEY, JSON.stringify(icsEventsBySubscription))
  }, [icsEventsBySubscription])

  useEffect(() => {
    subscriptions
      .filter((subscription) => subscription.enabled && Boolean(subscription.url))
      .forEach((subscription) => {
        void syncSubscription(subscription)
      })
  }, [subscriptions, syncSubscription])

  const loadTasks = useCallback(async () => {
    const requestId = tasksLoadRequestRef.current + 1
    tasksLoadRequestRef.current = requestId
    const items = await tasksRepo.list()
    if (tasksLoadRequestRef.current !== requestId) return
    setAllTasks(items)
  }, [])

  useEffect(() => {
    void loadTasks()
    return subscribeTasksChanged(() => {
      void loadTasks()
    })
  }, [loadTasks])

  const monthEvents = useMemo(() => {
    const seeded = buildSampleMonthEvents(anchorDate)
    const remoteEvents = filterEventsInMonth(Object.values(icsEventsBySubscription).flat(), anchorDate)

    return [...seeded, ...remoteEvents].filter((event) => visibleSubscriptionIds.has(event.subscriptionId))
  }, [anchorDate, icsEventsBySubscription, visibleSubscriptionIds])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    monthEvents.forEach((event) => grouped.set(event.dateKey, [...(grouped.get(event.dateKey) ?? []), event]))
    return grouped
  }, [monthEvents])

  const unifiedSubscriptions = useMemo(
    () => sortSubscriptions(removeAllSystemSubscriptions(subscriptions)),
    [subscriptions]
  )

  const pendingDeleteSubscription = useMemo(
    () => unifiedSubscriptions.find((subscription) => subscription.id === pendingDeleteSubscriptionId) ?? null,
    [unifiedSubscriptions, pendingDeleteSubscriptionId]
  )

  const selectedDayEvents = useMemo(() => eventsByDate.get(selectedDateKey) ?? [], [eventsByDate, selectedDateKey])
  const subscriptionColorById = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription.color])),
    [subscriptions]
  )

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>()
    allTasks.forEach((task) => {
      monthGridDateKeys.forEach((dateKey) => {
        if (!taskCoversDate(task, dateKey)) return
        grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), task])
      })
    })
    grouped.forEach((tasks, dateKey) => {
      grouped.set(
        dateKey,
        tasks
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
      )
    })
    return grouped
  }, [allTasks, monthGridDateKeys])

  const selectedDayTasks = useMemo(
    () =>
      allTasks
        .filter((task) => taskCoversDate(task, selectedDateKey))
        .slice()
        .sort((a, b) => b.createdAt - a.createdAt),
    [allTasks, selectedDateKey]
  )

  const jumpToToday = () => {
    const now = new Date()
    setAnchorDate(now)
    setSelectedDateKey(toDateKey(now))
  }

  const moveMonth = (direction: -1 | 1) =>
    setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))

  const handleToggleSubscription = (subscriptionId: string) => {
    setSubscriptions((prev) => {
      const current = prev.find((sub) => sub.id === subscriptionId)
      if (!current) return prev

      const next = toggleSubscriptionEnabled(prev, subscriptionId)
      const nextSub = next.find((sub) => sub.id === subscriptionId)
      if (nextSub?.enabled && nextSub.url) {
        void syncSubscription(nextSub)
      }
      return next
    })
  }

  const handleUpdateSubscriptionColor = (subscriptionId: string, color: string) => {
    setSubscriptions((prev) => updateSubscriptionColor(prev, subscriptionId, color))
  }

  const requestRemoveSubscription = (subscriptionId: string) => {
    setPendingDeleteSubscriptionId(subscriptionId)
  }

  const confirmRemoveSubscription = () => {
    const targetId = pendingDeleteSubscriptionId
    if (!targetId) return
    setSubscriptions((prev) => removeSubscriptionHard(prev, targetId))
    setIcsEventsBySubscription((prev) => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    setSyncStateBySubscription((prev) => {
      const next = { ...prev }
      delete next[targetId]
      return next
    })
    setPendingDeleteSubscriptionId(null)
  }

  const handleSubscriptionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSubscriptions((prev) => {
      const withoutSystem = removeAllSystemSubscriptions(prev)
      const ordered = sortSubscriptions(withoutSystem)
      const oldIndex = ordered.findIndex((item) => item.id === active.id)
      const newIndex = ordered.findIndex((item) => item.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return prev

      const moved = arrayMove(ordered, oldIndex, newIndex)
      return reorderSubscriptions(withoutSystem, moved.map((item) => item.id))
    })
  }

  const moveSubscriptionByStep = (subscriptionId: string, step: -1 | 1) => {
    setSubscriptions((prev) => {
      const withoutSystem = removeAllSystemSubscriptions(prev)
      const ordered = sortSubscriptions(withoutSystem)
      const currentIndex = ordered.findIndex((item) => item.id === subscriptionId)
      if (currentIndex === -1) return prev

      const nextIndex = currentIndex + step
      if (nextIndex < 0 || nextIndex >= ordered.length) return prev

      const moved = arrayMove(ordered, currentIndex, nextIndex)
      return reorderSubscriptions(withoutSystem, moved.map((item) => item.id))
    })
  }

  const addIcsSubscription = async () => {
    const name = icsName.trim()
    const url = icsUrl.trim()
    if (!name || !url) return
    const nextOrder = unifiedSubscriptions.length

    const next: CalendarSubscription = {
      id: `custom-${Date.now()}`,
      name,
      sourceType: 'custom',
      provider: 'ics',
      color: '#0ea5e9',
      enabled: true,
      syncPermission: 'read',
      order: nextOrder,
      url,
    }

    setSubscriptions((prev) => sortSubscriptions([...prev, next]))
    setIcsName('')
    setIcsUrl('')
    setIsAccountDialogOpen(false)
    await syncSubscription(next)
  }

  const addGoogleReadOnlyAccount = () => {
    const hasGoogle = subscriptions.some((sub) => sub.provider === 'google')
    if (!hasGoogle) {
      const nextOrder = unifiedSubscriptions.length
      const next: CalendarSubscription = {
        id: `account-google-${Date.now()}`,
        name: 'Google Calendar (M1 Read-Only)',
        sourceType: 'account',
        provider: 'google',
        color: '#2563eb',
        enabled: true,
        syncPermission: 'read',
        order: nextOrder,
      }
      setSubscriptions((prev) => sortSubscriptions([...prev, next]))
    }
    setIsAccountDialogOpen(false)
  }

  const openCreateEvent = (dateKey: string) => {
    setCreateDateKey(dateKey)
    setCreateTitle('')
  }

  const createTaskFromGridDate = async () => {
    const dateKey = createDateKey
    const title = createTitle.trim()
    if (!dateKey || !title || creatingGridTask) return

    setCreatingGridTask(true)
    try {
      const created = await tasksRepo.add({
        title,
        description: '',
        status: 'todo',
        priority: null,
        dueDate: dateKey,
        tags: ['red'],
        subtasks: [],
      })
      setAllTasks((prev) => [created, ...prev])
      emitTasksChanged('calendar:grid-doubleclick-create')
      setSelectedDateKey(dateKey)
      setCreateDateKey(null)
      setCreateTitle('')
    } finally {
      setCreatingGridTask(false)
    }
  }

  const handleCreateSelectedDayTask = async (title: string) => {
    if (creatingSelectedDayTask) return
    setCreatingSelectedDayTask(true)
    try {
      const created = await tasksRepo.add({
        title,
        description: '',
        status: 'todo',
        priority: null,
        dueDate: selectedDateKey,
        tags: ['red'],
        subtasks: [],
      })
      setAllTasks((prev) => [created, ...prev])
      emitTasksChanged('calendar:selected-day-create')
    } finally {
      setCreatingSelectedDayTask(false)
    }
  }

  const selectedDayTaskComposer = useAddInputComposer({
    onSubmit: handleCreateSelectedDayTask,
  })

  const handleDeleteSelectedDayTask = async (taskId: string) => {
    if (deletingTaskIds[taskId]) return

    setTaskDeleteError(null)
    setDeletingTaskIds((prev) => ({ ...prev, [taskId]: true }))
    try {
      await tasksRepo.remove(taskId)
      setAllTasks((prev) => prev.filter((task) => task.id !== taskId))
      emitTasksChanged('calendar:selected-day-delete')
      setTaskDeleteError(null)
    } catch {
      setTaskDeleteError('Failed to delete task. Please try again.')
    } finally {
      setDeletingTaskIds((prev) => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    }
  }

  const updateTaskCardDraft = (taskId: string, patch: Partial<TaskCardDraft>) => {
    setTaskCardDrafts((prev) => {
      const current = prev[taskId]
      const next = { ...(current ?? { startDate: '', endDate: '', reminderAtInput: '', priority: null }), ...patch }
      return { ...prev, [taskId]: next }
    })
  }

  const handleTaskCardEditorOpen = (task: TaskItem, open: boolean) => {
    if (!open) return
    setTaskCardDrafts((prev) => ({ ...prev, [task.id]: buildTaskCardDraft(task) }))
  }

  const handleSaveTaskCard = async (task: TaskItem) => {
    if (savingTaskCardIds[task.id]) return
    const draft = taskCardDrafts[task.id] ?? buildTaskCardDraft(task)
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      setTaskCardError('End date must be on or after start date.')
      return
    }

    setTaskCardError(null)
    setSavingTaskCardIds((prev) => ({ ...prev, [task.id]: true }))
    try {
      const nextReminderAt = parseDateTimeLocalInput(draft.reminderAtInput)
      const nextTask: TaskItem = {
        ...task,
        priority: draft.priority,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        reminderAt: nextReminderAt,
        reminderFiredAt: nextReminderAt === task.reminderAt ? task.reminderFiredAt : undefined,
      }
      const updated = await tasksRepo.update(nextTask)
      setAllTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      emitTasksChanged('calendar:selected-day-update-task')
    } finally {
      setSavingTaskCardIds((prev) => {
        const next = { ...prev }
        delete next[task.id]
        return next
      })
    }
  }

  useEffect(() => {
    selectedDayTaskComposer.setValue('')
    setTaskDeleteError(null)
    setTaskCardError(null)
  }, [selectedDateKey])

  return (
    <section
      className={`calendar-v2${leftSidebarOpen ? ' is-left-open' : ''}${rightSidebarOpen ? ' is-right-open' : ''}`}
      aria-label="Calendar page"
    >
      <aside className="calendar-v2__left calendar-v2__drawer" aria-label="Calendar sidebar">
        <div className="calendar-v2__drawer-header">
          <h3>Scheduling panel</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="calendar-v2__drawer-close"
            aria-label="Close scheduling panel"
            onClick={() => setLeftSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="calendar-mini">
          <div className="calendar-mini__weekdays">
            {weekLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="calendar-mini__grid">
            {monthGridDateKeys.map((dateKey) => {
              const date = new Date(`${dateKey}T12:00:00`)
              const isCurrentMonth = isDateInMonth(dateKey, anchorDate)
              const isSelected = selectedDateKey === dateKey
              const isToday = todayDateKey === dateKey
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`calendar-mini__cell${isCurrentMonth ? '' : ' is-dim'}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => setSelectedDateKey(dateKey)}
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        <section className="calendar-subscriptions" aria-label="Subscriptions">
          <h3>Scheduling</h3>
          <ScrollArea className="calendar-subscriptions__scroll">
            <div className="calendar-subscriptions__inner">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubscriptionDragEnd}>
                <SortableContext items={unifiedSubscriptions.map((sub) => sub.id)} strategy={verticalListSortingStrategy}>
                  <div className="calendar-subscriptions__list">
                    {unifiedSubscriptions.map((sub) => (
                      <SortableSubscriptionItem
                        key={sub.id}
                        sub={sub}
                        syncState={syncStateBySubscription[sub.id]}
                        onToggleSubscription={handleToggleSubscription}
                        onUpdateColor={handleUpdateSubscriptionColor}
                        onRemoveSubscription={requestRemoveSubscription}
                        onMoveByStep={moveSubscriptionByStep}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </ScrollArea>

          <Button variant="outline" className="calendar-subscriptions__add" onClick={() => setIsAccountDialogOpen(true)}>
            <Plus />
            Add subscription
          </Button>
        </section>
      </aside>

      <main className="calendar-v2__main" aria-label="Monthly calendar">
        <header className="calendar-toolbar">
          <div className="calendar-toolbar__left">
            <Select value="month" onValueChange={() => undefined}>
              <SelectTrigger aria-label="View mode" className="calendar-toolbar__select">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={jumpToToday}>
              Today
            </Button>
          </div>
          <div className="calendar-toolbar__compact-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="calendar-v2__toggle"
              onClick={() => setLeftSidebarOpen((prev) => !prev)}
              aria-pressed={leftSidebarOpen}
            >
              <PanelLeftOpen />
              Scheduling
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="calendar-v2__toggle"
              onClick={() => setRightSidebarOpen((prev) => !prev)}
              aria-pressed={rightSidebarOpen}
            >
              <PanelRightOpen />
              Day panel
            </Button>
          </div>
          <div className="calendar-toolbar__right">
            <Button variant="ghost" size="icon" onClick={() => moveMonth(-1)} aria-label="Previous month">
              ‹
            </Button>
            <Button variant="ghost" size="icon" onClick={() => moveMonth(1)} aria-label="Next month">
              ›
            </Button>
          </div>
        </header>

        <h1 className="calendar-main-title">{formatMonthLabel(anchorDate)}</h1>

        <div className="calendar-month-grid" role="grid">
          {weekLabels.map((label) => (
            <div key={label} className="calendar-month-grid__weekday" role="columnheader">
              {label}
            </div>
          ))}

          {monthGridDateKeys.map((dateKey) => {
            const date = new Date(`${dateKey}T12:00:00`)
            const dayEvents = (eventsByDate.get(dateKey) ?? []).slice().sort((a, b) => {
              const rank = { lunar: 0, holiday: 1, event: 2 }
              return rank[a.kind] - rank[b.kind]
            })
            const dayTasks = (tasksByDate.get(dateKey) ?? []).slice(0, 2)
            const dayItems = [
              ...dayTasks.map((task) => ({
                id: `task-${task.id}`,
                title: task.title.trim() || 'Untitled',
                type: 'task' as const,
                status: task.status,
              })),
              ...dayEvents.map((event) => ({
                id: event.id,
                title: event.title.trim() || 'Untitled event',
                type: 'event' as const,
                kind: event.kind,
                subscriptionId: event.subscriptionId,
              })),
            ]
            const visible = dayItems.slice(0, 2)
            const overflow = dayItems.length - visible.length
            const isCurrentMonth = isDateInMonth(dateKey, anchorDate)
            const isSelected = selectedDateKey === dateKey
            const isToday = todayDateKey === dateKey

            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-month-grid__cell${isCurrentMonth ? '' : ' is-outside'}${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                onClick={() => setSelectedDateKey(dateKey)}
                onDoubleClick={() => openCreateEvent(dateKey)}
              >
                <div className="calendar-month-grid__date">{date.getDate()}</div>
                <div className="calendar-month-grid__events">
                  {visible.map((item) =>
                    item.type === 'task' ? (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        className="calendar-chip calendar-chip--task calendar-chip--task-red"
                      >
                        {item.title}
                      </Badge>
                    ) : (
                      <Badge
                        key={item.id}
                        variant="secondary"
                        data-subscription-id={item.subscriptionId}
                        className={`calendar-chip calendar-chip--${item.kind}`}
                        style={
                          subscriptionColorById.get(item.subscriptionId)
                            ? {
                                background: `color-mix(in srgb, ${subscriptionColorById.get(item.subscriptionId)} 22%, var(--bg-muted))`,
                                color: `color-mix(in srgb, ${subscriptionColorById.get(item.subscriptionId)} 86%, var(--text-primary))`,
                              }
                            : undefined
                        }
                      >
                        {item.title}
                      </Badge>
                    )
                  )}
                  {overflow > 0 ? <span className="calendar-chip calendar-chip--more">+{overflow}</span> : null}
                </div>
              </button>
            )
          })}
        </div>
      </main>

      <aside className="calendar-v2__right calendar-v2__drawer" aria-label="Events tools">
        <div className="calendar-v2__drawer-header">
          <h3>Day panel</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="calendar-v2__drawer-close"
            aria-label="Close day panel"
            onClick={() => setRightSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>
        <section className="calendar-side-panel" aria-label="Selected date details">
          <h3 className="calendar-side-panel__title">Calendar Event</h3>
          <ul className="calendar-side-panel__list" aria-label="Calendar events list">
            {selectedDayEvents.slice(0, 6).map((event) => {
              const eventTitle = event.title.trim() || 'Untitled event'
              const eventColor = subscriptionColorById.get(event.subscriptionId)
              return (
                <li key={event.id} className="calendar-side-row">
                  <span
                    className={`calendar-side-row__dot calendar-side-row__dot--${event.kind}`}
                    aria-hidden="true"
                    style={eventColor ? { background: eventColor } : undefined}
                  />
                  <span className={`calendar-side-row__text${hasCjk(eventTitle) ? ' is-cjk' : ''}`}>{eventTitle}</span>
                </li>
              )
            })}
          </ul>

          <div className="calendar-side-panel__divider" />

          <h3 className="calendar-side-panel__title">Tasks</h3>
          <div className="calendar-side-panel__list calendar-side-panel__list--animated" aria-label="Tasks list">
            <AnimatedScrollList
              items={selectedDayTasks}
              getKey={(task) => task.id}
              showGradients={false}
              displayScrollbar={false}
              itemDelay={0.1}
              listClassName="calendar-side-panel__animated-scroll"
              renderItem={(task) => {
                const taskTitle = task.title.trim() || 'Untitled'
                const isDeleting = Boolean(deletingTaskIds[task.id])
                const isSavingCard = Boolean(savingTaskCardIds[task.id])
                const draft = taskCardDrafts[task.id] ?? buildTaskCardDraft(task)
                const taskTags = task.tags.slice(0, 2)
                const hiddenTagCount = Math.max(0, task.tags.length - taskTags.length)
                return (
                  <article className="calendar-task-card">
                    <div className="calendar-task-card__header">
                      <span className={`calendar-side-row__dot calendar-side-row__dot--${task.status}`} aria-hidden="true" />
                      <span className={`calendar-side-row__text${hasCjk(taskTitle) ? ' is-cjk' : ''}`}>{taskTitle}</span>
                      <div className="calendar-side-row__action">
                        <Popover onOpenChange={(open) => handleTaskCardEditorOpen(task, open)}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="calendar-task-card__edit">
                              Edit
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="calendar-task-card__editor" align="end">
                            <div className="calendar-task-card__editor-grid">
                              <label>
                                <span>Start date</span>
                                <Input
                                  type="date"
                                  value={draft.startDate}
                                  onChange={(event) => updateTaskCardDraft(task.id, { startDate: event.currentTarget.value })}
                                />
                              </label>
                              <label>
                                <span>End date</span>
                                <Input
                                  type="date"
                                  value={draft.endDate}
                                  onChange={(event) => updateTaskCardDraft(task.id, { endDate: event.currentTarget.value })}
                                />
                              </label>
                              <label>
                                <span>Reminder</span>
                                <Input
                                  type="datetime-local"
                                  value={draft.reminderAtInput}
                                  onChange={(event) => updateTaskCardDraft(task.id, { reminderAtInput: event.currentTarget.value })}
                                />
                              </label>
                              <label>
                                <span>Priority</span>
                                <Select
                                  value={draft.priority ?? '__none'}
                                  onValueChange={(value) =>
                                    updateTaskCardDraft(task.id, { priority: value === '__none' ? null : (value as TaskItem['priority']) })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none">None</SelectItem>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                  </SelectContent>
                                </Select>
                              </label>
                            </div>
                            <div className="calendar-task-card__editor-actions">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskCardDraft(task.id, { reminderAtInput: '' })}
                              >
                                Clear reminder
                              </Button>
                              <Button type="button" size="sm" onClick={() => void handleSaveTaskCard(task)} disabled={isSavingCard}>
                                Save
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="calendar-side-row__delete"
                          aria-label="Delete task"
                          title="Delete task"
                          disabled={isDeleting}
                          onClick={() => void handleDeleteSelectedDayTask(task.id)}
                        >
                          {isDeleting ? (
                            <RotateCcw className="calendar-side-row__delete-icon is-loading" />
                          ) : (
                            <Trash2 className="calendar-side-row__delete-icon" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="calendar-task-card__meta">
                      <Badge variant="outline" className="calendar-task-card__meta-badge">
                        {task.status}
                      </Badge>
                      <Badge variant="outline" className="calendar-task-card__meta-badge">
                        {task.priority ?? 'none'}
                      </Badge>
                      <Badge variant="outline" className="calendar-task-card__meta-badge">
                        {formatTaskDateRange(task)}
                      </Badge>
                      <Badge variant="outline" className="calendar-task-card__meta-badge">
                        {formatReminderLabel(task.reminderAt)}
                      </Badge>
                    </div>
                    {taskTags.length > 0 ? (
                      <div className="calendar-task-card__tags">
                        {taskTags.map((tag) => (
                          <Badge key={`${task.id}-${tag}`} variant="secondary" className="calendar-task-card__tag">
                            {tag}
                          </Badge>
                        ))}
                        {hiddenTagCount > 0 ? (
                          <Badge variant="secondary" className="calendar-task-card__tag">
                            +{hiddenTagCount}
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                )
              }}
            />
          </div>
          {taskCardError ? (
            <p role="status" className="calendar-side-panel__error">
              {taskCardError}
            </p>
          ) : null}
          {taskDeleteError ? (
            <p role="status" className="calendar-side-panel__error">
              {taskDeleteError}
            </p>
          ) : null}

          <form
            className="calendar-side-panel__composer"
            onSubmit={(event) => {
              event.preventDefault()
              if (creatingSelectedDayTask) return
              void selectedDayTaskComposer.submit()
            }}
          >
            <Input
              aria-label="New task title"
              placeholder=""
              ref={selectedDayTaskComposer.inputRef}
              className={`widget-todos__input ${selectedDayTaskComposer.isShaking ? 'is-shaking' : ''}`}
              value={selectedDayTaskComposer.value}
              onChange={(event) => selectedDayTaskComposer.setValue(event.currentTarget.value)}
              onAnimationEnd={selectedDayTaskComposer.clearShake}
            />
            <Button
              type="submit"
              className="calendar-side-panel__add"
              disabled={creatingSelectedDayTask || !selectedDayTaskComposer.canSubmit}
            >
              Add
            </Button>
          </form>
        </section>
      </aside>

      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="calendar-dialog__content">
          <DialogHeader>
            <DialogTitle>Add subscription</DialogTitle>
            <DialogDescription>Connect Google (read-only) or add an ICS/webcal subscription.</DialogDescription>
          </DialogHeader>
          <div className="calendar-dialog">
            <div className="calendar-dialog__switch">
              <Button
                type="button"
                variant={accountMode === 'google' ? 'default' : 'outline'}
                onClick={() => setAccountMode('google')}
              >
                Google
              </Button>
              <Button
                type="button"
                variant={accountMode === 'ics' ? 'default' : 'outline'}
                onClick={() => setAccountMode('ics')}
              >
                ICS / webcal
              </Button>
            </div>

            <section className="calendar-dialog__presets" aria-label="Preset subscriptions">
              <h4>Preset subscriptions</h4>
              <div className="calendar-dialog__presets-list">
                {CALENDAR_PRESET_SUBSCRIPTION_PLACEHOLDERS.map((preset) => (
                  <article key={preset.id} className="calendar-dialog__preset-card">
                    <div className="calendar-dialog__preset-meta">
                      <p>{preset.name}</p>
                      <small>{preset.description} · Coming soon</small>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="calendar-dialog__preset-add"
                      disabled
                    >
                      Add
                    </Button>
                  </article>
                ))}
              </div>
            </section>

            {accountMode === 'google' ? (
              <div className="calendar-dialog__panel">
                <p>Connect Google calendar in read-only mode for M1.</p>
                <Button type="button" onClick={addGoogleReadOnlyAccount}>
                  Connect Google (read-only)
                </Button>
              </div>
            ) : (
              <div className="calendar-dialog__panel">
                <section className="calendar-dialog__guide" aria-label="ICS guide">
                  <p className="calendar-dialog__guide-title">How to get an ICS subscription URL</p>
                  <ol className="calendar-dialog__guide-list">
                    <li>Open your calendar provider settings.</li>
                    <li>Find “Secret address in iCal format” or “Subscribe URL”.</li>
                    <li>Copy the URL and paste it into the ICS URL field below.</li>
                  </ol>
                  <p className="calendar-dialog__guide-note">
                    Common providers: Google Calendar / Outlook / Apple Calendar. Accepted format: https://...ics or
                    webcal://...
                  </p>
                </section>
                <Label htmlFor="ics-name">Name</Label>
                <Input id="ics-name" value={icsName} onChange={(event) => setIcsName(event.currentTarget.value)} />
                <Label htmlFor="ics-url">ICS URL</Label>
                <Input
                  id="ics-url"
                  value={icsUrl}
                  onChange={(event) => setIcsUrl(event.currentTarget.value)}
                  placeholder="https://example.com/calendar.ics"
                />
                <Button type="button" onClick={() => void addIcsSubscription()}>
                  Add ICS subscription
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAccountDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeleteSubscriptionId)} onOpenChange={(open) => (open ? null : setPendingDeleteSubscriptionId(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove calendar?</DialogTitle>
            <DialogDescription>
              {pendingDeleteSubscription
                ? `Delete "${pendingDeleteSubscription.name}" permanently? This subscription will be permanently deleted.`
                : 'Delete this subscription permanently? This subscription will be permanently deleted.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteSubscriptionId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemoveSubscription}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createDateKey)} onOpenChange={(open) => (open ? null : setCreateDateKey(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create task</DialogTitle>
            <DialogDescription>Date: {createDateKey}</DialogDescription>
          </DialogHeader>
          <div className="calendar-dialog__panel">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createTaskFromGridDate()
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDateKey(null)}>
              Cancel
            </Button>
            <Button onClick={() => void createTaskFromGridDate()} disabled={creatingGridTask || !createTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default CalendarPage
