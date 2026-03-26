import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
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
import { Check, Eye, EyeOff, GripVertical, PanelLeftOpen, PanelRightOpen, Plus, RotateCcw, Trash2, X } from 'lucide-react'
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
import { DateRangePicker } from '../../../shared/ui/DateRangePicker'
import { DateTimePicker } from '../../../shared/ui/DateTimePicker'
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

const calendarEventKindRank = { lunar: 0, holiday: 1, event: 2 } as const

const STORAGE_SUBSCRIPTIONS_KEY = 'focusgo.calendar.subscriptions.v1'
const STORAGE_ICS_EVENTS_KEY = 'focusgo.calendar.icsEvents.v1'
const STORAGE_TASK_COLORS_KEY = 'focusgo.calendar.taskColors.v1'
const CALENDAR_PRESET_COLORS = ['#9ca3af', '#60a5fa', '#2563eb', '#22d3ee', '#34d399', '#10b981', '#22c55e', '#f59e0b', '#ef4444', '#fb7185', '#6b7280', '#0f766e']
const CALENDAR_PRESET_SUBSCRIPTIONS = [
  {
    id: 'preset-cn-holidays',
    name: 'China Public Holidays',
    description: 'Mainland China public holidays',
    color: '#ef4444',
    url: 'https://ical.muhan.org/rest.ics',
  },
  {
    id: 'preset-cn-workdays',
    name: 'China Workdays',
    description: 'Mainland China make-up workdays',
    color: '#f59e0b',
    url: 'https://ical.muhan.org/work.ics',
  },
  {
    id: 'preset-us-holidays',
    name: 'US Federal Holidays',
    description: 'US public holiday calendar',
    color: '#2563eb',
    url: 'https://calendar.google.com/calendar/ical/en.usa.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  },
  {
    id: 'preset-uk-holidays',
    name: 'UK Bank Holidays',
    description: 'United Kingdom public holidays',
    color: '#3b82f6',
    url: 'https://calendar.google.com/calendar/ical/en.uk.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  },
  {
    id: 'preset-jp-holidays',
    name: 'Japan Public Holidays',
    description: 'Japan national holiday calendar',
    color: '#ec4899',
    url: 'https://calendar.google.com/calendar/ical/en.japanese.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  },
  {
    id: 'preset-sg-holidays',
    name: 'Singapore Public Holidays',
    description: 'Singapore holiday calendar',
    color: '#14b8a6',
    url: 'https://calendar.google.com/calendar/ical/en.singapore.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  },
  {
    id: 'preset-moon',
    name: 'Moon Phases',
    description: 'Quarter, full, and new moon events',
    color: '#8b5cf6',
    url: 'https://raw.githubusercontent.com/PanderMusubi/lunar-phase-calendar/master/GB/en/moon-phases.ics',
  },
  {
    id: 'preset-solar-terms',
    name: '24 Solar Terms',
    description: '二十四节气',
    color: '#10b981',
    url: 'https://raw.githubusercontent.com/KaitoHH/24-jieqi-ics/master/23_solar_terms_2015-01-01_2050-12-31.ics',
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
const isHexColor = (value: string) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(value.trim())
const normalizeHexColor = (value: string) => {
  const trimmed = value.trim()
  if (!isHexColor(trimmed)) return null
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return trimmed.toLowerCase()
}

type ColorPalettePopoverContentProps = {
  title: string
  currentColor: string
  swatchLabelPrefix: string
  inputId: string
  onChange: (nextColor: string) => void
}

const ColorPalettePopoverContent = ({
  title,
  currentColor,
  swatchLabelPrefix,
  inputId,
  onChange,
}: ColorPalettePopoverContentProps) => {
  const { language } = useI18n()
  const normalizedCurrent = normalizeHexColor(currentColor) ?? '#ef4444'
  const [draftHex, setDraftHex] = useState(normalizedCurrent.toUpperCase())

  useEffect(() => {
    setDraftHex(normalizedCurrent.toUpperCase())
  }, [normalizedCurrent])

  return (
    <div className="calendar-color-popover">
      <div className="calendar-color-popover__title">{title}</div>
      <div className="calendar-color-grid" role="listbox" aria-label={`${title} presets`}>
        {CALENDAR_PRESET_COLORS.map((presetColor) => {
          const normalizedPreset = normalizeHexColor(presetColor) ?? presetColor
          const isSelected = normalizedCurrent === normalizedPreset
          return (
            <button
              key={`${swatchLabelPrefix}-${presetColor}`}
              type="button"
              className={`calendar-color-swatch${isSelected ? ' is-selected' : ''}`}
              style={{ background: presetColor }}
              onClick={() => onChange(normalizedPreset)}
              aria-label={`Set ${swatchLabelPrefix} color to ${presetColor}`}
            >
              {isSelected ? <Check className="calendar-color-swatch__check" /> : null}
            </button>
          )
        })}
      </div>
      <Label htmlFor={inputId} className="calendar-color-popover__label">{language === 'zh' ? '自定义' : 'Custom'}</Label>
      <div className="calendar-color-popover__spectrum" aria-hidden />
      <Input
        id={inputId}
        value={draftHex}
        onChange={(event) => {
          const next = event.currentTarget.value
          setDraftHex(next)
          const normalized = normalizeHexColor(next)
          if (normalized) onChange(normalized)
        }}
        onBlur={() => setDraftHex(normalizedCurrent.toUpperCase())}
        className="calendar-color-popover__hex-input"
        aria-label={`${swatchLabelPrefix} custom color hex`}
      />
    </div>
  )
}

const formatReminderLabel = (value: number | undefined, language: 'en' | 'zh') => {
  if (typeof value !== 'number') return language === 'zh' ? '无提醒' : 'No reminder'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type TaskCardDraft = {
  title: string
  startDate: string
  endDate: string
  reminderDate: string
  reminderTime: string
  priority: TaskItem['priority']
}

const readStoredTaskColors = () => {
  if (typeof window === 'undefined') return {} as Record<string, string>
  try {
    const raw = window.localStorage.getItem(STORAGE_TASK_COLORS_KEY)
    if (!raw) return {} as Record<string, string>
    const parsed = JSON.parse(raw) as Record<string, string>
    if (!parsed || typeof parsed !== 'object') return {} as Record<string, string>
    return parsed
  } catch {
    return {} as Record<string, string>
  }
}

const getReminderDateParts = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return { reminderDate: '', reminderTime: '' }
  const date = new Date(value)
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  return { reminderDate: `${y}-${m}-${d}`, reminderTime: `${hh}:${mm}` }
}

const combineReminderDateTime = (dateKey: string, time: string) => {
  const date = dateKey.trim()
  const timeText = time.trim()
  if (!date || !timeText) return undefined
  const ts = new Date(`${date}T${timeText}`).getTime()
  return Number.isFinite(ts) ? ts : undefined
}

const buildTaskCardDraft = (task: TaskItem): TaskCardDraft => ({
  title: task.title,
  startDate: task.startDate ?? '',
  endDate: task.endDate ?? '',
  ...getReminderDateParts(task.reminderAt),
  priority: task.priority,
})

const getProviderLabel = (provider: CalendarProvider, language: 'en' | 'zh') => {
  if (provider === 'builtin') return language === 'zh' ? '内置' : 'Built-in'
  if (provider === 'ics') return 'ICS/webcal'
  if (provider === 'google') return 'Google'
  if (provider === 'apple') return 'Apple'
  return 'Outlook'
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
  language: 'en' | 'zh'
  syncState?: SubscriptionSyncState
  onToggleSubscription: (subscriptionId: string) => void
  onUpdateColor: (subscriptionId: string, color: string) => void
  onRemoveSubscription: (subscriptionId: string) => void
  onMoveByStep: (subscriptionId: string, step: -1 | 1) => void
}

const SortableSubscriptionItem = ({
  sub,
  language,
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
        <PopoverContent className="calendar-color-popover-shell" align="end">
          <ColorPalettePopoverContent
            title="Color"
            currentColor={sub.color}
            swatchLabelPrefix={sub.name}
            inputId={`color-${sub.id}`}
            onChange={(nextColor) => onUpdateColor(sub.id, nextColor)}
          />
        </PopoverContent>
      </Popover>
      <div className="calendar-subscriptions__content">
        <span className="calendar-subscriptions__name">{sub.name}</span>
        <div className="calendar-subscriptions__meta">
          {sub.provider === 'google' ? (
            <Badge variant="outline" className="calendar-provider-badge">
              {getProviderLabel(sub.provider, language)}
            </Badge>
          ) : null}
          {syncState?.status === 'loading' ? <Badge variant="outline">Syncing</Badge> : null}
          {syncState?.status === 'error' ? (
            <Badge variant="destructive" title={syncState.message} className="calendar-sync-error">
              !
            </Badge>
          ) : null}
        </div>
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
  const { language, t } = useI18n()
  const weekLabels = [t('calendar.weekday.su'), t('calendar.weekday.mo'), t('calendar.weekday.tu'), t('calendar.weekday.we'), t('calendar.weekday.th'), t('calendar.weekday.fr'), t('calendar.weekday.sa')]
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [monthMotionDirection, setMonthMotionDirection] = useState<'forward' | 'back' | null>(null)
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>(readStoredSubscriptions)
  const [icsEventsBySubscription, setIcsEventsBySubscription] = useState<Record<string, CalendarEvent[]>>(readStoredIcsEvents)
  const [taskColorsById, setTaskColorsById] = useState<Record<string, string>>(readStoredTaskColors)
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
  const syncedSubscriptionSignatureRef = useRef<Record<string, string>>({})
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
      const message = error instanceof Error ? error.message : '同步该日历源失败'
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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_TASK_COLORS_KEY, JSON.stringify(taskColorsById))
  }, [taskColorsById])

  useEffect(() => {
    const nextSignatureById: Record<string, string> = {}
    subscriptions.forEach((subscription) => {
      const signature = subscription.enabled && subscription.url ? subscription.url : ''
      nextSignatureById[subscription.id] = signature
      if (!signature) return
      if (syncedSubscriptionSignatureRef.current[subscription.id] === signature) return
      syncedSubscriptionSignatureRef.current[subscription.id] = signature
      void syncSubscription(subscription)
    })
    Object.keys(syncedSubscriptionSignatureRef.current).forEach((subscriptionId) => {
      if (Object.prototype.hasOwnProperty.call(nextSignatureById, subscriptionId)) return
      delete syncedSubscriptionSignatureRef.current[subscriptionId]
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
  const sortedEventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    eventsByDate.forEach((items, dateKey) => {
      grouped.set(
        dateKey,
        items.slice().sort((a, b) => calendarEventKindRank[a.kind] - calendarEventKindRank[b.kind])
      )
    })
    return grouped
  }, [eventsByDate])

  const unifiedSubscriptions = useMemo(
    () => sortSubscriptions(removeAllSystemSubscriptions(subscriptions)),
    [subscriptions]
  )

  const pendingDeleteSubscription = useMemo(
    () => unifiedSubscriptions.find((subscription) => subscription.id === pendingDeleteSubscriptionId) ?? null,
    [unifiedSubscriptions, pendingDeleteSubscriptionId]
  )

  const selectedDayEvents = useMemo(() => sortedEventsByDate.get(selectedDateKey) ?? [], [sortedEventsByDate, selectedDateKey])
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

  const selectedDayTasks = useMemo(() => tasksByDate.get(selectedDateKey) ?? [], [tasksByDate, selectedDateKey])

  const resolveTaskChipColor = useCallback(
    (task: TaskItem) => {
      return taskColorsById[task.id] ?? '#ef4444'
    },
    [taskColorsById]
  )

  const jumpToToday = () => {
    const now = new Date()
    const nowMonthIndex = now.getFullYear() * 12 + now.getMonth()
    const anchorMonthIndex = anchorDate.getFullYear() * 12 + anchorDate.getMonth()
    if (nowMonthIndex !== anchorMonthIndex) {
      setMonthMotionDirection(nowMonthIndex > anchorMonthIndex ? 'forward' : 'back')
    }
    setAnchorDate(now)
    setSelectedDateKey(toDateKey(now))
  }

  const moveMonth = (direction: -1 | 1) => {
    setMonthMotionDirection(direction === 1 ? 'forward' : 'back')
    setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + direction, 1))
  }

  useEffect(() => {
    if (!monthMotionDirection) return
    const timeout = window.setTimeout(() => setMonthMotionDirection(null), 520)
    return () => window.clearTimeout(timeout)
  }, [monthMotionDirection])

  const handleToggleSubscription = (subscriptionId: string) => {
    setSubscriptions((prev) => {
      const current = prev.find((sub) => sub.id === subscriptionId)
      if (!current) return prev
      return toggleSubscriptionEnabled(prev, subscriptionId)
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
    delete syncedSubscriptionSignatureRef.current[targetId]
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
    setSubscriptions((prev) => {
      if (prev.some((item) => item.url === url)) return prev
      const nextOrder = sortSubscriptions(removeAllSystemSubscriptions(prev)).length
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

      return sortSubscriptions([...prev, next])
    })
    setIcsName('')
    setIcsUrl('')
    setIsAccountDialogOpen(false)
  }

  const addPresetSubscription = (preset: (typeof CALENDAR_PRESET_SUBSCRIPTIONS)[number]) => {
    setSubscriptions((prev) => {
      if (prev.some((item) => item.url === preset.url)) return prev
      const nextOrder = sortSubscriptions(removeAllSystemSubscriptions(prev)).length
      const next: CalendarSubscription = {
        id: `custom-${preset.id}`,
        name: preset.name,
        sourceType: 'custom',
        provider: 'ics',
        color: preset.color,
        enabled: true,
        syncPermission: 'read',
        order: nextOrder,
        url: preset.url,
      }

      return sortSubscriptions([...prev, next])
    })
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
      setTaskDeleteError(t('calendar.taskDeleteError'))
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
      const next = {
        ...(current ?? { title: '', startDate: '', endDate: '', reminderDate: '', reminderTime: '', priority: null }),
        ...patch,
      }
      if (!next.reminderDate) {
        next.reminderTime = ''
      }
      return { ...prev, [taskId]: next }
    })
  }

  const handleTaskCardEditorOpen = (task: TaskItem, open: boolean) => {
    if (!open) return
    setTaskCardDrafts((prev) => ({ ...prev, [task.id]: buildTaskCardDraft(task) }))
  }

  const handleSaveTaskCard = async (task: TaskItem, nextDraft?: TaskCardDraft) => {
    if (savingTaskCardIds[task.id]) return
    const draft = nextDraft ?? taskCardDrafts[task.id] ?? buildTaskCardDraft(task)
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      setTaskCardError(t('tasks.drawer.endDateError'))
      return
    }

    setTaskCardError(null)
    setSavingTaskCardIds((prev) => ({ ...prev, [task.id]: true }))
    try {
      const nextReminderAt = combineReminderDateTime(draft.reminderDate, draft.reminderTime)
      const nextTask: TaskItem = {
        ...task,
        title: draft.title.trim() || task.title,
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
      className={`calendar-v2${leftSidebarOpen ? ' is-left-open' : ''}${rightSidebarOpen ? ' is-right-open' : ''}${monthMotionDirection ? ` calendar-v2--month-${monthMotionDirection}` : ''}`}
      aria-label={t('calendar.page')}
    >
      <aside className="calendar-v2__left calendar-v2__drawer" aria-label={t('calendar.sidebar')}>
        <div className="calendar-v2__drawer-header">
          <h3>{t('calendar.subscriptions')}</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="calendar-v2__drawer-close"
            aria-label={t('calendar.closePanel')}
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

        <section className="calendar-subscriptions"             aria-label={t('calendar.subscriptions')}>
          <ScrollArea className="calendar-subscriptions__scroll">
            <div className="calendar-subscriptions__inner">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubscriptionDragEnd}>
                <SortableContext items={unifiedSubscriptions.map((sub) => sub.id)} strategy={verticalListSortingStrategy}>
                  <div className="calendar-subscriptions__list">
                    {unifiedSubscriptions.map((sub) => (
                      <SortableSubscriptionItem
                        key={sub.id}
                        sub={sub}
                        language={language}
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

          <Button variant="outline" className="calendar-subscriptions__add calendar-subscriptions__add--soft-dark" onClick={() => setIsAccountDialogOpen(true)}>
            <Plus />
            {t('calendar.addSubscription')}
          </Button>
        </section>
      </aside>

      <main className="calendar-v2__main" aria-label={t('calendar.monthlyCalendar')}>
        <header className="calendar-toolbar">
          <div className="calendar-toolbar__left">
            <Select value="month" onValueChange={() => undefined}>
              <SelectTrigger aria-label={t('calendar.viewMode')} className="calendar-toolbar__select">
                <SelectValue placeholder={t('calendar.month')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">{t('calendar.month')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={jumpToToday}>
              {t('calendar.today')}
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
              {t('calendar.subscriptions')}
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
              {t('calendar.dayPanel')}
            </Button>
          </div>
          <div className="calendar-toolbar__right">
            <Button variant="ghost" size="icon" onClick={() => moveMonth(-1)} aria-label={t('calendar.prevMonth')}>
              ‹
            </Button>
            <Button variant="ghost" size="icon" onClick={() => moveMonth(1)} aria-label={t('calendar.nextMonth')}>
              ›
            </Button>
          </div>
        </header>

        <h1 className="calendar-main-title">{formatMonthLabel(anchorDate, language)}</h1>

        <div className="calendar-month-grid" role="grid">
          {weekLabels.map((label) => (
            <div key={label} className="calendar-month-grid__weekday" role="columnheader">
              {label}
            </div>
          ))}

          {monthGridDateKeys.map((dateKey) => {
            const date = new Date(`${dateKey}T12:00:00`)
            const dayEvents = sortedEventsByDate.get(dateKey) ?? []
            const dayTasks = (tasksByDate.get(dateKey) ?? []).slice()
            const dayItems = [
              ...dayTasks.map((task) => ({
                id: `task-${task.id}`,
                title: task.title.trim() || t('calendar.untitled'),
                type: 'task' as const,
                status: task.status,
                color: resolveTaskChipColor(task),
              })),
              ...dayEvents.map((event) => ({
                id: event.id,
                title: event.title.trim() || t('calendar.untitledEvent'),
                type: 'event' as const,
                kind: event.kind,
                subscriptionId: event.subscriptionId,
              })),
            ]
            const visible = dayItems.slice(0, 4)
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
                        className="calendar-chip calendar-chip--task"
                        style={{
                          background: `color-mix(in srgb, ${item.color} 24%, var(--bg-muted))`,
                          color: `color-mix(in srgb, ${item.color} 88%, var(--text-primary))`,
                        }}
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

      <aside className="calendar-v2__right calendar-v2__drawer" aria-label={t('calendar.eventsTools')}>
        <div className="calendar-v2__drawer-header">
          <h3>{t('calendar.dayPanel')}</h3>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="calendar-v2__drawer-close"
            aria-label={t('calendar.dayPanel')}
            onClick={() => setRightSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>
        <section className="calendar-side-panel" aria-label="Selected date details">
          <h3 className="calendar-side-panel__title">{t('calendar.calendarEvent')}</h3>
          <ul key={`events-${selectedDateKey}`} className="calendar-side-panel__list calendar-side-panel__list--enter" aria-label="Calendar events list">
            {selectedDayEvents.slice(0, 6).map((event) => {
              const eventTitle = event.title.trim() || t('calendar.untitledEvent')
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

          <h3 className="calendar-side-panel__title">{t('calendar.tasks')}</h3>
          <div key={`tasks-${selectedDateKey}`} className="calendar-side-panel__list calendar-side-panel__list--animated calendar-side-panel__list--enter" aria-label={t('calendar.tasksList')}>
            <AnimatedScrollList
              items={selectedDayTasks}
              getKey={(task) => task.id}
              showGradients={false}
              displayScrollbar={false}
              itemDelay={0.1}
              listClassName="calendar-side-panel__animated-scroll"
              renderItem={(task) => {
                const taskTitle = task.title.trim() || t('calendar.untitled')
                const isDeleting = Boolean(deletingTaskIds[task.id])
                const draft = taskCardDrafts[task.id] ?? buildTaskCardDraft(task)
                const taskTags = task.tags.slice(0, 2)
                const hiddenTagCount = Math.max(0, task.tags.length - taskTags.length)
                return (
                  <article className="calendar-task-card">
                    <div className="calendar-task-card__header">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="calendar-side-row__dot calendar-task-card__color-dot"
                            aria-label={t('calendar.setTaskColor', { title: taskTitle })}
                            style={{ background: resolveTaskChipColor(task) }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="calendar-color-popover-shell" align="start">
                          <ColorPalettePopoverContent
                            title={t('calendar.taskColor')}
                            currentColor={resolveTaskChipColor(task)}
                            swatchLabelPrefix={taskTitle}
                            inputId={`task-color-${task.id}`}
                            onChange={(nextColor) =>
                              setTaskColorsById((prev) => ({
                                ...prev,
                                [task.id]: nextColor,
                              }))
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      <span className={`calendar-side-row__text${hasCjk(taskTitle) ? ' is-cjk' : ''}`}>{taskTitle}</span>
                      <div className="calendar-side-row__action">
                        <Popover
                          onOpenChange={(open) => {
                            handleTaskCardEditorOpen(task, open)
                            if (!open) {
                              void handleSaveTaskCard(task)
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="calendar-task-card__edit">
                              {t('calendar.edit')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="calendar-task-card__editor" align="end">
                            <div className="calendar-task-card__editor-grid">
                              <div className="calendar-task-card__field">
                                <span>{t('calendar.title')}</span>
                                <Input
                                  aria-label="Title"
                                  value={draft.title}
                                  onChange={(event) => {
                                    const patch = { title: event.currentTarget.value }
                                    const nextDraft = { ...draft, ...patch }
                                    updateTaskCardDraft(task.id, patch)
                                    void handleSaveTaskCard(task, nextDraft)
                                  }}
                                />
                              </div>
                              <div className="calendar-task-card__field">
                                <span>{t('calendar.dateRange')}</span>
                                <DateRangePicker
                                  value={{ startDate: draft.startDate, endDate: draft.endDate }}
                                  onChange={({ startDate, endDate }) => {
                                    const patch = { startDate: startDate ?? '', endDate: endDate ?? '' }
                                    const nextDraft = { ...draft, ...patch }
                                    updateTaskCardDraft(task.id, patch)
                                    void handleSaveTaskCard(task, nextDraft)
                                  }}
                                  className="w-full"
                                  popoverClassName="calendar-task-card__date-popover"
                                />
                              </div>
                              <div className="calendar-task-card__field">
                                <span>{t('calendar.reminder')}</span>
                                <DateTimePicker
                                  dateValue={draft.reminderDate}
                                  timeValue={draft.reminderTime}
                                  onDateChange={(date) => {
                                    const patch = { reminderDate: date ?? '', reminderTime: date ? draft.reminderTime : '' }
                                    const nextDraft = { ...draft, ...patch }
                                    updateTaskCardDraft(task.id, patch)
                                    void handleSaveTaskCard(task, nextDraft)
                                  }}
                                  onTimeChange={(time) => {
                                    const patch = { reminderTime: time ?? '' }
                                    const nextDraft = { ...draft, ...patch }
                                    updateTaskCardDraft(task.id, patch)
                                    void handleSaveTaskCard(task, nextDraft)
                                  }}
                                  placeholder="—"
                                  ariaLabel={t('calendar.reminderDate')}
                                  className="w-full"
                                  popoverClassName="calendar-task-card__date-popover"
                                />
                              </div>
                              <div className="calendar-task-card__field">
                                <span>{t('calendar.priority')}</span>
                                <Select
                                  value={draft.priority ?? '__none'}
                                  onValueChange={(value) => {
                                    const patch = { priority: value === '__none' ? null : (value as TaskItem['priority']) }
                                    const nextDraft = { ...draft, ...patch }
                                    updateTaskCardDraft(task.id, patch)
                                    void handleSaveTaskCard(task, nextDraft)
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none">{t('calendar.none')}</SelectItem>
                                    <SelectItem value="high">{t('calendar.high')}</SelectItem>
                                    <SelectItem value="medium">{t('calendar.medium')}</SelectItem>
                                    <SelectItem value="low">{t('calendar.low')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="calendar-side-row__delete"
                          aria-label={t('calendar.deleteTask')}
                          title={t('calendar.deleteTask')}
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
                    <div className="calendar-task-card__meta-lines">
                      <div className="calendar-task-card__meta-line">
                        <span className="calendar-task-card__meta-item">
                          <strong>{t('calendar.status')}</strong> {task.status}
                        </span>
                        <span className="calendar-task-card__meta-item">
                          <strong>{t('calendar.priority')}</strong> {task.priority ?? t('calendar.none')}
                        </span>
                      </div>
                      <div className="calendar-task-card__meta-line calendar-task-card__meta-line--single">
                        <span className="calendar-task-card__meta-item">
                          <strong>{t('tasks.drawer.date')}</strong> {formatTaskDateRange(task)}
                        </span>
                      </div>
                      <div className="calendar-task-card__meta-line">
                        <span className="calendar-task-card__meta-item">
                          <strong>{t('calendar.reminder')}</strong> {formatReminderLabel(task.reminderAt, language)}
                        </span>
                        <span className="calendar-task-card__meta-item">
                          <strong>{t('tasks.drawer.tags')}</strong>{' '}
                          {taskTags.length > 0
                            ? `${taskTags.join(', ')}${hiddenTagCount > 0 ? ` +${hiddenTagCount}` : ''}`
                            : t('calendar.none')}
                        </span>
                      </div>
                    </div>
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
              aria-label={t('calendar.newTaskTitle')}
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
              {t('calendar.add')}
            </Button>
          </form>
        </section>
      </aside>

      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="calendar-dialog__content">
          <DialogHeader>
            <DialogTitle>{t('calendar.addSubscriptionTitle')}</DialogTitle>
            <DialogDescription>{t('calendar.addSubscriptionDesc')}</DialogDescription>
          </DialogHeader>
          <div className="calendar-dialog">
            <div className="calendar-dialog__switch">
              <Button
                type="button"
                variant={accountMode === 'google' ? 'default' : 'outline'}
                onClick={() => setAccountMode('google')}
              >
                {t('calendar.google')}
              </Button>
              <Button
                type="button"
                variant={accountMode === 'ics' ? 'default' : 'outline'}
                onClick={() => setAccountMode('ics')}
              >
                {t('calendar.icsWebcal')}
              </Button>
            </div>

            <section className="calendar-dialog__presets" aria-label={t('calendar.presetSubscriptions')}>
              <h4>{t('calendar.presetSubscriptions')}</h4>
              <div className="calendar-dialog__presets-list">
                {CALENDAR_PRESET_SUBSCRIPTIONS.map((preset) => {
                  const exists = subscriptions.some((item) => item.url === preset.url)
                  return (
                    <article key={preset.id} className="calendar-dialog__preset-card">
                      <div className="calendar-dialog__preset-meta">
                        <p>{preset.name}</p>
                        <small>{preset.description}</small>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="calendar-dialog__preset-add"
                        disabled={exists}
                        onClick={() => addPresetSubscription(preset)}
                      >
                        {t('calendar.add')}
                      </Button>
                    </article>
                  )
                })}
              </div>
            </section>

            {accountMode === 'google' ? (
              <div className="calendar-dialog__panel">
                <p>以只读模式连接 Google 日历（M1）。</p>
                <Button type="button" onClick={addGoogleReadOnlyAccount}>
                  {t('calendar.connectGoogle')}
                </Button>
              </div>
            ) : (
              <div className="calendar-dialog__panel">
                <section className="calendar-dialog__guide" aria-label={t('calendar.icsGuide')}>
                  <p className="calendar-dialog__guide-title">{t('calendar.icsGuideTitle')}</p>
                  <ol className="calendar-dialog__guide-list">
                    <li>{t('calendar.icsGuideStep1')}</li>
                    <li>{t('calendar.icsGuideStep2')}</li>
                    <li>{t('calendar.icsGuideStep3')}</li>
                  </ol>
                  <p className="calendar-dialog__guide-note">
                    {t('calendar.icsGuideNote')}
                  </p>
                </section>
                <Label htmlFor="ics-name">{t('calendar.name')}</Label>
                <Input id="ics-name" value={icsName} onChange={(event) => setIcsName(event.currentTarget.value)} />
                <Label htmlFor="ics-url">{t('calendar.icsUrl')}</Label>
                <Input
                  id="ics-url"
                  value={icsUrl}
                  onChange={(event) => setIcsUrl(event.currentTarget.value)}
                  placeholder={t('calendar.icsPlaceholder')}
                />
                <Button type="button" onClick={() => void addIcsSubscription()}>
                  {t('calendar.addIcsSubscription')}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAccountDialogOpen(false)}>
              {t('calendar.closePanel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDeleteSubscriptionId)} onOpenChange={(open) => (open ? null : setPendingDeleteSubscriptionId(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calendar.removeSubscriptionTitle')}</DialogTitle>
            <DialogDescription>
              {pendingDeleteSubscription
                ? t('calendar.removeSubscriptionDesc', { name: pendingDeleteSubscription.name })
                : t('calendar.removeSubscriptionDescGeneric')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteSubscriptionId(null)}>
              {t('tasks.cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmRemoveSubscription}>
              {t('calendar.removeSubscription')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createDateKey)} onOpenChange={(open) => (open ? null : setCreateDateKey(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('calendar.createTaskTitle')}</DialogTitle>
            <DialogDescription>{t('tasks.drawer.date')}：{createDateKey}</DialogDescription>
          </DialogHeader>
          <div className="calendar-dialog__panel">
            <Label htmlFor="task-title">{t('calendar.title')}</Label>
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
              {t('tasks.cancel')}
            </Button>
            <Button onClick={() => void createTaskFromGridDate()} disabled={creatingGridTask || !createTitle.trim()}>
              {t('calendar.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default CalendarPage
