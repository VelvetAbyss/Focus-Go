import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import Dialog from '../../../shared/ui/Dialog'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { toDateKey } from '../../../shared/utils/time'
import { DatePicker } from '../../../shared/ui/DatePicker'
import { emitTasksChanged } from '../taskSync'
import { getTaskDisplayRange } from '../taskDates'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, getTaskPriorityKey } from './taskPresentation'

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
  compact?: boolean
  plain?: boolean
}

const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const priorityOrder: Record<'high' | 'medium' | 'low' | 'none', number> = { high: 0, medium: 1, low: 2, none: 3 }

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  })

const toDateAtNoon = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part))
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0).getTime()
}

const expandDateRange = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as string[]
  const keys: string[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

const moveDateKey = (dateKey: string, offsetDays: number) => {
  const [y, m, d] = dateKey.split('-').map((part) => Number(part))
  const date = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  return toDateKey(date)
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

const TaskCalendarWidget = ({ tasks, onTaskCreated, onTaskUpdated, onTaskDeleted, compact = false, plain = false }: TaskCalendarWidgetProps) => {
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
      const range = getTaskDisplayRange(task)
      const targetDateKeys = range ? expandDateRange(range.startDate, range.endDate) : [toDateKey(new Date(task.createdAt))]
      targetDateKeys.forEach((targetDateKey) => {
        grouped.set(targetDateKey, [
          ...(grouped.get(targetDateKey) ?? []),
          {
            id: `${task.id}:${targetDateKey}:calendar`,
            taskId: task.id,
            dateKey: targetDateKey,
            title: task.title,
            status: task.status,
            priority: task.priority,
            taskCreatedAt: task.createdAt,
          },
        ])
      })
    })

    grouped.forEach((items, key) => {
      grouped.set(
        key,
        items.slice().sort((a, b) => {
          const pa = a.priority ? priorityOrder[a.priority] : priorityOrder.none
          const pb = b.priority ? priorityOrder[b.priority] : priorityOrder.none
          if (pa !== pb) return pa - pb
          return b.taskCreatedAt - a.taskCreatedAt
        }),
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
    requestAnimationFrame(() => {
      const input = createTitleRef.current
      if (!input) return
      input.focus()
      input.select()
      shouldFocusCreateTitleRef.current = false
    })
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
    const range = getTaskDisplayRange(task)
    const next = range
      ? (() => {
          const durationDays = Math.max(
            0,
            Math.round((new Date(`${range.endDate}T12:00:00`).getTime() - new Date(`${range.startDate}T12:00:00`).getTime()) / 86_400_000),
          )
          return { ...task, startDate: nextDateKey, endDate: moveDateKey(nextDateKey, durationDays), dueDate: durationDays === 0 ? nextDateKey : undefined }
        })()
      : task.dueDate
        ? { ...task, dueDate: nextDateKey }
        : { ...task, createdAt: toDateAtNoon(nextDateKey) }
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

  return (
    <section className={cn('mt-4 flex min-h-0 flex-1 flex-col rounded-[24px] border border-[#3a3733]/6 bg-white/88 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.06)]', compact && 'rounded-[20px] p-3', plain && 'mt-0 rounded-none border-0 bg-transparent p-0 shadow-none')}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar</p>
          <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-slate-950">{formatMonthLabel(visibleMonth)}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold" onClick={() => {
            const now = new Date()
            setVisibleMonth(new Date(now.getFullYear(), now.getMonth(), 1))
          }}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekLabels.map((label) => (
          <div key={label} className="px-1 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 gap-2">
        {monthGrid.map((date) => {
          const dateKey = toDateKey(date)
          const inMonth = date.getMonth() === visibleMonth.getMonth()
          const entries = inMonth ? entriesByDate.get(dateKey) ?? [] : []
          const isToday = dateKey === todayKey
          return (
            <div
              key={dateKey}
              className={cn('min-h-[120px] rounded-[18px] border border-[#3a3733]/6 bg-slate-50/70 p-2.5 transition hover:border-slate-300 hover:bg-white', !inMonth && 'bg-slate-100/60 opacity-60', isToday && 'border-sky-200 bg-sky-50/60')}
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
                  const payload = JSON.parse(raw) as { taskId?: string; fromDateKey?: string }
                  if (!payload.taskId || payload.fromDateKey === dateKey) return
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
                    dateKey,
                  )
                } catch {
                  return
                }
              }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold', isToday ? 'bg-sky-600 text-white' : 'text-slate-700')}>
                  {inMonth ? date.getDate() : ''}
                </span>
                {inMonth ? (
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      openCreate(dateKey)
                    }}
                    aria-label="Create task"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {entries.slice(0, compact ? 2 : 3).map((entry) => {
                  const status = TASK_STATUS_CONFIG[entry.status]
                  const priority = TASK_PRIORITY_CONFIG[getTaskPriorityKey(entry.priority)]
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      draggable
                      className={cn('w-full rounded-[14px] border px-2 py-1.5 text-left text-[10px] font-medium transition hover:shadow-sm', status.badge)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/x-task-calendar-entry', JSON.stringify({ taskId: entry.taskId, fromDateKey: entry.dateKey }))
                        event.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        openEdit(entry)
                      }}
                      title={entry.title.trim() || 'Untitled'}
                    >
                      <span className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', priority.dot)} />
                        <span className="truncate">{entry.title.trim() || 'Untitled'}</span>
                      </span>
                    </button>
                  )
                })}
                {entries.length > (compact ? 2 : 3) ? <p className="px-1 text-[10px] font-medium text-slate-500">+{entries.length - (compact ? 2 : 3)} more</p> : null}
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={Boolean(createDateKey)} title="Create task" onClose={closeCreate}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submitCreate()
          }}
        >
          <div className="grid gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Title</label>
            <input ref={createTitleRef} value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Task title" className="h-11 rounded-[14px] border border-[#3a3733]/8 bg-slate-50/80 px-3 text-[13px]" />
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Due date</label>
            <DatePicker value={createDueDate || null} onChange={(next) => setCreateDueDate(next ?? '')} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={closeCreate}>
              Cancel
            </Button>
            <Button type="submit" disabled={!createTitle.trim() || !createDueDate || isCreating}>
              Add
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(activeEntry)} title="Edit task date" onClose={closeEdit}>
        <div className="space-y-4">
          <div>
            <p className="text-[15px] font-semibold text-slate-950">{activeEntry?.title.trim() || 'Untitled'}</p>
            <p className="mt-1 text-[12px] text-slate-500">Move this task to another day or delete it from the workspace.</p>
          </div>
          <div className="grid gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date</label>
            <DatePicker value={editDateKey || null} onChange={(next) => setEditDateKey(next ?? '')} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="destructive" type="button" onClick={() => void handleDeleteFromEdit()} disabled={isMutating}>
              Delete
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" type="button" onClick={closeEdit}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submitEdit()} disabled={!editDateKey || isMutating}>
                Save
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </section>
  )
}

export default TaskCalendarWidget
