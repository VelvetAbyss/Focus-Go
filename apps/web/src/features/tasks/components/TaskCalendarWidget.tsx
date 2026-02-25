import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { TaskItem } from '../tasks.types'
import Dialog from '../../../shared/ui/Dialog'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { toDateKey } from '../../../shared/utils/time'
import { DatePicker } from '../../../shared/ui/DatePicker'
import { emitTasksChanged } from '../taskSync'

type CalendarEntry = {
  id: string
  taskId: string
  dateKey: string
  title: string
  status: TaskItem['status']
  priority: TaskItem['priority']
  taskCreatedAt: number
}

type TaskCalendarWidgetProps = {
  tasks: TaskItem[]
  onTaskCreated: (task: TaskItem) => void
  onTaskUpdated: (task: TaskItem) => void
  onTaskDeleted: (id: string) => void
}

const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const priorityOrder: Record<'high' | 'medium' | 'low' | 'none', number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
}

const statusDotColor: Record<TaskItem['status'], string> = {
  todo: 'var(--status-todo)',
  doing: 'var(--status-doing)',
  done: 'var(--status-done)',
}

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })

const toDateAtNoon = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part))
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0).getTime()
}

const getMonthGrid = (monthDate: Date) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const gridStart = new Date(year, month, 1 - monthStart.getDay())
  const gridEnd = new Date(year, month, monthEnd.getDate() + (6 - monthEnd.getDay()))
  const totalDays = Math.floor((gridEnd.getTime() - gridStart.getTime()) / 86_400_000) + 1
  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    return date
  })
}

const TaskCalendarWidget = ({ tasks, onTaskCreated, onTaskUpdated, onTaskDeleted }: TaskCalendarWidgetProps) => {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [createDateKey, setCreateDateKey] = useState<string | null>(null)
  const [createTitle, setCreateTitle] = useState('')
  const [createDueDate, setCreateDueDate] = useState('')
  const [activeEntry, setActiveEntry] = useState<CalendarEntry | null>(null)
  const [editDateKey, setEditDateKey] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const createTitleRef = useRef<HTMLInputElement | null>(null)
  const shouldFocusCreateTitleRef = useRef(false)

  const todayKey = toDateKey()
  const monthGrid = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth])

  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>()

    tasks.forEach((task) => {
      const createdDateKey = toDateKey(new Date(task.createdAt))
      const targetDateKey = task.dueDate ?? createdDateKey
      const entry: CalendarEntry = {
        id: `${task.id}:calendar`,
        taskId: task.id,
        dateKey: targetDateKey,
        title: task.title,
        status: task.status,
        priority: task.priority,
        taskCreatedAt: task.createdAt,
      }
      grouped.set(targetDateKey, [...(grouped.get(targetDateKey) ?? []), entry])
    })

    grouped.forEach((items, key) => {
      grouped.set(
        key,
        items.slice().sort((a, b) => {
          const pa = a.priority ? priorityOrder[a.priority] : priorityOrder.none
          const pb = b.priority ? priorityOrder[b.priority] : priorityOrder.none
          if (pa !== pb) return pa - pb
          return b.taskCreatedAt - a.taskCreatedAt
        })
      )
    })

    return grouped
  }, [tasks])

  const openCreate = (dateKey: string) => {
    shouldFocusCreateTitleRef.current = true
    setCreateDateKey(dateKey)
    setCreateDueDate(dateKey)
    setCreateTitle('')
  }

  const closeCreate = () => {
    shouldFocusCreateTitleRef.current = false
    setCreateDateKey(null)
    setCreateTitle('')
    setCreateDueDate('')
  }

  const openEdit = (entry: CalendarEntry) => {
    setActiveEntry(entry)
    setEditDateKey(entry.dateKey)
  }

  const closeEdit = () => {
    setActiveEntry(null)
    setEditDateKey('')
  }

  useEffect(() => {
    if (!createDateKey || !shouldFocusCreateTitleRef.current) return

    let retryTimer: number | null = null
    const focusAndSelectTitle = () => {
      const input = createTitleRef.current
      if (!input) return false
      input.focus()
      input.select()
      return document.activeElement === input
    }

    requestAnimationFrame(() => {
      const focused = focusAndSelectTitle()
      if (!focused) {
        retryTimer = window.setTimeout(() => {
          focusAndSelectTitle()
        }, 100)
      }
      shouldFocusCreateTitleRef.current = false
    })

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer)
    }
  }, [createDateKey])

  const submitCreate = async () => {
    const title = createTitle.trim()
    if (!title || !createDueDate) return
    setIsCreating(true)
    try {
      const created = await tasksRepo.add({
        title,
        status: 'todo',
        priority: null,
        dueDate: createDueDate,
        tags: [],
        subtasks: [],
      })
      emitTasksChanged('task-calendar-widget:create')
      onTaskCreated(created)
      closeCreate()
    } finally {
      setIsCreating(false)
    }
  }

  const applyDateChange = async (entry: CalendarEntry, nextDateKey: string) => {
    const task = tasks.find((item) => item.id === entry.taskId)
    if (!task || !nextDateKey) return
    const next = task.dueDate
      ? { ...task, dueDate: nextDateKey }
      : {
          ...task,
          createdAt: toDateAtNoon(nextDateKey),
        }
    const updated = await tasksRepo.update(next)
    emitTasksChanged('task-calendar-widget:update-date')
    onTaskUpdated(updated)
  }

  const submitEdit = async () => {
    if (!activeEntry || !editDateKey) return
    setIsMutating(true)
    try {
      await applyDateChange(activeEntry, editDateKey)
      closeEdit()
    } finally {
      setIsMutating(false)
    }
  }

  const handleDeleteFromEdit = async () => {
    if (!activeEntry) return
    setIsMutating(true)
    try {
      await tasksRepo.remove(activeEntry.taskId)
      emitTasksChanged('task-calendar-widget:delete')
      onTaskDeleted(activeEntry.taskId)
      closeEdit()
    } finally {
      setIsMutating(false)
    }
  }

  const toPreviousMonth = () =>
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  const toNextMonth = () =>
    setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  const toToday = () => {
    const now = new Date()
    setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const canSubmitCreate = Boolean(createTitle.trim() && createDueDate && !isCreating)

  return (
    <section className="task-calendar" aria-label="Task calendar widget">
      <div className="task-calendar__header">
        <h3 className="task-calendar__title">{formatMonthLabel(visibleMonth)}</h3>
        <div className="task-calendar__actions">
          <Button type="button" variant="outline" size="sm" className="task-calendar__action" onClick={toPreviousMonth}>
            Prev
          </Button>
          <Button type="button" variant="outline" size="sm" className="task-calendar__action" onClick={toToday}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" className="task-calendar__action" onClick={toNextMonth}>
            Next
          </Button>
        </div>
      </div>

      <div className="task-calendar__weekdays" role="row">
        {weekLabels.map((label) => (
          <div key={label} className="task-calendar__weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>

      <div className="task-calendar__grid">
        {monthGrid.map((date) => {
          const dateKey = toDateKey(date)
          const inMonth = date.getMonth() === visibleMonth.getMonth()
          const entries = inMonth ? (entriesByDate.get(dateKey) ?? []) : []
          const isToday = dateKey === todayKey
          return (
            <div
              key={dateKey}
              className={`task-calendar__cell ${inMonth ? '' : 'is-outside'} ${isToday ? 'is-today' : ''}`}
              onDoubleClick={inMonth ? () => openCreate(dateKey) : undefined}
              onDragOver={(event) => {
                if (!inMonth) return
                event.preventDefault()
              }}
              onDrop={(event) => {
                if (!inMonth) return
                event.preventDefault()
                const raw = event.dataTransfer.getData('application/x-task-calendar-entry')
                if (!raw) return
                try {
                  const payload = JSON.parse(raw) as {
                    taskId?: string
                    fromDateKey?: string
                  }
                  if (!payload.taskId) return
                  if (payload.fromDateKey === dateKey) return
                  void applyDateChange(
                    {
                      id: `${payload.taskId}:calendar`,
                      taskId: payload.taskId,
                      dateKey,
                      title: '',
                      status: 'todo',
                      priority: null,
                      taskCreatedAt: Date.now(),
                    },
                    dateKey
                  )
                } catch {
                  return
                }
              }}
            >
              <div className="task-calendar__date">{inMonth ? date.getDate() : ''}</div>
              <div className="task-calendar__events">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    draggable
                    className={`task-calendar__event task-calendar__event--${entry.status}`}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        'application/x-task-calendar-entry',
                        JSON.stringify({ taskId: entry.taskId, fromDateKey: entry.dateKey })
                      )
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={(event) => {
                      event.stopPropagation()
                      openEdit(entry)
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                    }}
                    title={entry.title.trim() || 'Untitled'}
                  >
                    <span
                      className="task-calendar__event-dot"
                      style={{ backgroundColor: statusDotColor[entry.status] }}
                      aria-hidden
                    />
                    <span className="task-calendar__event-title">{entry.title.trim() || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={Boolean(createDateKey)} title="Create task" onClose={closeCreate}>
        <form
          className="dialog__body task-calendar__dialog"
          onSubmit={(event) => {
            event.preventDefault()
            if (!canSubmitCreate) return
            void submitCreate()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (!canSubmitCreate) return
            void submitCreate()
          }}
        >
          <label className="task-calendar__field">
            <span>Title</span>
            <input
              ref={createTitleRef}
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              placeholder="Task title"
            />
          </label>
          <label className="task-calendar__field">
            <span>Due date</span>
            <DatePicker value={createDueDate || null} onChange={(next) => setCreateDueDate(next ?? '')} />
          </label>
          <div className="dialog__actions">
            <Button variant="outline" type="button" onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmitCreate}>
              Add
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(activeEntry)} title="Edit task date" onClose={closeEdit}>
        <div className="dialog__body task-calendar__dialog">
          <p className="task-calendar__dialog-title">{activeEntry?.title.trim() || 'Untitled'}</p>
          <p className="muted task-calendar__dialog-meta">Editing: Task date</p>
          <label className="task-calendar__field">
            <span>Date</span>
            <DatePicker value={editDateKey || null} onChange={(next) => setEditDateKey(next ?? '')} />
          </label>
          <div className="dialog__actions">
            <Button variant="outline" type="button" onClick={closeEdit}>
              Cancel
            </Button>
            <Button variant="destructive" type="button" onClick={() => void handleDeleteFromEdit()}>
              Delete
            </Button>
            <Button
              type="button"
              onClick={() => void submitEdit()}
              disabled={!editDateKey || isMutating}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}

export default TaskCalendarWidget
