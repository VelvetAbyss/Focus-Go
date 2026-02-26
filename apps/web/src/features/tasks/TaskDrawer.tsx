import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, Plus, X } from 'lucide-react'
import Dialog from '../../shared/ui/Dialog'
import Select from '../../shared/ui/Select'
import { DatePicker } from '../../shared/ui/DatePicker'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { createId } from '../../shared/utils/ids'
import { useToast } from '../../shared/ui/toast/toast'
import type { TaskItem, TaskPriority } from './tasks.types'
import { useAddInputComposer } from '../../shared/hooks/useAddInputComposer'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import { emitTasksChanged } from './taskSync'

type TaskDrawerProps = {
  open: boolean
  task: TaskItem | null
  onClose: () => void
  onUpdated: (task: TaskItem) => void
  onDeleted: (id: string) => void
  onRequestDelete?: (task: TaskItem) => void
}

const priorityOptions: TaskPriority[] = ['high', 'medium', 'low']
const defaultTagOptions = ['work', 'life', 'health', 'study', 'finance', 'family']

const priorityLabel = (priority: TaskPriority) => priority.charAt(0).toUpperCase() + priority.slice(1)
const priorityTextColors: Record<TaskPriority | 'none', string> = {
  high: '#b91c1c',
  medium: '#b45309',
  low: '#1d4ed8',
  none: '#6b7280',
}

const equalStringArrays = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

const equalSubtasks = (a: TaskItem['subtasks'], b: TaskItem['subtasks']) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]
    const right = b[i]
    if (!left || !right) return false
    if (left.id !== right.id) return false
    if (left.title !== right.title) return false
    if (left.done !== right.done) return false
  }
  return true
}

const formatDateTime = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

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
  const timestamp = new Date(trimmed).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const TaskDrawer = ({ open, task, onClose, onUpdated, onDeleted, onRequestDelete }: TaskDrawerProps) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reminderAtInput, setReminderAtInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>(defaultTagOptions)
  const [tagDraft, setTagDraft] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<TaskItem['subtasks']>([])
  const [lastId, setLastId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()
  const taskSnapshotRef = useRef<TaskItem | null>(null)
  useEffect(() => {
    if (!task) return
    taskSnapshotRef.current = task
  }, [task])
  const currentTask = task ?? taskSnapshotRef.current

  const baselineRef = useRef<{
    title: string
    description: string
    priority: TaskPriority | null
    dueDate: string
    startDate: string
    endDate: string
    reminderAt?: number
    tags: string[]
    subtasks: TaskItem['subtasks']
  } | null>(null)

  const saveTimerRef = useRef<number | null>(null)
  const pendingSaveRef = useRef(false)
  const queuedDraftRef = useRef<TaskItem | null>(null)
  const isSavingRef = useRef(false)
  useEffect(() => {
    isSavingRef.current = isSaving
  }, [isSaving])

  const draftRef = useRef<TaskItem | null>(null)

  useEffect(() => {
    if (!task || task.id === lastId) return
    setLastId(task.id)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority ?? null)
    setDueDate(task.dueDate ?? '')
    setStartDate(task.startDate ?? '')
    setEndDate(task.endDate ?? '')
    setReminderAtInput(formatDateTimeLocalInput(task.reminderAt))
    setTags(task.tags)
    setTagOptions(() => {
      const map = new Map<string, string>()
      defaultTagOptions.forEach((tag) => map.set(tag.toLowerCase(), tag))
      task.tags.forEach((tag) => map.set(tag.toLowerCase(), tag))
      return Array.from(map.values())
    })
    setTagDraft('')
    setSubtasks(task.subtasks)
    baselineRef.current = {
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      dueDate: task.dueDate ?? '',
      startDate: task.startDate ?? '',
      endDate: task.endDate ?? '',
      reminderAt: task.reminderAt,
      tags: task.tags,
      subtasks: task.subtasks,
    }
  }, [task, lastId])

  const draft = useMemo(() => {
    if (!task) return null
    return {
      ...task,
      title,
      description,
      priority,
      dueDate: dueDate || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      reminderAt: parseDateTimeLocalInput(reminderAtInput),
      tags,
      subtasks,
    }
  }, [task, title, description, priority, dueDate, startDate, endDate, reminderAtInput, tags, subtasks])

  draftRef.current = draft

  const dirty = useMemo(() => {
    const baseline = baselineRef.current
    if (!task || !baseline) return false
    if (title !== baseline.title) return true
    if (description !== baseline.description) return true
    if (priority !== baseline.priority) return true
    if ((dueDate || '') !== (baseline.dueDate || '')) return true
    if ((startDate || '') !== (baseline.startDate || '')) return true
    if ((endDate || '') !== (baseline.endDate || '')) return true
    if (parseDateTimeLocalInput(reminderAtInput) !== baseline.reminderAt) return true
    if (!equalStringArrays(tags, baseline.tags)) return true
    if (!equalSubtasks(subtasks, baseline.subtasks)) return true
    return false
  }, [task, title, description, priority, dueDate, startDate, endDate, reminderAtInput, tags, subtasks])

  const isDraftDirty = useCallback((nextDraft: TaskItem) => {
    const baseline = baselineRef.current
    if (!baseline) return false
    if (nextDraft.title !== baseline.title) return true
    if ((nextDraft.description ?? '') !== baseline.description) return true
    if (nextDraft.priority !== baseline.priority) return true
    if ((nextDraft.dueDate ?? '') !== (baseline.dueDate ?? '')) return true
    if ((nextDraft.startDate ?? '') !== (baseline.startDate ?? '')) return true
    if ((nextDraft.endDate ?? '') !== (baseline.endDate ?? '')) return true
    if (nextDraft.reminderAt !== baseline.reminderAt) return true
    if (!equalStringArrays(nextDraft.tags, baseline.tags)) return true
    if (!equalSubtasks(nextDraft.subtasks, baseline.subtasks)) return true
    return false
  }, [])

  const saveDraft = useCallback(
    async (nextDraft: TaskItem) => {
      if (nextDraft.startDate && nextDraft.endDate && nextDraft.endDate < nextDraft.startDate) {
        toast.push({
          variant: 'error',
          title: 'Invalid date range',
          message: 'End date must be on or after start date.',
        })
        return
      }
      isSavingRef.current = true
      setIsSaving(true)
      try {
        const next = await tasksRepo.update(nextDraft)
        emitTasksChanged('task-drawer:update')
        onUpdated(next)
        baselineRef.current = {
          title: next.title,
          description: next.description ?? '',
          priority: next.priority,
          dueDate: next.dueDate ?? '',
          startDate: next.startDate ?? '',
          endDate: next.endDate ?? '',
          reminderAt: next.reminderAt,
          tags: next.tags,
          subtasks: next.subtasks,
        }
      } catch {
        toast.push({
          variant: 'error',
          title: 'Save failed',
          message: 'Changes are kept and will retry on the next edit.',
        })
      } finally {
        isSavingRef.current = false
        setIsSaving(false)
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false
          const queued = queuedDraftRef.current
          queuedDraftRef.current = null
          if (queued && isDraftDirty(queued)) {
            void saveDraft(queued)
          }
        }
      }
    },
    [isDraftDirty, onUpdated, toast]
  )

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const nextDraft = draftRef.current
    if (!task || task.id !== lastId) return
    if (!nextDraft) return
    if (!isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    void saveDraft(nextDraft)
  }, [isDraftDirty, lastId, saveDraft, task])

  useEffect(() => {
    if (!open) return
    if (!task || task.id !== lastId) return
    const nextDraft = draftRef.current
    if (!nextDraft) return
    if (!isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      const latestDraft = draftRef.current
      if (!latestDraft) return
      if (!isDraftDirty(latestDraft)) return
      if (isSavingRef.current) {
        pendingSaveRef.current = true
        queuedDraftRef.current = latestDraft
        return
      }
      void saveDraft(latestDraft)
    }, 300)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [open, dirty, title, description, priority, dueDate, startDate, endDate, reminderAtInput, tags, subtasks, lastId, isDraftDirty, saveDraft, task])

  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [flushSave])

  const requestClose = () => {
    flushSave()
    onClose()
  }

  const handleStatusChange = async (status: TaskItem['status']) => {
    if (!currentTask) return
    setIsSaving(true)
    try {
      const updated = await tasksRepo.updateStatus(currentTask.id, status)
      if (updated) {
        emitTasksChanged('task-drawer:update-status')
        onUpdated(updated)
      }
    } catch {
      toast.push({ variant: 'error', title: 'Update failed', message: 'Try again.' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!currentTask) return
    if (onRequestDelete) {
      onRequestDelete(currentTask)
      onClose()
      return
    }
    if (!window.confirm(`Delete task "${currentTask.title}"?`)) return
    await tasksRepo.remove(currentTask.id)
    emitTasksChanged('task-drawer:delete')
    onDeleted(currentTask.id)
    onClose()
  }

  const subtaskComposer = useAddInputComposer({
    onSubmit: async (subtaskTitle) => {
      setSubtasks((prev) => [...prev, { id: createId(), title: subtaskTitle, done: false }])
    },
  })

  const visibleTags = useMemo(() => tags.slice(0, 2), [tags])
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length)

  const progressLogs = useMemo(
    () => (currentTask?.progressLogs ?? []).slice().sort((a, b) => b.createdAt - a.createdAt),
    [currentTask?.progressLogs]
  )
  const activityLogs = useMemo(
    () => (currentTask?.activityLogs ?? []).slice().sort((a, b) => b.createdAt - a.createdAt),
    [currentTask?.activityLogs]
  )

  const tagToneClass = (tag: string) => {
    const key = tag.toLowerCase()
    if (key === 'work') return 'task-tag-chip--work'
    if (key === 'life') return 'task-tag-chip--life'
    if (key === 'health') return 'task-tag-chip--health'
    if (key === 'study') return 'task-tag-chip--study'
    if (key === 'finance') return 'task-tag-chip--finance'
    if (key === 'family') return 'task-tag-chip--family'
    return 'task-tag-chip--custom'
  }

  const toggleTag = (tag: string) => {
    setTags((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === tag.toLowerCase())
      if (exists) return prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
      return [...prev, tag]
    })
  }

  const addCustomTag = () => {
    const next = tagDraft.trim()
    if (!next) return
    const optionExists = tagOptions.some((item) => item.toLowerCase() === next.toLowerCase())
    const normalized = optionExists
      ? tagOptions.find((item) => item.toLowerCase() === next.toLowerCase()) ?? next
      : next
    if (!optionExists) {
      setTagOptions((prev) => [...prev, normalized])
    }
    setTags((prev) => {
      const selected = prev.some((item) => item.toLowerCase() === normalized.toLowerCase())
      if (selected) return prev
      return [...prev, normalized]
    })
    setTagDraft('')
  }

  return (
    <Dialog open={open} title="" onClose={requestClose} panelClassName="task-detail-dialog__panel">
      {currentTask ? (
        <div className="task-fg task-detail-dialog">
          <div className="task-fg__header">
            <h1 className="task-fg__title" title={title.trim() || 'Untitled'}>
              Task · <span className="task-fg__title-accent">{title.trim() || 'Untitled'}</span>
            </h1>
            <div className="task-fg__toolbar">
              <div className="task-fg__actions" aria-label="Task actions">
                {currentTask.status === 'todo' && (
                  <>
                    <Button
                      className="button button--ghost task-fg__action"
                      onClick={() => void handleStatusChange('doing')}
                      disabled={isSaving}
                    >
                      Start
                    </Button>
                    <Button
                      className="button button--ghost task-fg__action"
                      onClick={() => void handleStatusChange('done')}
                      disabled={isSaving}
                    >
                      Done
                    </Button>
                  </>
                )}
                {currentTask.status === 'doing' && (
                  <Button
                    className="button button--ghost task-fg__action"
                    onClick={() => void handleStatusChange('done')}
                    disabled={isSaving}
                  >
                    Done
                  </Button>
                )}
                {currentTask.status === 'done' && (
                  <Button
                    className="button button--ghost task-fg__action"
                    onClick={() => void handleStatusChange('todo')}
                    disabled={isSaving}
                  >
                    Reopen
                  </Button>
                )}
                <Button className="button button--ghost task-fg__action" onClick={() => void handleDelete()}>
                  Delete
                </Button>
              </div>

              <button type="button" className="task-fg__icon-btn" onClick={requestClose} aria-label="Close task">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="task-detail-dialog__meta muted">
            <span>Created {formatDateTime(currentTask.createdAt)}</span>
            <span>Updated {formatDateTime(currentTask.updatedAt)}</span>
          </div>

          <div className="task-fg__content">
            <section className="task-fg__card" aria-label="Task details">
              <h2 className="task-fg__section-title">Details</h2>
              <div className="task-fg__fields">
                <label className="task-fg__field">
                  <span className="task-fg__label">Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Description</span>
                  <textarea
                    className="task-fg__textarea"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                  />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Priority</span>
                  <Select
                    value={priority ?? '__none'}
                    options={[
                      {
                        value: '__none',
                        label: 'None',
                        className: 'task-priority-option task-priority-option--none',
                        valueClassName: 'task-priority-value task-priority-value--none',
                        valueStyle: { color: priorityTextColors.none },
                        labelStyle: { color: priorityTextColors.none },
                      },
                      ...priorityOptions.map((opt) => ({
                        value: opt,
                        label: priorityLabel(opt),
                        className: `task-priority-option task-priority-option--${opt}`,
                        valueClassName: `task-priority-value task-priority-value--${opt}`,
                        valueStyle: { color: priorityTextColors[opt] },
                        labelStyle: { color: priorityTextColors[opt] },
                      })),
                    ]}
                    onChange={(v) => setPriority(v === '__none' ? null : (v as TaskPriority))}
                  />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Due Date</span>
                  <DatePicker value={dueDate} onChange={(date) => setDueDate(date ?? '')} placeholder="Set due date" />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Start Date</span>
                  <DatePicker value={startDate} onChange={(date) => setStartDate(date ?? '')} placeholder="Set start date" />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">End Date</span>
                  <DatePicker value={endDate} onChange={(date) => setEndDate(date ?? '')} placeholder="Set end date" />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Reminder</span>
                  <input
                    type="datetime-local"
                    value={reminderAtInput}
                    onChange={(event) => setReminderAtInput(event.target.value)}
                  />
                </label>

                <label className="task-fg__field">
                  <span className="task-fg__label">Tags</span>
                  <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`task-tag-select__trigger ${tagPickerOpen ? 'is-open' : ''}`}
                        aria-label="Select tags"
                      >
                        <span className="task-tag-select__value">
                          {visibleTags.map((tag) => (
                            <span key={tag} className={`task-tag-chip ${tagToneClass(tag)}`}>
                              {tag}
                            </span>
                          ))}
                          {hiddenTagCount > 0 ? (
                            <span className="task-tag-chip task-tag-chip--count">+{hiddenTagCount}</span>
                          ) : null}
                          {tags.length === 0 ? <span className="task-tag-select__empty" aria-hidden /> : null}
                        </span>
                        <ChevronDown size={16} aria-hidden />
                      </button>
                    </PopoverTrigger>

                    <PopoverContent className="task-tag-select__panel" align="start" sideOffset={8}>
                      <div className="task-tag-select__options" role="listbox" aria-label="Tag options">
                        {tagOptions.map((tag) => {
                          const selected = tags.some((item) => item.toLowerCase() === tag.toLowerCase())
                          return (
                            <button
                              key={tag}
                              type="button"
                              className={`task-tag-select__option ${selected ? 'is-selected' : ''}`}
                              onClick={() => toggleTag(tag)}
                              aria-selected={selected}
                            >
                              <span className={`task-tag-chip ${tagToneClass(tag)}`}>{tag}</span>
                            </button>
                          )
                        })}
                      </div>
                      <form
                        className="task-tag-select__composer"
                        onSubmit={(event) => {
                          event.preventDefault()
                          addCustomTag()
                        }}
                      >
                        <input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} />
                        <Button
                          type="submit"
                          className="button button--ghost task-tag-select__add"
                          disabled={!tagDraft.trim()}
                        >
                          <Plus size={14} />
                          Add
                        </Button>
                      </form>
                    </PopoverContent>
                  </Popover>
                </label>
              </div>
            </section>

            <section className="task-fg__card" aria-label="Task progress logs">
              <h2 className="task-fg__section-title">Progress Logs</h2>
              {progressLogs.length === 0 ? (
                <p className="muted task-detail-dialog__empty">No progress yet.</p>
              ) : (
                <ul className="task-detail-dialog__log-list">
                  {progressLogs.map((log) => (
                    <li key={log.id} className="task-detail-dialog__log-item">
                      <p>{log.content}</p>
                      <span className="muted">{formatDateTime(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="task-fg__card" aria-label="Task history">
              <h2 className="task-fg__section-title">Activity</h2>
              {activityLogs.length === 0 ? (
                <p className="muted task-detail-dialog__empty">No activity.</p>
              ) : (
                <ul className="task-detail-dialog__log-list">
                  {activityLogs.map((log) => (
                    <li key={log.id} className="task-detail-dialog__log-item">
                      <p>{log.message}</p>
                      <span className="muted">{formatDateTime(log.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="task-fg__card" aria-label="Task subtasks">
              <h2 className="task-fg__section-title">Subtasks</h2>
              <div className={`task-fg__subtasks ${subtasks.length === 0 ? 'is-empty' : ''}`}>
                {subtasks.length > 0 ? (
                  <div className="task-fg__subtask-list">
                    {subtasks.map((subtask, index) => (
                      <div key={subtask.id} className="task-fg__subtask-row">
                        <input
                          type="checkbox"
                          checked={subtask.done}
                          onChange={(event) => {
                            const next = [...subtasks]
                            next[index] = { ...subtask, done: event.target.checked }
                            setSubtasks(next)
                          }}
                        />
                        <input
                          value={subtask.title}
                          onChange={(event) => {
                            const next = [...subtasks]
                            next[index] = { ...subtask, title: event.target.value }
                            setSubtasks(next)
                          }}
                          placeholder="Subtask"
                        />
                        <Button
                          type="button"
                          className="button button--ghost task-fg__subtask-remove"
                          onClick={() => setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  className="widget-todos__composer task-fg__composer"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void subtaskComposer.submit()
                  }}
                >
                  <input
                    ref={subtaskComposer.inputRef}
                    className={`widget-todos__input task-fg__input ${subtaskComposer.isShaking ? 'is-shaking' : ''}`}
                    value={subtaskComposer.value}
                    onChange={(event) => subtaskComposer.setValue(event.target.value)}
                    onAnimationEnd={subtaskComposer.clearShake}
                    placeholder="Add a new subtask..."
                  />
                  <Button
                    type="submit"
                    className="button widget-todos__add-btn task-fg__add-btn"
                    disabled={!subtaskComposer.canSubmit}
                  >
                    Add
                  </Button>
                </form>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}

export default TaskDrawer
