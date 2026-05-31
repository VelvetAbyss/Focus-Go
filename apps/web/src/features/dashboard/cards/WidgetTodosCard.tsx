import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Card from '../../../shared/ui/Card'
import { Trash2 } from 'lucide-react'
import { widgetTodoRepo } from '../../../data/repositories/widgetTodoRepo'
import type { WidgetTodo, WidgetTodoScope } from '../../../data/models/types'
import { useSyncDataRefresh } from '../../../data/sync/service'
import AnimatedPlanCheckbox from '../../../shared/ui/AnimatedPlanCheckbox'
import { triggerTabGroupSwitchAnimation, triggerTabPressAnimation } from '../../../shared/ui/tabPressAnimation'
import { useHabitTracker } from '../../habits/hooks/useHabitTracker'
import { todayDateKey } from '../../habits/model/dateKey'
import { useI18n } from '../../../shared/i18n/useI18n'
import TaskAddComposer from '../../tasks/components/TaskAddComposer'
import {
  readWidgetTodoResetBucket,
  shouldBootstrapResetWidgetTodos,
  shouldResetWidgetTodos,
  writeWidgetTodoResetBucket,
} from '../model/widgetTodoRefresh'

const DEFAULT_HABIT_COLOR = 'var(--text-primary)'
const DEFAULT_HABIT_ICON = '🎯'
const RESET_SCOPES: WidgetTodoScope[] = ['day', 'week', 'month']
const SWIPE_DELETE_THRESHOLD = 72
const SWIPE_REVEAL_WIDTH = 96
const PANEL_SWIPE_THRESHOLD = 56

type PeriodClosingAlert = {
  count: number
  level: 'soft' | 'steady' | 'close'
}

type DueInfo = {
  label: string
  tone: 'overdue' | 'today' | 'soon' | 'normal'
}

const todayInputDate = () => {
  const date = new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const startOfDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const parseDueDate = (dueDate?: string) => {
  if (!dueDate) return null
  const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0).getTime()
  const parsed = Date.parse(dueDate)
  return Number.isNaN(parsed) ? null : startOfDay(parsed)
}

const getLastWeekMondayAtEight = (date: Date) => {
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  const day = endOfMonth.getDay() || 7
  return new Date(endOfMonth.getFullYear(), endOfMonth.getMonth(), endOfMonth.getDate() - (day - 1), 8, 0, 0, 0)
}

const isPeriodClosingWindow = (scope: WidgetTodoScope, now: Date) => {
  if (scope === 'day') return now.getHours() >= 18
  if (scope === 'week') {
    const day = now.getDay()
    return day === 5 ? now.getHours() >= 8 : day === 0 || day === 6
  }
  if (scope === 'month') return now.getTime() >= getLastWeekMondayAtEight(now).getTime()
  return false
}

const getPeriodClosingLevel = (scope: WidgetTodoScope, now: Date): PeriodClosingAlert['level'] => {
  if (scope === 'day') return now.getHours() >= 21 ? 'close' : 'soft'
  if (scope === 'week') return now.getDay() === 0 ? 'close' : now.getDay() === 6 ? 'steady' : 'soft'
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysLeft = Math.max(0, endOfMonth.getDate() - now.getDate())
  return daysLeft <= 1 ? 'close' : daysLeft <= 3 ? 'steady' : 'soft'
}

const formatShortDate = (ts: number) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const useReduceMotionFlag = () => {
  const [reduce, setReduce] = useState(() => {
    if (typeof document === 'undefined') return false
    if (document.documentElement.dataset.motion === 'reduce') return true
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduce(document.documentElement.dataset.motion === 'reduce' || media.matches)
    media.addEventListener?.('change', onChange)
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] })
    return () => {
      media.removeEventListener?.('change', onChange)
      observer.disconnect()
    }
  }, [])
  return reduce
}

const WidgetTodosCard = () => {
  const { t } = useI18n()
  const reduceMotion = useReduceMotionFlag()
  const scopes = useMemo(
    () => [
      { key: 'day' as const, label: t('todo.daily') },
      { key: 'week' as const, label: t('todo.weekly') },
      { key: 'month' as const, label: t('todo.monthly') },
      { key: 'custom' as const, label: t('todo.custom') },
    ],
    [t],
  )
  const [items, setItems] = useState<WidgetTodo[]>([])
  const [loaded, setLoaded] = useState(false)
  const {
    activeHabits,
    completedDatesByHabit,
    createHabit,
    completeHabit,
    undoHabit,
  } = useHabitTracker()
  const [activeScope, setActiveScope] = useState<WidgetTodoScope>('day')
  const [pendingHabitId, setPendingHabitId] = useState<string | null>(null)
  const [lastAdded, setLastAdded] = useState<{ id: string; scope: WidgetTodoScope } | null>(null)
  const [sortAnchorTime, setSortAnchorTime] = useState(0)
  const [customDueDate, setCustomDueDate] = useState(todayInputDate)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const listRefs = useRef<Record<WidgetTodoScope, HTMLDivElement | null>>({
    day: null,
    week: null,
    month: null,
    custom: null,
  })
  const today = todayDateKey()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [panelDragX, setPanelDragX] = useState(0)
  const panelDragStartRef = useRef<{ x: number; y: number; active: boolean; captured: boolean; id: number } | null>(null)

  const loadItems = useCallback(async () => {
    const loadedItems = await widgetTodoRepo.list()
    const now = Date.now()
    const itemsById = new Map(loadedItems.map((item) => [item.id, item]))

    for (const scopeKey of RESET_SCOPES) {
      const storedBucket = readWidgetTodoResetBucket(scopeKey)
      const { shouldReset, currentBucket } = shouldResetWidgetTodos(scopeKey, storedBucket, now)
      const needsBootstrapReset = storedBucket === null && shouldBootstrapResetWidgetTodos(loadedItems, scopeKey, now)

      if (shouldReset || needsBootstrapReset) {
        const reset = await widgetTodoRepo.resetDone(scopeKey)
        for (const item of reset) itemsById.set(item.id, item)
      }

      writeWidgetTodoResetBucket(scopeKey, currentBucket)
    }

    return [...itemsById.values()]
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (cancelled) return
      const merged = await loadItems()
      if (cancelled) return
      setItems(merged)
      setSortAnchorTime(merged.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), 0))
      setLoaded(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [loadItems])

  useSyncDataRefresh(() => {
    void loadItems().then((nextItems) => {
      setItems(nextItems)
      setSortAnchorTime(nextItems.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), 0))
      setLoaded(true)
    })
  }, ['widgetTodos'])

  useEffect(() => {
    if (!loaded) return
    let cancelled = false

    const syncDailyTodos = async () => {
      const dailyItems = items.filter((item) => item.scope === 'day')
      const booleanHabits = activeHabits.filter((habit) => habit.type === 'boolean')
      const completedHabitIds = new Set(
        Object.entries(completedDatesByHabit)
          .filter(([, dates]) => dates.includes(today))
          .map(([habitId]) => habitId),
      )

      const byLinkedHabitId = new Map(
        dailyItems.filter((item) => item.linkedHabitId).map((item) => [item.linkedHabitId as string, item]),
      )
      const byTitle = new Map(
        dailyItems.filter((item) => !item.linkedHabitId).map((item) => [item.title.trim().toLowerCase(), item]),
      )

      const operations: Array<Promise<unknown>> = []

      for (const habit of booleanHabits) {
        const matched = byLinkedHabitId.get(habit.id) ?? byTitle.get(habit.title.trim().toLowerCase())
        const nextDone = completedHabitIds.has(habit.id)

        if (!matched) {
          operations.push(
            widgetTodoRepo.add({
              scope: 'day',
              title: habit.title,
              priority: 'medium',
              done: nextDone,
              linkedHabitId: habit.id,
            }),
          )
          continue
        }

        if (matched.linkedHabitId !== habit.id || matched.title !== habit.title || matched.done !== nextDone) {
          operations.push(
            widgetTodoRepo.update({
              ...matched,
              linkedHabitId: habit.id,
              title: habit.title,
              done: nextDone,
            }),
          )
        }
      }

      if (operations.length === 0) return
      await Promise.all(operations)
      const refreshed = await widgetTodoRepo.list()
      if (cancelled) return
      setItems(refreshed)
      setSortAnchorTime(refreshed.reduce((max, item) => (item.updatedAt > max ? item.updatedAt : max), 0))
    }

    void syncDailyTodos()
    return () => {
      cancelled = true
    }
  }, [activeHabits, completedDatesByHabit, items, loaded, today])

  const scopeItems = useMemo(() => items.filter((item) => item.scope === activeScope), [items, activeScope])

  const formatDue = useCallback(
    (dueDate?: string): DueInfo | null => {
      const ts = parseDueDate(dueDate)
      if (ts === null) return null
      const todayTs = startOfDay(Date.now())
      const diffDays = Math.round((ts - todayTs) / 86_400_000)
      if (diffDays < 0) {
        const d = Math.abs(diffDays)
        return { label: d === 1 ? t('todo.overdue') : t('todo.overdueDays', { days: d }), tone: 'overdue' }
      }
      if (diffDays === 0) return { label: t('todo.today'), tone: 'today' }
      if (diffDays === 1) return { label: t('todo.tomorrow'), tone: 'soon' }
      if (diffDays <= 6) return { label: t('todo.inDays', { days: diffDays }), tone: 'soon' }
      return { label: formatShortDate(ts), tone: 'normal' }
    },
    [t],
  )

  type OrderedRow =
    | { kind: 'todo'; item: WidgetTodo; due: DueInfo | null }
    | { kind: 'divider'; id: string; count: number }

  const orderedItemsByScope = useMemo(() => {
    const toTimestamp = (todo: WidgetTodo) => {
      const ts = parseDueDate(todo.dueDate)
      return ts ?? todo.createdAt
    }

    const buildList = (scope: WidgetTodoScope): OrderedRow[] => {
      const base = items.filter((item) => item.scope === scope)
      const active = base.filter((item) => !item.done)
      const done = base.filter((item) => item.done)

      active.sort((a, b) => {
        const ta = toTimestamp(a)
        const tb = toTimestamp(b)
        if (sortAnchorTime === 0) return tb - ta
        return Math.abs(ta - sortAnchorTime) - Math.abs(tb - sortAnchorTime) || b.createdAt - a.createdAt
      })
      done.sort((a, b) => b.updatedAt - a.updatedAt)

      if (lastAdded?.scope === scope) {
        const idx = active.findIndex((item) => item.id === lastAdded.id)
        if (idx > 0) {
          const [picked] = active.splice(idx, 1)
          active.unshift(picked)
        }
      }

      const rows: OrderedRow[] = active.map((item) => ({
        kind: 'todo' as const,
        item,
        due: formatDue(item.dueDate),
      }))
      if (done.length > 0) {
        rows.push({ kind: 'divider', id: `__divider_${scope}`, count: done.length })
        for (const item of done) rows.push({ kind: 'todo', item, due: formatDue(item.dueDate) })
      }
      return rows
    }

    return {
      day: buildList('day'),
      week: buildList('week'),
      month: buildList('month'),
      custom: buildList('custom'),
    } as Record<WidgetTodoScope, OrderedRow[]>
  }, [items, lastAdded, sortAnchorTime, formatDue])

  const activeIndex = useMemo(() => {
    const next = scopes.findIndex((scope) => scope.key === activeScope)
    return next < 0 ? 0 : next
  }, [activeScope, scopes])
  const tabMotionStyle = useMemo(
    () =>
      ({
        '--tab-count': `${scopes.length}`,
        '--tab-active-index': `${activeIndex}`,
      }) as CSSProperties,
    [activeIndex, scopes.length],
  )

  const completionStats = useMemo(() => {
    const total = scopeItems.length
    const done = total === 0 ? 0 : scopeItems.reduce((acc, item) => acc + (item.done ? 1 : 0), 0)
    return { done, total }
  }, [scopeItems])

  const completionLabel = useMemo(
    () => t('todo.completedCount', { completed: completionStats.done, total: completionStats.total }),
    [completionStats.done, completionStats.total, t],
  )

  const completionRatio = useMemo(() => {
    if (completionStats.total === 0) return 0
    return completionStats.done / completionStats.total
  }, [completionStats.done, completionStats.total])

  const formatTwoDigit = (value: number) => (value < 10 ? `0${value}` : `${value}`)

  const periodAlertsByScope = useMemo(() => {
    const current = new Date(Date.now())
    const alerts: Record<WidgetTodoScope, PeriodClosingAlert | null> = {
      day: null,
      week: null,
      month: null,
      custom: null,
    }

    RESET_SCOPES.forEach((scope) => {
      const unfinished = items.filter((item) => item.scope === scope && !item.done).length
      if (unfinished === 0 || !isPeriodClosingWindow(scope, current)) return
      alerts[scope] = {
        count: unfinished,
        level: getPeriodClosingLevel(scope, current),
      }
    })

    return alerts
  }, [items])

  const handleToggle = async (todo: WidgetTodo, done: boolean) => {
    if (todo.scope === 'day' && todo.linkedHabitId) {
      const habit = activeHabits.find((item) => item.id === todo.linkedHabitId)
      if (habit && !pendingHabitId) {
        setPendingHabitId(habit.id)
        try {
          if (done) await completeHabit(habit)
          else await undoHabit(habit.id)
        } finally {
          setPendingHabitId(null)
        }
      }
    }

    const updated = await widgetTodoRepo.update({ ...todo, done })
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSortAnchorTime(updated.updatedAt)
  }

  const handleDelete = useCallback(async (todo: WidgetTodo) => {
    setRemovingId(todo.id)
    const animationMs = reduceMotion ? 0 : 240
    if (animationMs > 0) await new Promise((resolve) => window.setTimeout(resolve, animationMs))
    await widgetTodoRepo.remove(todo.id)
    setItems((prev) => prev.filter((item) => item.id !== todo.id))
    setRemovingId((current) => (current === todo.id ? null : current))
  }, [reduceMotion])

  const startRename = (todo: WidgetTodo) => {
    setEditingId(todo.id)
    setDraftTitle(todo.title)
  }

  const cancelRename = () => {
    setEditingId(null)
    setDraftTitle('')
  }

  const commitRename = async (todo: WidgetTodo) => {
    const next = draftTitle.trim()
    if (!next || next === todo.title) {
      cancelRename()
      return
    }
    const updated = await widgetTodoRepo.update({ ...todo, title: next })
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    setSortAnchorTime(updated.updatedAt)
    cancelRename()
  }

  const handleAdd = async (title: string) => {
    const linkedHabit =
      activeScope === 'day'
        ? await createHabit({
            title,
            description: '',
            icon: DEFAULT_HABIT_ICON,
            type: 'boolean',
            color: DEFAULT_HABIT_COLOR,
            freezesAllowed: 0,
          })
        : null

    const added = await widgetTodoRepo.add({
      scope: activeScope,
      title,
      priority: 'medium',
      done: false,
      dueDate: activeScope === 'custom' ? customDueDate || todayInputDate() : undefined,
      linkedHabitId: activeScope === 'day' ? linkedHabit?.id : undefined,
    })

    setItems((prev) => [added, ...prev])
    setLastAdded({ id: added.id, scope: added.scope })
    setSortAnchorTime(added.updatedAt)
    requestAnimationFrame(() => {
      const listEl = listRefs.current[activeScope]
      if (listEl) listEl.scrollTo({ top: 0, behavior: 'auto' })
    })
    return true
  }

  const handlePanelPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('.widget-todos__item, input, textarea, button, [data-no-pan]')) return
    panelDragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      active: false,
      captured: false,
      id: event.pointerId,
    }
  }

  const handlePanelPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = panelDragStartRef.current
    if (!origin || origin.id !== event.pointerId) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (!origin.active) {
      if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        origin.active = true
        if (!origin.captured) {
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
            origin.captured = true
          } catch {
            // ignore
          }
        }
      } else {
        return
      }
    }
    const atStart = activeIndex === 0
    const atEnd = activeIndex === scopes.length - 1
    let clamped = dx
    if ((atStart && dx > 0) || (atEnd && dx < 0)) clamped = dx * 0.28
    clamped = Math.max(-180, Math.min(180, clamped))
    setPanelDragX(clamped)
  }

  const releasePanelPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = panelDragStartRef.current
    if (!origin || origin.id !== event.pointerId) return
    panelDragStartRef.current = null
    if (origin.captured) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }
    }
    if (!origin.active) {
      setPanelDragX(0)
      return
    }
    const dx = event.clientX - origin.x
    if (dx <= -PANEL_SWIPE_THRESHOLD && activeIndex < scopes.length - 1) {
      setActiveScope(scopes[activeIndex + 1].key)
    } else if (dx >= PANEL_SWIPE_THRESHOLD && activeIndex > 0) {
      setActiveScope(scopes[activeIndex - 1].key)
    }
    setPanelDragX(0)
  }

  const renderEmpty = (scope: WidgetTodoScope) => {
    const titleKey = `todo.empty.${scope}.title` as const
    const hintKey = `todo.empty.${scope}.hint` as const
    return (
      <div className="widget-todos__empty" role="status">
        <span className="widget-todos__empty-mark" aria-hidden>
          <svg viewBox="0 0 48 48" width="48" height="48">
            <defs>
              <linearGradient id={`empty-ink-${scope}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#114f48" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#c58a1b" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="16" fill="none" stroke={`url(#empty-ink-${scope})`} strokeWidth="1.6" strokeDasharray="2 4" />
            <path d="M15 26 L21 32 L33 18" fill="none" stroke="#114f48" strokeOpacity="0.38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="widget-todos__empty-title">{t(titleKey)}</p>
        <p className="widget-todos__empty-hint">{t(hintKey)}</p>
      </div>
    )
  }

  type TodoRowProps = {
    row: Extract<OrderedRow, { kind: 'todo' }>
    isLastActive: boolean
  }

  const TodoRow = ({ row, isLastActive }: TodoRowProps) => {
    const { item, due } = row
    const isEditing = editingId === item.id
    const isRemoving = removingId === item.id
    const [dragX, setDragX] = useState(0)
    const dragState = useRef<{ x: number; y: number; active: boolean; id: number; captured: boolean } | null>(null)

    const settleDrag = () => {
      const start = dragState.current
      dragState.current = null
      setDragX(0)
      return start
    }

    const onPointerDown = (event: ReactPointerEvent<HTMLLabelElement>) => {
      if (isEditing) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      const target = event.target as HTMLElement
      if (target.closest('button, input, .widget-plan-checkbox-wrap')) return
      dragState.current = { x: event.clientX, y: event.clientY, active: false, id: event.pointerId, captured: false }
    }

    const onPointerMove = (event: ReactPointerEvent<HTMLLabelElement>) => {
      const start = dragState.current
      if (!start || start.id !== event.pointerId) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!start.active) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          start.active = true
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
            start.captured = true
          } catch {
            // ignore
          }
        } else if (Math.abs(dy) > 10) {
          dragState.current = null
          return
        } else {
          return
        }
      }
      const clamped = Math.max(-SWIPE_REVEAL_WIDTH - 24, Math.min(16, dx))
      setDragX(clamped)
    }

    const onPointerUp = (event: ReactPointerEvent<HTMLLabelElement>) => {
      const start = dragState.current
      if (!start || start.id !== event.pointerId) {
        settleDrag()
        return
      }
      if (start.captured) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
          // ignore
        }
      }
      if (start.active && event.clientX - start.x <= -SWIPE_DELETE_THRESHOLD) {
        settleDrag()
        void handleDelete(item)
        return
      }
      settleDrag()
    }

    const onPointerCancel = () => {
      settleDrag()
    }

    const handleLabelClick = (event: React.MouseEvent<HTMLLabelElement>) => {
      if (isEditing) event.preventDefault()
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void commitRename(item)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelRename()
      }
    }

    const swipeProgress = Math.max(0, Math.min(1, Math.abs(Math.min(0, dragX)) / SWIPE_DELETE_THRESHOLD))

    const targetX = isRemoving ? -480 : dragX
    const targetOpacity = isRemoving ? 0 : 1
    const targetScale = isRemoving ? 0.96 : 1

    return (
      <motion.div
        layout="position"
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.985 }}
        animate={reduceMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }
        }
        className={`widget-todos__row ${item.done ? 'is-done' : ''} ${isLastActive ? 'is-last-active' : ''}`}
        style={{ ['--swipe-progress' as string]: `${swipeProgress}` }}
      >
        <button
          type="button"
          className="widget-todos__swipe-delete"
          aria-label={t('todo.deleteTask')}
          title={t('todo.deleteTask')}
          tabIndex={-1}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void handleDelete(item)
          }}
        >
          <Trash2 size={18} />
        </button>
        <motion.label
          className={`widget-todos__item ${item.done ? 'is-done' : ''} ${isEditing ? 'is-editing' : ''} ${dragX < -4 ? 'is-swiping' : ''} ${isRemoving ? 'is-removing' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onDoubleClick={(event) => {
            event.preventDefault()
            if (!isEditing) startRename(item)
          }}
          onClick={handleLabelClick}
          animate={reduceMotion ? { x: 0, opacity: 1, scale: 1 } : { x: targetX, opacity: targetOpacity, scale: targetScale }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : dragX === 0 && !isRemoving
                ? { type: 'spring', stiffness: 520, damping: 42 }
                : { duration: 0.18, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <AnimatedPlanCheckbox
            checked={item.done}
            disabled={pendingHabitId === item.linkedHabitId || isEditing}
            onChange={(event) => void handleToggle(item, event.target.checked)}
          />
          <div className="widget-todos__title">
            {isEditing ? (
              <input
                className="widget-todos__rename-input"
                autoFocus
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => void commitRename(item)}
                onKeyDown={handleKeyDown}
                aria-label={t('todo.renameHint')}
                data-no-pan
              />
            ) : (
              <>
                <span className="widget-todos__title-text" title={item.title}>
                  {item.title}
                </span>
                {due ? (
                  <span className={`widget-todos__due widget-todos__due--${due.tone}`}>
                    <span className="widget-todos__due-dot" aria-hidden />
                    {due.label}
                  </span>
                ) : null}
              </>
            )}
          </div>
          <button
            type="button"
            className="widget-todos__delete"
            aria-label={t('todo.deleteTask')}
            title={t('todo.deleteTask')}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void handleDelete(item)
            }}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
          >
            <Trash2 size={16} />
          </button>
        </motion.label>
      </motion.div>
    )
  }

  const renderScope = (scope: WidgetTodoScope) => {
    const rows = orderedItemsByScope[scope]
    const lastActiveIndex = (() => {
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        if (rows[i].kind === 'todo' && !(rows[i] as Extract<OrderedRow, { kind: 'todo' }>).item.done) return i
      }
      return -1
    })()

    if (rows.length === 0) {
      return (
        <div className="widget-todos__list-wrap">
          <div className="widget-todos__list widget-todos__list--empty">
            {renderEmpty(scope)}
          </div>
        </div>
      )
    }

    return (
      <div className="widget-todos__list-wrap">
        <div
          className="widget-todos__list"
          ref={(node) => {
            listRefs.current[scope] = node
          }}
        >
          <AnimatePresence initial={false}>
            {rows.map((row, index) =>
              row.kind === 'divider' ? (
                <motion.div
                  key={row.id}
                  className="widget-todos__section"
                  layout="position"
                  initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
                >
                  <span className="widget-todos__section-line" aria-hidden />
                  <span className="widget-todos__section-label">
                    {t('todo.doneSection')} <span className="widget-todos__section-count">{row.count}</span>
                  </span>
                  <span className="widget-todos__section-line" aria-hidden />
                </motion.div>
              ) : (
                <TodoRow key={row.item.id} row={row} isLastActive={index === lastActiveIndex} />
              ),
            )}
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <Card
      title={t('todo.cardTitle')}
      eyebrow="WIDGET"
      className="dashboard-widget-card dashboard-widget-card--shadow-safe dashboard-widget-card--todo"
      actions={
        <span
          className="widget-todos__completed"
          aria-label={completionLabel}
          title={completionLabel}
        >
          <span className="widget-todos__completed-stat" aria-hidden>
            <span className="widget-todos__completed-done">{formatTwoDigit(completionStats.done)}</span>
            <span className="widget-todos__completed-sep">/</span>
            <span className="widget-todos__completed-total">{formatTwoDigit(completionStats.total)}</span>
          </span>
          <span
            className="widget-todos__completed-bar"
            aria-hidden
            style={{ ['--completion' as string]: `${Math.round(completionRatio * 100)}` }}
          >
            <i />
          </span>
        </span>
      }
    >
      <div className="widget-todos-card">
        <div className="widget-todos__tabs tab-motion-group" role="tablist" aria-label={t('todo.scope')} style={tabMotionStyle}>
          <span className="widget-todos__tab-indicator" aria-hidden />
          {scopes.map((scope) => {
            const alert = periodAlertsByScope[scope.key]
            return (
              <button
                key={scope.key}
                type="button"
                role="tab"
                aria-selected={activeScope === scope.key}
                className={`widget-todos__tab tab-motion-tab ${activeScope === scope.key ? 'is-active' : ''} ${alert ? `period-alert period-alert--${alert.level}` : ''}`}
                title={alert ? t('todo.periodClosingAlert', { count: alert.count }) : undefined}
                onClick={(event) => {
                  triggerTabPressAnimation(event.currentTarget)
                  triggerTabGroupSwitchAnimation(event.currentTarget)
                  setActiveScope(scope.key)
                }}
              >
                <span>{scope.label}</span>
                {alert ? (
                  <span className="period-alert__badge" aria-label={t('todo.periodClosingAlert', { count: alert.count })}>
                    <span className="period-alert__pulse" aria-hidden />
                    <span>{alert.count}</span>
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div
          className="widget-todos__viewport"
          aria-label={t('todo.lists')}
          onPointerDown={handlePanelPointerDown}
          onPointerMove={handlePanelPointerMove}
          onPointerUp={releasePanelPointer}
          onPointerCancel={releasePanelPointer}
        >
          <div
            ref={trackRef}
            className={`widget-todos__track ${panelDragX !== 0 ? 'is-dragging' : ''}`}
            style={{ transform: `translate3d(calc(-${activeIndex * 100}% + ${panelDragX}px), 0, 0)` }}
          >
            {scopes.map((scope) => (
              <div
                key={scope.key}
                className="widget-todos__panel"
                role="tabpanel"
                aria-label={t('todo.scopeTodos', { scope: scope.label })}
                aria-hidden={scope.key !== activeScope}
              >
                {renderScope(scope.key)}
              </div>
            ))}
          </div>
        </div>

        {activeScope === 'custom' ? (
          <label className="widget-todos__custom-time" data-no-pan>
            <span>{t('todo.customDate')}</span>
            <input type="date" value={customDueDate} onChange={(event) => setCustomDueDate(event.target.value)} />
          </label>
        ) : null}

        <TaskAddComposer onSubmit={handleAdd} plain placeholder={activeScope === 'day' ? t('todo.addHabit') : t('todo.addTask')} />
      </div>
    </Card>
  )
}

export default WidgetTodosCard
