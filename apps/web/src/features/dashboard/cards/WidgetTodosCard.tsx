import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import Card from '../../../shared/ui/Card'
import { Trash2 } from 'lucide-react'
import { widgetTodoRepo } from '../../../data/repositories/widgetTodoRepo'
import type { WidgetTodo, WidgetTodoScope } from '../../../data/models/types'
import { useSyncDataRefresh } from '../../../data/sync/service'
import AnimatedScrollList from '../../../shared/ui/AnimatedScrollList'
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

const DEFAULT_HABIT_COLOR = '#3a3733'
const DEFAULT_HABIT_ICON = '🎯'
const RESET_SCOPES: WidgetTodoScope[] = ['day', 'week', 'month']

type PeriodClosingAlert = {
  count: number
  level: 'soft' | 'steady' | 'close'
}

const todayInputDate = () => {
  const date = new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
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

const WidgetTodosCard = () => {
  const { t } = useI18n()
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
  const [now, setNow] = useState(() => Date.now())
  const listRefs = useRef<Record<WidgetTodoScope, HTMLDivElement | null>>({
    day: null,
    week: null,
    month: null,
    custom: null,
  })
  const today = todayDateKey()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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
  })

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

  const orderedItemsByScope = useMemo(() => {
    const toTimestamp = (todo: WidgetTodo) => {
      if (todo.dueDate) {
        const match = todo.dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
        if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
        const parsed = Date.parse(todo.dueDate)
        if (!Number.isNaN(parsed)) return parsed
      }
      return todo.createdAt
    }

    const buildList = (scope: WidgetTodoScope) => {
      const base = items.filter((item) => item.scope === scope)
      const sorted = base.slice().sort((a, b) => {
        const ta = toTimestamp(a)
        const tb = toTimestamp(b)
        if (sortAnchorTime === 0) return tb - ta
        return Math.abs(ta - sortAnchorTime) - Math.abs(tb - sortAnchorTime) || b.createdAt - a.createdAt
      })
      if (lastAdded?.scope !== scope) return sorted
      const index = sorted.findIndex((item) => item.id === lastAdded.id)
      if (index <= 0) return sorted
      const [picked] = sorted.splice(index, 1)
      sorted.unshift(picked)
      return sorted
    }

    return {
      day: buildList('day'),
      week: buildList('week'),
      month: buildList('month'),
      custom: buildList('custom'),
    }
  }, [items, lastAdded, sortAnchorTime])

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

  const completionLabel = useMemo(() => {
    const total = scopeItems.length
    if (total === 0) return t('todo.completedCount', { completed: 0, total: 0 })
    const done = scopeItems.reduce((acc, item) => acc + (item.done ? 1 : 0), 0)
    return t('todo.completedCount', { completed: done, total })
  }, [scopeItems, t])

  const periodAlertsByScope = useMemo(() => {
    const current = new Date(now)
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
  }, [items, now])

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

  const handleDelete = async (todo: WidgetTodo) => {
    await widgetTodoRepo.remove(todo.id)
    setItems((prev) => prev.filter((item) => item.id !== todo.id))
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

  return (
    <Card
      title={t('todo.cardTitle')}
      eyebrow="WIDGET"
      className="dashboard-widget-card dashboard-widget-card--shadow-safe dashboard-widget-card--todo"
      actions={<span className="widget-todos__completed">{completionLabel}</span>}
    >
      <div className="widget-todos-card">
        <div className="widget-todos__tabs tab-motion-group" role="tablist" aria-label={t('todo.scope')} style={tabMotionStyle}>
          {scopes.map((scope) => (
            (() => {
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
            })()
          ))}
        </div>

        <div className="widget-todos__viewport" aria-label={t('todo.lists')}>
          <div className="widget-todos__track" style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}>
            {scopes.map((scope) => {
              const rows = orderedItemsByScope[scope.key]
              return (
                <div key={scope.key} className="widget-todos__panel" role="tabpanel" aria-label={t('todo.scopeTodos', { scope: scope.label })}>
                  <AnimatedScrollList
                    items={rows}
                    getKey={(item) => item.id}
                    showGradients
                    itemDelay={0.1}
                    className="widget-todos__list-wrap"
                    listClassName="widget-todos__list"
                    setListRef={(node) => {
                      listRefs.current[scope.key] = node
                    }}
                    renderItem={(item) => (
                      <label className={`widget-todos__item ${item.done ? 'is-done' : ''}`}>
                        <AnimatedPlanCheckbox
                          checked={item.done}
                          disabled={pendingHabitId === item.linkedHabitId}
                          onChange={(event) => void handleToggle(item, event.target.checked)}
                        />
                        <div className="widget-todos__title">
                          <span className="widget-todos__title-text">{item.title}</span>
                          {item.dueDate ? <span className="widget-todos__due">{item.dueDate}</span> : null}
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
                      </label>
                    )}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {activeScope === 'custom' ? (
          <label className="widget-todos__custom-time">
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
