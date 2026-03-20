import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, Clock3, LoaderCircle, Pin, Plus, RotateCcw, Target, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import Dialog from '../../shared/ui/Dialog'
import AnimatedPlanCheckbox from '../../shared/ui/AnimatedPlanCheckbox'
import { DatePicker } from '../../shared/ui/DatePicker'
import { DateRangePicker } from '../../shared/ui/DateRangePicker'
import { DateTimePicker } from '../../shared/ui/DateTimePicker'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { createId } from '../../shared/utils/ids'
import { useToast } from '../../shared/ui/toast/toast'
import type { TaskItem, TaskPriority } from './tasks.types'
import { useAddInputComposer } from '../../shared/hooks/useAddInputComposer'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import { emitTasksChanged } from './taskSync'
import TaskNoteEditor from './components/TaskNoteEditor'
import { createTaskNoteDoc, resolveTaskNoteRichText } from './model/taskNoteRichText'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, formatTaskDateTime, getTaskTagTone } from './components/taskPresentation'

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
const TASK_DRAWER_WIDTH_STORAGE_KEY = 'task_drawer_width_v1'
const TASK_DRAWER_SPLIT_STORAGE_KEY = 'task_drawer_split_ratio_v1'
const TASK_DRAWER_MIN_WIDTH = 1100
const TASK_DRAWER_MAX_WIDTH = 1800
const TASK_DRAWER_MIN_LEFT_RATIO = 0.45
const TASK_DRAWER_MAX_LEFT_RATIO = 0.75
const TASK_DRAWER_TOGGLE_RATIO_A = 0.6
const TASK_DRAWER_TOGGLE_RATIO_B = 0.7

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
    if (left.id !== right.id || left.title !== right.title || left.done !== right.done) return false
  }
  return true
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
  const timestamp = new Date(`${date}T${timeText}`).getTime()
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const TaskDrawer = ({ open, task, onClose, onUpdated, onDeleted, onRequestDelete }: TaskDrawerProps) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagOptions, setTagOptions] = useState<string[]>(defaultTagOptions)
  const [tagDraft, setTagDraft] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [subtasks, setSubtasks] = useState<TaskItem['subtasks']>([])
  const [taskNoteContent, setTaskNoteContent] = useState<{ contentJson?: TaskItem['taskNoteContentJson']; contentMd?: TaskItem['taskNoteContentMd'] }>({
    contentJson: createTaskNoteDoc() as TaskItem['taskNoteContentJson'],
    contentMd: '',
  })
  const [lastId, setLastId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const toast = useToast()
  const taskSnapshotRef = useRef<TaskItem | null>(null)
  const bodyOverflowRef = useRef<string>('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1280
    const stored = Number(window.localStorage.getItem(TASK_DRAWER_WIDTH_STORAGE_KEY))
    const fallback = Number.isFinite(stored) ? stored : 1280
    const viewportMax = Math.max(TASK_DRAWER_MIN_WIDTH, window.innerWidth - 48)
    return clamp(fallback, TASK_DRAWER_MIN_WIDTH, Math.min(TASK_DRAWER_MAX_WIDTH, viewportMax))
  })
  const [leftRatio, setLeftRatio] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.7
    const stored = Number(window.localStorage.getItem(TASK_DRAWER_SPLIT_STORAGE_KEY))
    const fallback = Number.isFinite(stored) ? stored : 0.7
    return clamp(fallback, TASK_DRAWER_MIN_LEFT_RATIO, TASK_DRAWER_MAX_LEFT_RATIO)
  })

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
    taskNoteContentMd?: TaskItem['taskNoteContentMd']
    taskNoteContentJson?: TaskItem['taskNoteContentJson']
  } | null>(null)

  const saveTimerRef = useRef<number | null>(null)
  const pendingSaveRef = useRef(false)
  const queuedDraftRef = useRef<TaskItem | null>(null)
  const isSavingRef = useRef(false)
  const draftRef = useRef<TaskItem | null>(null)

  useEffect(() => {
    isSavingRef.current = isSaving
  }, [isSaving])

  useEffect(() => {
    if (!task || task.id === lastId) return
    setLastId(task.id)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority ?? null)
    setDueDate(task.dueDate ?? '')
    setStartDate(task.startDate ?? '')
    setEndDate(task.endDate ?? '')
    const reminderParts = getReminderDateParts(task.reminderAt)
    setReminderDate(reminderParts.reminderDate)
    setReminderTime(reminderParts.reminderTime)
    setTags(task.tags)
    setTagOptions(() => {
      const map = new Map<string, string>()
      defaultTagOptions.forEach((tagName) => map.set(tagName.toLowerCase(), tagName))
      task.tags.forEach((tagName) => map.set(tagName.toLowerCase(), tagName))
      return Array.from(map.values())
    })
    setTagDraft('')
    setSubtasks(task.subtasks)
    setTaskNoteContent(resolveTaskNoteRichText(task))
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
      taskNoteContentMd: task.taskNoteContentMd,
      taskNoteContentJson: task.taskNoteContentJson,
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
      reminderAt: combineReminderDateTime(reminderDate, reminderTime),
      tags,
      subtasks,
      taskNoteBlocks: [],
      taskNoteContentMd: taskNoteContent.contentMd,
      taskNoteContentJson: taskNoteContent.contentJson,
    }
  }, [task, title, description, priority, dueDate, startDate, endDate, reminderDate, reminderTime, tags, subtasks, taskNoteContent])

  draftRef.current = draft

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
    if ((nextDraft.taskNoteContentMd ?? '') !== (baseline.taskNoteContentMd ?? '')) return true
    if (JSON.stringify(nextDraft.taskNoteContentJson ?? null) !== JSON.stringify(baseline.taskNoteContentJson ?? null)) return true
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
          taskNoteContentMd: next.taskNoteContentMd,
          taskNoteContentJson: next.taskNoteContentJson,
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
          if (queued && isDraftDirty(queued)) void saveDraft(queued)
        }
      }
    },
    [isDraftDirty, onUpdated, toast],
  )

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const nextDraft = draftRef.current
    if (!task || task.id !== lastId || !nextDraft || !isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    void saveDraft(nextDraft)
  }, [isDraftDirty, lastId, saveDraft, task])

  useEffect(() => {
    if (!open || !task || task.id !== lastId) return
    const nextDraft = draftRef.current
    if (!nextDraft || !isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      const latestDraft = draftRef.current
      if (!latestDraft || !isDraftDirty(latestDraft)) return
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
  }, [open, title, description, priority, dueDate, startDate, endDate, reminderDate, reminderTime, tags, subtasks, taskNoteContent, lastId, isDraftDirty, saveDraft, task])

  useEffect(() => {
    return () => {
      flushSave()
    }
  }, [flushSave])

  useEffect(() => {
    if (!open) return
    bodyOverflowRef.current = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = bodyOverflowRef.current
    }
  }, [open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TASK_DRAWER_WIDTH_STORAGE_KEY, String(panelWidth))
  }, [panelWidth])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(TASK_DRAWER_SPLIT_STORAGE_KEY, String(leftRatio))
  }, [leftRatio])

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const onResize = () => {
      const viewportMax = Math.max(TASK_DRAWER_MIN_WIDTH, window.innerWidth - 48)
      setPanelWidth((prev) => clamp(prev, TASK_DRAWER_MIN_WIDTH, Math.min(TASK_DRAWER_MAX_WIDTH, viewportMax)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  const beginWidthResize = useCallback((event: React.PointerEvent, edge: 'left' | 'right') => {
    if (!open) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? panelWidth
    const viewportMax = typeof window === 'undefined' ? TASK_DRAWER_MAX_WIDTH : Math.max(TASK_DRAWER_MIN_WIDTH, window.innerWidth - 48)
    const maxWidth = Math.min(TASK_DRAWER_MAX_WIDTH, viewportMax)
    const multiplier = edge === 'right' ? 1 : -1
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'
    const onMove = (moveEvent: PointerEvent) => {
      const delta = (moveEvent.clientX - startX) * multiplier
      setPanelWidth(clamp(startWidth + delta, TASK_DRAWER_MIN_WIDTH, maxWidth))
    }
    const onUp = () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [open, panelWidth])

  const beginSplitResize = useCallback((event: React.PointerEvent) => {
    if (!open) return
    event.preventDefault()
    const panelRect = panelRef.current?.getBoundingClientRect()
    if (!panelRect || panelRect.width <= 0) return
    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
    const onMove = (moveEvent: PointerEvent) => {
      const next = (moveEvent.clientX - panelRect.left) / panelRect.width
      setLeftRatio(clamp(next, TASK_DRAWER_MIN_LEFT_RATIO, TASK_DRAWER_MAX_LEFT_RATIO))
    }
    const onUp = () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [open])

  const toggleSplitPreset = useCallback(() => {
    setLeftRatio((prev) => {
      const distanceToA = Math.abs(prev - TASK_DRAWER_TOGGLE_RATIO_A)
      const distanceToB = Math.abs(prev - TASK_DRAWER_TOGGLE_RATIO_B)
      return distanceToA <= distanceToB ? TASK_DRAWER_TOGGLE_RATIO_B : TASK_DRAWER_TOGGLE_RATIO_A
    })
  }, [])

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

  const activityLogs = useMemo(() => (currentTask?.activityLogs ?? []).slice().sort((a, b) => b.createdAt - a.createdAt), [currentTask?.activityLogs])
  const statusConfig = currentTask ? TASK_STATUS_CONFIG[currentTask.status] : TASK_STATUS_CONFIG.todo
  const priorityConfig = TASK_PRIORITY_CONFIG[priority ?? 'none']
  const reminderAtIso = useMemo(() => {
    const reminderAt = combineReminderDateTime(reminderDate, reminderTime)
    return reminderAt ? new Date(reminderAt).toISOString() : '—'
  }, [reminderDate, reminderTime])

  const toggleTag = (tagName: string) => {
    setTags((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === tagName.toLowerCase())
      if (exists) return prev.filter((item) => item.toLowerCase() !== tagName.toLowerCase())
      return [...prev, tagName]
    })
  }

  const addCustomTag = () => {
    const next = tagDraft.trim()
    if (!next) return
    const optionExists = tagOptions.some((item) => item.toLowerCase() === next.toLowerCase())
    const normalized = optionExists ? tagOptions.find((item) => item.toLowerCase() === next.toLowerCase()) ?? next : next
    if (!optionExists) setTagOptions((prev) => [...prev, normalized])
    setTags((prev) => {
      const selected = prev.some((item) => item.toLowerCase() === normalized.toLowerCase())
      if (selected) return prev
      return [...prev, normalized]
    })
    setTagDraft('')
  }

  return (
    <Dialog
      open={open}
      title=""
      onClose={requestClose}
      panelClassName="task-drawer-panel !h-[calc(100vh-40px)] !max-h-none rounded-[30px] border border-[#3a3733]/8 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.18)]"
      panelStyle={{ width: `${panelWidth}px`, maxWidth: 'calc(100vw - 48px)' }}
      contentClassName="!h-full !p-0"
    >
      {currentTask ? (
        <div ref={panelRef} className="task-drawer-shell task-detail-shell relative flex h-full min-h-0 flex-col overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'left')} />
          <div className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'right')} />
          <div className="absolute bottom-1 right-1 z-20 h-4 w-4 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'right')} />
          <div className="task-detail-topbar flex items-center justify-between gap-4 border-b border-[#3a3733]/6 bg-white px-6 py-4">
            <div className="task-detail-topbar__state flex min-w-0 items-center gap-3">
              <Badge variant="outline" className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold', statusConfig.badge)}>
                <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                {statusConfig.label}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                {isSaving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-500" />}
                {isSaving ? 'Saving...' : 'Saved'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {currentTask.status === 'todo' ? (
                <>
                  <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold" onClick={() => void handleStatusChange('doing')} disabled={isSaving}>
                    <Target className="mr-1.5 h-3.5 w-3.5" />
                    Start
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold" onClick={() => void handleStatusChange('done')} disabled={isSaving}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Done
                  </Button>
                </>
              ) : null}
              {currentTask.status === 'doing' ? (
                <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold" onClick={() => void handleStatusChange('done')} disabled={isSaving}>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Done
                </Button>
              ) : null}
              {currentTask.status === 'done' ? (
                <Button variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] font-semibold" onClick={() => void handleStatusChange('todo')} disabled={isSaving}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reopen
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => void handleDelete()} disabled={isSaving}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={requestClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="task-detail-layout grid min-h-0 flex-1" style={{ gridTemplateColumns: `${leftRatio}fr 10px ${1 - leftRatio}fr` }}>
            <ScrollArea className="min-h-0">
              <div className="task-detail-column space-y-6 px-6 py-6">
                <div className="task-detail-card task-detail-card--hero rounded-[28px] border border-[#3a3733]/6 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        className="h-auto border-0 bg-transparent px-0 py-0 text-[28px] font-semibold tracking-[-0.03em] text-slate-950 shadow-none focus-visible:ring-0 md:text-[32px]"
                        placeholder="Task title"
                      />
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Created {formatTaskDateTime(currentTask.createdAt)}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          Updated {formatTaskDateTime(currentTask.updatedAt)}
                        </span>
                        {currentTask.pinned ? (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Pin className="h-3.5 w-3.5 fill-current" />
                              Pinned
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-[120px]">
                      <ShadcnSelect value={priority ?? '__none'} onValueChange={(value) => setPriority(value === '__none' ? null : (value as TaskPriority))}>
                        <SelectTrigger className="h-9 rounded-[14px] border-[#3a3733]/8 bg-white/90 px-3 text-sm font-semibold">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {TASK_PRIORITY_CONFIG[option].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[20px] border border-[#3a3733]/6 bg-white/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                      <div className="mt-3">
                        <Badge variant="outline" className={cn('rounded-full border px-3 py-1 text-[11px] font-semibold', statusConfig.badge)}>
                          <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                          {statusConfig.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#3a3733]/6 bg-white/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Priority</p>
                      <div className="mt-3">
                        <Badge variant="secondary" className={cn('rounded-full px-3 py-1 text-[11px] font-semibold', priorityConfig.badge)}>
                          <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', priorityConfig.dot)} />
                          {priorityConfig.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-[#3a3733]/6 bg-white/90 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reminder timestamp</p>
                      <p className="mt-3 text-[12px] font-medium text-slate-600">{reminderAtIso}</p>
                    </div>
                  </div>
                </div>

                <section className="task-detail-card rounded-[26px] border border-[#3a3733]/6 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="task-detail-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Details</p>
                      <h2 className="task-detail-title mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">Core task properties</h2>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Due date</span>
                      <DatePicker value={dueDate} onChange={(date) => setDueDate(date ?? '')} placeholder="Set due date" className="rounded-[14px]" />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reminder</span>
                      <DateTimePicker
                        dateValue={reminderDate}
                        timeValue={reminderTime}
                        onDateChange={(date) => {
                          const nextDate = date ?? ''
                          setReminderDate(nextDate)
                          if (!nextDate) setReminderTime('')
                        }}
                        onTimeChange={(time) => setReminderTime(time ?? '')}
                        placeholder="Set reminder"
                        ariaLabel="Reminder date"
                        className="w-full"
                        triggerClassName="rounded-[14px]"
                      />
                    </label>

                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Date range</span>
                      <DateRangePicker
                        value={{ startDate, endDate }}
                        className="rounded-[14px]"
                        onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                          setStartDate(nextStartDate ?? '')
                          setEndDate(nextEndDate ?? '')
                        }}
                      />
                    </label>

                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Task summary</span>
                      <Textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="min-h-[100px] rounded-[18px] border-[#3a3733]/8 bg-slate-50/80 text-[13px] leading-6 shadow-none"
                        placeholder="Optional short summary for this task..."
                      />
                    </label>
                  </div>
                </section>

                <section className="task-detail-card rounded-[26px] border border-[#3a3733]/6 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="task-detail-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</p>
                      <h2 className="task-detail-title mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">Context and categorization</h2>
                    </div>
                    <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full px-4 text-[11px] font-semibold">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          New tag
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] rounded-[22px] border border-[#3a3733]/8 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.12)]" align="end" sideOffset={12}>
                        <div className="space-y-3">
                          <div className="grid gap-2">
                            {tagOptions.map((tagName) => {
                              const selected = tags.some((item) => item.toLowerCase() === tagName.toLowerCase())
                              const tone = getTaskTagTone(tagName)
                              return (
                                <button
                                  key={tagName}
                                  type="button"
                                  className={cn('flex items-center justify-between rounded-[16px] px-3 py-2 text-left transition', selected ? 'bg-slate-100' : 'hover:bg-slate-50')}
                                  onClick={() => toggleTag(tagName)}
                                >
                                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium', tone.badge)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                                    {tagName}
                                  </span>
                                  {selected ? <Check className="h-3.5 w-3.5 text-slate-600" /> : null}
                                </button>
                              )
                            })}
                          </div>
                          <form
                            className="flex items-center gap-2"
                            onSubmit={(event) => {
                              event.preventDefault()
                              addCustomTag()
                            }}
                          >
                            <Input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Custom tag" className="h-10 rounded-[14px] border-[#3a3733]/8 bg-slate-50/80 text-[13px]" />
                            <Button type="submit" size="sm" className="h-10 rounded-full px-4 text-[11px] font-semibold" disabled={!tagDraft.trim()}>
                              Add
                            </Button>
                          </form>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tagName) => {
                        const tone = getTaskTagTone(tagName)
                        return (
                          <span key={tagName} className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium', tone.badge)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                            {tagName}
                          </span>
                        )
                      })
                    ) : (
                      <p className="text-[13px] text-slate-500">No tags selected yet.</p>
                    )}
                  </div>
                </section>

                <section>
                  <div className="task-detail-card rounded-[26px] border border-[#3a3733]/6 bg-white/88 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                    <p className="task-detail-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Activity</p>
                    <h2 className="task-detail-title mt-1 text-[18px] font-semibold tracking-[-0.02em] text-slate-950">System timeline</h2>
                    <div className="mt-4 space-y-3">
                      {activityLogs.length === 0 ? (
                        <p className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-[13px] text-slate-500">No activity recorded.</p>
                      ) : (
                        activityLogs.map((log) => (
                          <article key={log.id} className="rounded-[18px] border border-[#3a3733]/6 bg-slate-50/80 px-4 py-3">
                            <p className="text-[13px] leading-6 text-slate-700">{log.message}</p>
                            <p className="mt-2 text-[11px] font-medium text-slate-500">{formatTaskDateTime(log.createdAt)}</p>
                          </article>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </ScrollArea>

            <button
              type="button"
              aria-label="Resize columns"
              className="group relative h-full w-[10px] cursor-col-resize border-x border-[#3a3733]/6 bg-slate-100/70 transition-colors hover:bg-slate-200/80"
              onPointerDown={beginSplitResize}
              onDoubleClick={toggleSplitPreset}
            >
              <span className="absolute left-1/2 top-1/2 h-14 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 transition-colors group-hover:bg-slate-400" />
            </button>

            <aside className="task-detail-aside flex min-h-0 flex-col bg-slate-50/70">
              <ScrollArea className="min-h-0 flex-1">
                <div className="task-detail-column space-y-5 px-5 py-6">
                  <section className="task-detail-card task-detail-card--side rounded-[24px] border border-[#3a3733]/6 bg-white/92 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                    <p className="task-detail-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Subtasks</p>
                    <h2 className="task-detail-title mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-950">Execution checklist</h2>

                    <div className="mt-4 space-y-2">
                      {subtasks.length > 0 ? (
                        subtasks.map((subtask, index) => (
                          <div key={subtask.id} className="rounded-[18px] border border-[#3a3733]/6 bg-slate-50/80 px-3 py-3">
                            <div className="task-popup-detail__subtask-checkbox-row flex items-center gap-3">
                              <AnimatedPlanCheckbox
                                checked={subtask.done}
                                className="shrink-0 self-center"
                                onChange={(event) => {
                                  const next = [...subtasks]
                                  next[index] = { ...subtask, done: event.target.checked }
                                  setSubtasks(next)
                                }}
                              />
                              <div className="task-popup-detail__subtask-title min-w-0 flex-1">
                                <input
                                  value={subtask.title}
                                  onChange={(event) => {
                                    const next = [...subtasks]
                                    next[index] = { ...subtask, title: event.target.value }
                                    setSubtasks(next)
                                  }}
                                  placeholder="Subtask"
                                  className={cn('task-popup-detail__subtask-title-input', subtask.done && 'is-done')}
                                />
                              </div>
                              <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-[10px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => setSubtasks((prev) => prev.filter((item) => item.id !== subtask.id))}>
                                Delete
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-[13px] text-slate-500">No subtasks yet.</p>
                      )}
                    </div>

                    <form
                      className="mt-4 flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void subtaskComposer.submit()
                      }}
                    >
                      <Input
                        ref={subtaskComposer.inputRef}
                        value={subtaskComposer.value}
                        onChange={(event) => subtaskComposer.setValue(event.target.value)}
                        onAnimationEnd={subtaskComposer.clearShake}
                        className={cn('h-10 rounded-[14px] border-[#3a3733]/8 bg-slate-50/80 text-[13px]', subtaskComposer.isShaking && 'is-shaking')}
                        placeholder="Add subtask"
                      />
                      <Button type="submit" className="h-10 rounded-full px-4 text-[11px] font-semibold" disabled={!subtaskComposer.canSubmit}>
                        Add
                      </Button>
                    </form>
                  </section>

                  <section className="task-detail-card task-detail-card--side rounded-[24px] border border-[#3a3733]/6 bg-white/92 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                    <p className="task-detail-kicker text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Note</p>
                    <h2 className="task-detail-title mt-1 text-[17px] font-semibold tracking-[-0.02em] text-slate-950">Context and working notes</h2>
                    <div className="mt-4">
                      <TaskNoteEditor value={taskNoteContent} onChange={setTaskNoteContent} />
                    </div>
                  </section>
                </div>
              </ScrollArea>
            </aside>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}

export default TaskDrawer
