import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, PanelLeftOpen, PanelRightOpen, RotateCcw, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { emitTasksChanged, subscribeTasksChanged } from '../../tasks/taskSync'
import type { TaskItem } from '../../tasks/tasks.types'
import { fetchIcsEventsWithFallback, filterEventsInMonth } from '../calendar.ics'
import {
  buildInitialCalendarSubscriptions,
  buildSampleMonthEvents,
  formatMonthLabel,
  getActiveSubscriptions,
  getDeletedSubscriptions,
  getMonthGridDateKeys,
  isDateInMonth,
  restoreSubscription,
  softRemoveSubscription,
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
    return sortSubscriptions(parsed)
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

const CalendarPage = () => {
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()))
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>(readStoredSubscriptions)
  const [icsEventsBySubscription, setIcsEventsBySubscription] = useState<Record<string, CalendarEvent[]>>(readStoredIcsEvents)
  const [syncStateBySubscription, setSyncStateBySubscription] = useState<Record<string, SubscriptionSyncState>>({})
  const [userEvents, setUserEvents] = useState<CalendarEvent[]>([])
  const [allTasks, setAllTasks] = useState<TaskItem[]>([])
  const [creatingSelectedDayTask, setCreatingSelectedDayTask] = useState(false)
  const [selectedDayTaskTitle, setSelectedDayTaskTitle] = useState('')

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false)
  const [accountMode, setAccountMode] = useState<'google' | 'ics'>('google')
  const [icsName, setIcsName] = useState('')
  const [icsUrl, setIcsUrl] = useState('')
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false)
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false)
  const [showDeletedSubscriptions, setShowDeletedSubscriptions] = useState(false)
  const [pendingDeleteSubscriptionId, setPendingDeleteSubscriptionId] = useState<string | null>(null)

  const [createDateKey, setCreateDateKey] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const tasksLoadRequestRef = useRef(0)

  const monthGridDateKeys = useMemo(() => getMonthGridDateKeys(anchorDate), [anchorDate])
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

    return [...seeded, ...userEvents, ...remoteEvents].filter((event) => visibleSubscriptionIds.has(event.subscriptionId))
  }, [anchorDate, icsEventsBySubscription, userEvents, visibleSubscriptionIds])

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>()
    monthEvents.forEach((event) => grouped.set(event.dateKey, [...(grouped.get(event.dateKey) ?? []), event]))
    return grouped
  }, [monthEvents])

  const sortedSubscriptions = useMemo(() => sortSubscriptions(subscriptions), [subscriptions])
  const activeSubscriptions = useMemo(() => getActiveSubscriptions(sortedSubscriptions), [sortedSubscriptions])
  const deletedSubscriptions = useMemo(() => getDeletedSubscriptions(sortedSubscriptions), [sortedSubscriptions])

  const groupedSubscriptions = useMemo(
    () => ({
      system: activeSubscriptions.filter((sub) => sub.sourceType === 'system'),
      account: activeSubscriptions.filter((sub) => sub.sourceType === 'account'),
      custom: activeSubscriptions.filter((sub) => sub.sourceType === 'custom'),
    }),
    [activeSubscriptions]
  )

  const pendingDeleteSubscription = useMemo(
    () => subscriptions.find((subscription) => subscription.id === pendingDeleteSubscriptionId) ?? null,
    [subscriptions, pendingDeleteSubscriptionId]
  )

  const selectedDayEvents = useMemo(() => eventsByDate.get(selectedDateKey) ?? [], [eventsByDate, selectedDateKey])
  const subscriptionColorById = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription.color])),
    [subscriptions]
  )

  const tasksByDate = useMemo(() => {
    const grouped = new Map<string, TaskItem[]>()
    allTasks.forEach((task) => {
      if (!task.dueDate) return
      grouped.set(task.dueDate, [...(grouped.get(task.dueDate) ?? []), task])
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
  }, [allTasks])

  const selectedDayTasks = useMemo(
    () =>
      allTasks
        .filter((task) => task.dueDate === selectedDateKey)
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
    setSubscriptions((prev) => softRemoveSubscription(prev, targetId))
    setPendingDeleteSubscriptionId(null)
  }

  const handleRestoreSubscription = (subscriptionId: string) => {
    const previous = subscriptions.find((subscription) => subscription.id === subscriptionId)
    setSubscriptions((prev) => restoreSubscription(prev, subscriptionId))
    if (previous?.url) {
      void syncSubscription({ ...previous, enabled: true, deletedAt: null })
    }
  }

  const addIcsSubscription = async () => {
    const name = icsName.trim()
    const url = icsUrl.trim()
    if (!name || !url) return

    const next: CalendarSubscription = {
      id: `custom-${Date.now()}`,
      name,
      sourceType: 'custom',
      provider: 'ics',
      color: '#0ea5e9',
      enabled: true,
      syncPermission: 'read',
      order: 999,
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
      const next: CalendarSubscription = {
        id: `account-google-${Date.now()}`,
        name: 'Google Calendar (M1 Read-Only)',
        sourceType: 'account',
        provider: 'google',
        color: '#2563eb',
        enabled: true,
        syncPermission: 'read',
        order: 1,
      }
      setSubscriptions((prev) => sortSubscriptions([...prev, next]))
    }
    setIsAccountDialogOpen(false)
  }

  const openCreateEvent = (dateKey: string) => {
    setCreateDateKey(dateKey)
    setCreateTitle('')
  }

  const createEvent = () => {
    if (!createDateKey || !createTitle.trim()) return
    const targetSub =
      subscriptions.find((sub) => sub.enabled && sub.sourceType === 'account') ??
      subscriptions.find((sub) => sub.enabled)

    if (!targetSub) return

    const nextEvent: CalendarEvent = {
      id: `manual-${Date.now()}`,
      subscriptionId: targetSub.id,
      title: createTitle.trim(),
      dateKey: createDateKey,
      timeLabel: 'All day',
      kind: 'event',
    }

    setUserEvents((prev) => [...prev, nextEvent])
    setSelectedDateKey(createDateKey)
    setCreateDateKey(null)
    setCreateTitle('')
  }

  const handleCreateSelectedDayTask = async () => {
    const title = selectedDayTaskTitle.trim()
    if (!title || creatingSelectedDayTask) return

    setCreatingSelectedDayTask(true)
    try {
      const created = await tasksRepo.add({
        title,
        description: '',
        status: 'todo',
        priority: null,
        dueDate: selectedDateKey,
        tags: [],
        subtasks: [],
      })
      setAllTasks((prev) => [created, ...prev])
      emitTasksChanged('calendar:selected-day-create')
      setSelectedDayTaskTitle('')
    } finally {
      setCreatingSelectedDayTask(false)
    }
  }

  useEffect(() => {
    setSelectedDayTaskTitle('')
  }, [selectedDateKey])

  const renderSubscriptionItem = (sub: CalendarSubscription, options?: { showProvider?: boolean }) => {
    const syncState = syncStateBySubscription[sub.id]

    return (
      <div key={sub.id} className="calendar-subscriptions__item">
        <Checkbox
          className="calendar-checkbox"
          checked={sub.enabled}
          onCheckedChange={() => handleToggleSubscription(sub.id)}
          aria-label={`Toggle ${sub.name}`}
        />
        <span className="calendar-subscriptions__dot" style={{ background: sub.color }} />
        <span className="calendar-subscriptions__name">{sub.name}</span>
        <div className="calendar-subscriptions__actions">
          {options?.showProvider ? (
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="calendar-color-dot-trigger"
                aria-label={`Open color picker for ${sub.name}`}
              >
                <span className="calendar-color-dot-trigger__dot" style={{ background: sub.color }} />
              </Button>
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
                    onClick={() => handleUpdateSubscriptionColor(sub.id, presetColor)}
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
                onChange={(event) => handleUpdateSubscriptionColor(sub.id, event.currentTarget.value)}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="calendar-subscriptions__remove"
            aria-label={`Remove ${sub.name}`}
            onClick={() => requestRemoveSubscription(sub.id)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    )
  }

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
              return (
                <button
                  key={dateKey}
                  type="button"
                  className={`calendar-mini__cell${isCurrentMonth ? '' : ' is-dim'}${isSelected ? ' is-selected' : ''}`}
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
              <div className="calendar-subscriptions__group">
                <p>System calendars</p>
                {groupedSubscriptions.system.map((sub) => renderSubscriptionItem(sub))}
              </div>

              <div className="calendar-subscriptions__group">
                <p>Account calendars</p>
                {groupedSubscriptions.account.map((sub) => renderSubscriptionItem(sub, { showProvider: true }))}
              </div>

              <div className="calendar-subscriptions__group">
                <p>Custom subscriptions</p>
                {groupedSubscriptions.custom.map((sub) => renderSubscriptionItem(sub))}
              </div>

              <div className="calendar-subscriptions__deleted">
                <Button
                  variant="ghost"
                  size="sm"
                  className="calendar-subscriptions__deleted-trigger"
                  onClick={() => setShowDeletedSubscriptions((prev) => !prev)}
                >
                  {showDeletedSubscriptions ? <ChevronDown /> : <ChevronRight />}
                  Manage deleted
                  <Badge variant="outline">{deletedSubscriptions.length}</Badge>
                </Button>
                {showDeletedSubscriptions ? (
                  <div className="calendar-subscriptions__deleted-list">
                    {deletedSubscriptions.length ? (
                      deletedSubscriptions.map((sub) => (
                        <div key={sub.id} className="calendar-subscriptions__deleted-item">
                          <div>
                            <p>{sub.name}</p>
                            <small>{sub.sourceType}</small>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="calendar-subscriptions__restore"
                            onClick={() => handleRestoreSubscription(sub.id)}
                          >
                            <RotateCcw />
                            Restore
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="muted">No deleted calendars</p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </ScrollArea>

          <Button variant="ghost" className="calendar-subscriptions__add" onClick={() => setIsAccountDialogOpen(true)}>
            Add calendar account
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

            return (
              <button
                key={dateKey}
                type="button"
                className={`calendar-month-grid__cell${isCurrentMonth ? '' : ' is-outside'}${isSelected ? ' is-selected' : ''}`}
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
                        className={`calendar-chip calendar-chip--task calendar-chip--task-${item.status}`}
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
          <ul className="calendar-side-panel__list" aria-label="Tasks list">
            {selectedDayTasks.map((task) => {
              const taskTitle = task.title.trim() || 'Untitled'
              return (
                <li key={task.id} className="calendar-side-row">
                  <span className={`calendar-side-row__dot calendar-side-row__dot--${task.status}`} aria-hidden="true" />
                  <span className={`calendar-side-row__text${hasCjk(taskTitle) ? ' is-cjk' : ''}`}>{taskTitle}</span>
                </li>
              )
            })}
          </ul>

          <div className="calendar-side-panel__composer">
            <Input
              aria-label="New task title"
              placeholder=""
              value={selectedDayTaskTitle}
              onChange={(event) => setSelectedDayTaskTitle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleCreateSelectedDayTask()
                }
              }}
            />
            <Button
              type="button"
              className="calendar-side-panel__add"
              onClick={() => void handleCreateSelectedDayTask()}
              disabled={creatingSelectedDayTask || !selectedDayTaskTitle.trim()}
            >
              Add
            </Button>
          </div>
        </section>
      </aside>

      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add calendar account</DialogTitle>
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

            {accountMode === 'google' ? (
              <div className="calendar-dialog__panel">
                <p>Connect Google calendar in read-only mode for M1.</p>
                <Button type="button" onClick={addGoogleReadOnlyAccount}>
                  Connect Google (read-only)
                </Button>
              </div>
            ) : (
              <div className="calendar-dialog__panel">
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
                ? `Remove "${pendingDeleteSubscription.name}" from scheduling list? You can restore it later in Manage deleted.`
                : 'Remove this calendar from scheduling list? You can restore it later in Manage deleted.'}
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
            <DialogTitle>Create event</DialogTitle>
            <DialogDescription>Date: {createDateKey}</DialogDescription>
          </DialogHeader>
          <div className="calendar-dialog__panel">
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={createTitle} onChange={(event) => setCreateTitle(event.currentTarget.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDateKey(null)}>
              Cancel
            </Button>
            <Button onClick={createEvent}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

export default CalendarPage
