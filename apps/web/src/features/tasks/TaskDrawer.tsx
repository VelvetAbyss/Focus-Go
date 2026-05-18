import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, Clock3, Flag, LoaderCircle, Pin, Plus, RotateCcw, Target, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
import type { ProjectItem } from '../../data/models/types'
import { useAddInputComposer } from '../../shared/hooks/useAddInputComposer'
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover'
import { emitTasksChanged } from './taskSync'
import TaskAttachmentsSection from './components/TaskAttachmentsSection'
import TaskNotesPanel from './components/TaskNotesPanel'
import TaskProjectAssignCard from './components/TaskProjectAssignCard'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, formatTaskDateTime, getTaskTagTone } from './components/taskPresentation'
import { useI18n } from '../../shared/i18n/useI18n'
import { HelpBadge } from '../../shared/ui/HelpBadge'
import { useAuthGate } from '../auth/AuthGateContext'
import { usePremiumGate } from '../premium/PremiumProvider'
import PremiumMark from '../premium/PremiumMark'

type TaskDrawerProps = {
  open: boolean
  task: TaskItem | null
  projects?: ProjectItem[]
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
type SubtaskFilter = 'all' | 'todo' | 'done'

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

const localizeActivityMessage = (
  message: string,
  t: ReturnType<typeof useI18n>['t'],
) => {
  if (message.startsWith('Created in Todo')) return t('tasks.drawer.createdIn', { scope: t('tasks.status.todo') })
  if (message.startsWith('Created in Doing')) return t('tasks.drawer.createdIn', { scope: t('tasks.status.doing') })
  if (message.startsWith('Created in Done')) return t('tasks.drawer.createdIn', { scope: t('tasks.status.done') })
  if (message.startsWith('Status changed to Todo')) return t('tasks.drawer.statusChangedToTodo')
  if (message.startsWith('Status changed to Doing')) return t('tasks.drawer.statusChangedToDoing')
  if (message.startsWith('Status changed to Done')) return t('tasks.drawer.statusChangedToDone')
  return message
}

const TaskDrawer = ({
  open,
  task,
  projects = [],
  onClose,
  onUpdated,
  onDeleted,
  onRequestDelete,
}: TaskDrawerProps) => {
  const { t } = useI18n()
  const { requireAuth, isGated } = useAuthGate()
  const { canUse, openUpgradeModal } = usePremiumGate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [isToday, setIsToday] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [attachments, setAttachments] = useState<TaskItem['attachments']>([])
  const [tagOptions, setTagOptions] = useState<string[]>(defaultTagOptions)
  const [tagDraft, setTagDraft] = useState('')
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | undefined>(undefined)
  const [subtasks, setSubtasks] = useState<TaskItem['subtasks']>([])
  const [subtaskFilter, setSubtaskFilter] = useState<SubtaskFilter>('todo')
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
    isToday: boolean
    dueDate: string
    startDate: string
    endDate: string
    reminderAt?: number
    projectId?: string
    tags: string[]
    subtasks: TaskItem['subtasks']
    taskNoteContentMd?: TaskItem['taskNoteContentMd']
    taskNoteContentJson?: TaskItem['taskNoteContentJson']
    attachments: TaskItem['attachments']
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
    if (open) return
    setLastId(null)
  }, [open])

  useEffect(() => {
    if (!open || !task || task.id === lastId) return
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    pendingSaveRef.current = false
    queuedDraftRef.current = null
    setLastId(task.id)
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority ?? null)
    setIsToday(task.isToday === true)
    setDueDate(task.dueDate ?? '')
    setStartDate(task.startDate ?? '')
    setEndDate(task.endDate ?? '')
    const reminderParts = getReminderDateParts(task.reminderAt)
    setReminderDate(reminderParts.reminderDate)
    setReminderTime(reminderParts.reminderTime)
    setTags(task.tags)
    setAttachments(task.attachments ?? [])
    setTagOptions(() => {
      const map = new Map<string, string>()
      defaultTagOptions.forEach((tagName) => map.set(tagName.toLowerCase(), tagName))
      task.tags.forEach((tagName) => map.set(tagName.toLowerCase(), tagName))
      return Array.from(map.values())
    })
    setTagDraft('')
    setProjectId(task.projectId ?? undefined)
    setSubtasks(task.subtasks)
    setSubtaskFilter('todo')
    baselineRef.current = {
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      isToday: task.isToday === true,
      dueDate: task.dueDate ?? '',
      startDate: task.startDate ?? '',
      endDate: task.endDate ?? '',
      reminderAt: task.reminderAt,
      projectId: task.projectId ?? undefined,
      tags: task.tags,
      subtasks: task.subtasks,
      taskNoteContentMd: task.taskNoteContentMd,
      taskNoteContentJson: task.taskNoteContentJson,
      attachments: task.attachments ?? [],
    }
  }, [open, task, lastId])

  const buildDraft = useCallback((sourceTask: TaskItem | null) => {
    if (!sourceTask) return null
    return {
      ...sourceTask,
      title,
      description,
      priority,
      isToday,
      dueDate: dueDate || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      reminderAt: combineReminderDateTime(reminderDate, reminderTime),
      projectId,
      tags,
      subtasks,
      taskNoteBlocks: sourceTask.taskNoteBlocks ?? [],
      taskNoteContentMd: sourceTask.taskNoteContentMd,
      taskNoteContentJson: sourceTask.taskNoteContentJson,
      attachments,
    }
  }, [attachments, description, dueDate, endDate, isToday, priority, projectId, reminderDate, reminderTime, startDate, subtasks, tags, title])

  const isDraftDirty = useCallback((nextDraft: TaskItem) => {
    const baseline = baselineRef.current
    if (!baseline) return false
    if (nextDraft.title !== baseline.title) return true
    if ((nextDraft.description ?? '') !== baseline.description) return true
    if (nextDraft.priority !== baseline.priority) return true
    if (nextDraft.isToday !== baseline.isToday) return true
    if ((nextDraft.dueDate ?? '') !== (baseline.dueDate ?? '')) return true
    if ((nextDraft.startDate ?? '') !== (baseline.startDate ?? '')) return true
    if ((nextDraft.endDate ?? '') !== (baseline.endDate ?? '')) return true
    if (nextDraft.reminderAt !== baseline.reminderAt) return true
    if ((nextDraft.projectId ?? undefined) !== (baseline.projectId ?? undefined)) return true
    if (!equalStringArrays(nextDraft.tags, baseline.tags)) return true
    if (!equalSubtasks(nextDraft.subtasks, baseline.subtasks)) return true
    if ((nextDraft.taskNoteContentMd ?? '') !== (baseline.taskNoteContentMd ?? '')) return true
    if (JSON.stringify(nextDraft.taskNoteContentJson ?? null) !== JSON.stringify(baseline.taskNoteContentJson ?? null)) return true
    const nextAttachmentIds = (nextDraft.attachments ?? []).map((item) => item.id).join('|')
    const baselineAttachmentIds = (baseline.attachments ?? []).map((item) => item.id).join('|')
    if (nextAttachmentIds !== baselineAttachmentIds) return true
    return false
  }, [])

  const saveDraft = useCallback(
    async (nextDraft: TaskItem) => {
      if (isGated) return
      if (nextDraft.startDate && nextDraft.endDate && nextDraft.endDate < nextDraft.startDate) {
        toast.push({
          variant: 'error',
          title: t('tasks.drawer.invalidDateRange'),
          message: t('tasks.drawer.endDateError'),
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
          isToday: next.isToday === true,
          dueDate: next.dueDate ?? '',
          startDate: next.startDate ?? '',
          endDate: next.endDate ?? '',
          reminderAt: next.reminderAt,
          projectId: next.projectId ?? undefined,
          tags: next.tags,
          subtasks: next.subtasks,
          taskNoteContentMd: next.taskNoteContentMd,
          taskNoteContentJson: next.taskNoteContentJson,
          attachments: next.attachments ?? [],
        }
      } catch {
        toast.push({
          variant: 'error',
          title: t('tasks.drawer.saveFailed'),
          message: t('tasks.drawer.saveFailedHint'),
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
    [isDraftDirty, isGated, onUpdated, t, toast],
  )

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const nextDraft = draftRef.current ?? buildDraft(task)
    if (!task || task.id !== lastId || !nextDraft || !isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    void saveDraft(nextDraft)
  }, [buildDraft, isDraftDirty, lastId, saveDraft, task])

  const scheduleSave = useCallback((nextDraft: TaskItem | null) => {
    draftRef.current = nextDraft
    if (!open || !task || task.id !== lastId || !nextDraft || !isDraftDirty(nextDraft)) return
    if (isSavingRef.current) {
      pendingSaveRef.current = true
      queuedDraftRef.current = nextDraft
      return
    }
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      const latestDraft = queuedDraftRef.current ?? draftRef.current
      if (!latestDraft || !isDraftDirty(latestDraft)) return
      if (isSavingRef.current) {
        pendingSaveRef.current = true
        queuedDraftRef.current = latestDraft
        return
      }
      void saveDraft(latestDraft)
    }, 180)
  }, [isDraftDirty, lastId, open, saveDraft, task])

  useEffect(() => {
    scheduleSave(buildDraft(task))
  }, [buildDraft, scheduleSave, task])

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
      toast.push({ variant: 'error', title: t('tasks.drawer.updateFailed'), message: t('tasks.drawer.retryHint') })
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

  const guardSubtasks = useCallback(() => {
    if (canUse('tasks.subtasks').allowed) return true
    openUpgradeModal('button', 'tasks.subtasks')
    return false
  }, [canUse, openUpgradeModal])

  const subtaskComposer = useAddInputComposer({
    onSubmit: async (subtaskTitle) => {
      if (!guardSubtasks()) return
      setSubtasks((prev) => [...prev, { id: createId(), title: subtaskTitle, done: false }])
    },
  })

  const activityLogs = useMemo(() => (currentTask?.activityLogs ?? []).slice().sort((a, b) => b.createdAt - a.createdAt), [currentTask?.activityLogs])
  const sortedSubtasks = useMemo(() => subtasks.slice().sort((a, b) => Number(a.done) - Number(b.done)), [subtasks])
  const subtasksLocked = !canUse('tasks.subtasks').allowed
  const visibleSubtasks = useMemo(
    () =>
      sortedSubtasks.filter((subtask) => {
        if (subtaskFilter === 'todo') return !subtask.done
        if (subtaskFilter === 'done') return subtask.done
        return true
      }),
    [sortedSubtasks, subtaskFilter],
  )
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

  const doneCount = subtasks.filter((s) => s.done).length
  const allDone = subtasks.length > 0 && doneCount === subtasks.length

  return (
    <Dialog
      open={open}
      title=""
      onClose={requestClose}
      panelClassName="task-drawer-panel task-detail-theme !h-[calc(100vh-40px)] !max-h-none rounded-[30px] border border-[#3a3733]/8 shadow-[0_30px_100px_rgba(15,23,42,0.18)]"
      panelStyle={{ width: `${panelWidth}px`, maxWidth: 'calc(100vw - 48px)' }}
      contentClassName="!h-full !p-0"
    >
      {currentTask ? (
        <div ref={panelRef} className="task-drawer-shell task-detail-shell relative flex h-full min-h-0 flex-col overflow-hidden">
          {/* Edge resize handles */}
          <div className="absolute inset-y-0 left-0 z-20 w-3 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'left')} />
          <div className="absolute inset-y-0 right-0 z-20 w-3 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'right')} />
          <div className="absolute bottom-1 right-1 z-20 h-4 w-4 cursor-ew-resize" onPointerDown={(event) => beginWidthResize(event, 'right')} />

          {/* ─── TOPBAR ─── */}
          <div className="task-detail-topbar flex items-center justify-between gap-3 border-b border-[#3a3733]/6 px-5 py-3.5">
            <div className="task-detail-topbar__state flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-[color:var(--bg)]',
                  priorityConfig.dot,
                  priority === 'high' ? 'ring-rose-300/50' :
                  priority === 'medium' ? 'ring-amber-300/50' :
                  priority === 'low' ? 'ring-cyan-300/50' : 'ring-transparent',
                )}
              />
              <Badge variant="outline" className={cn('task-detail-status-badge rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', statusConfig.badge)}>
                <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                {t(statusConfig.labelKey)}
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[color:var(--text-secondary)]">
                {isSaving
                  ? <LoaderCircle className="h-3 w-3 animate-spin" />
                  : <Check className="h-3 w-3 text-emerald-500" />}
                {isSaving ? t('modules.note.saveState.saving') : t('tasks.status.saved')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="task-detail-actions flex items-center gap-1.5">
                {currentTask.status === 'todo' ? (
                  <>
                    <Button variant="outline" size="sm"
                      className="h-8 rounded-full border-[#3a3733]/15 px-3.5 text-[11px] font-semibold hover:border-[#3a3733]/25 hover:bg-[color:var(--surface-hover)]"
                      onClick={() => void handleStatusChange('doing')} disabled={isSaving}>
                      <Target className="mr-1.5 h-3.5 w-3.5" />
                      {t('tasks.action.start')}
                    </Button>
                    <Button size="sm"
                      className="h-8 rounded-full border-0 bg-emerald-600 px-3.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      onClick={() => void handleStatusChange('done')} disabled={isSaving}>
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      {t('tasks.action.done')}
                    </Button>
                  </>
                ) : null}
                {currentTask.status === 'doing' ? (
                  <Button size="sm"
                    className="h-8 rounded-full border-0 bg-emerald-600 px-3.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                    onClick={() => void handleStatusChange('done')} disabled={isSaving}>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    {t('tasks.action.done')}
                  </Button>
                ) : null}
                {currentTask.status === 'done' ? (
                  <Button variant="outline" size="sm"
                    className="h-8 rounded-full border-[#3a3733]/15 px-3.5 text-[11px] font-semibold hover:border-[#3a3733]/25"
                    onClick={() => void handleStatusChange('todo')} disabled={isSaving}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t('tasks.status.reopen')}
                  </Button>
                ) : null}
              </div>
              <Button aria-label="Delete task" variant="ghost" size="icon"
                className="h-8 w-8 rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-rose-50 hover:text-rose-500"
                onClick={() => requireAuth(() => { void handleDelete() })} disabled={isSaving}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button aria-label="Close task detail" variant="ghost" size="icon"
                className="h-8 w-8 rounded-full text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]"
                onClick={requestClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ─── SPLIT LAYOUT ─── */}
          <div
            className="task-detail-layout grid min-h-0 flex-1"
            style={{ gridTemplateColumns: `minmax(0, ${leftRatio}fr) 10px minmax(0, ${1 - leftRatio}fr)` }}
          >

            {/* ════ LEFT PANE ════ */}
            <ScrollArea className="task-detail-pane task-detail-pane--left min-h-0 min-w-0">
              <div className="task-detail-column min-w-0 space-y-5 px-6 py-6">

                {/* ── HERO CARD ── */}
                <div
                  className="task-detail-card task-detail-card--hero tdv2-section-enter relative overflow-hidden rounded-[28px] border border-[#3a3733]/6 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.06)]"
                  style={{ animationDelay: '0ms' }}
                >
                  {/* Priority left accent bar */}
                  <div className={cn(
                    'absolute bottom-0 left-0 top-0 w-1.5 rounded-r-full transition-colors duration-300',
                    priority === 'high' ? 'bg-rose-500' :
                    priority === 'medium' ? 'bg-amber-400' :
                    priority === 'low' ? 'bg-cyan-500' : 'bg-transparent',
                  )} />

                  <div className="pl-3">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="task-detail-title-input h-auto border-0 bg-transparent px-0 py-0 text-[30px] font-bold leading-[1.15] tracking-[-0.04em] text-[color:var(--text-primary)] shadow-none focus-visible:ring-0"
                      placeholder={t('tasks.drawer.title')}
                    />
                    <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" />
                        {t('tasks.drawer.created')} {formatTaskDateTime(currentTask.createdAt)}
                      </span>
                      <span className="h-[3px] w-[3px] rounded-full bg-[color:var(--text-secondary)] opacity-30" />
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" />
                        {t('tasks.drawer.updated')} {formatTaskDateTime(currentTask.updatedAt)}
                      </span>
                      {currentTask.pinned ? (
                        <>
                          <span className="h-[3px] w-[3px] rounded-full bg-[color:var(--text-secondary)] opacity-30" />
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <Pin className="h-3 w-3 fill-current" />
                            {t('tasks.drawer.pinned')}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* Status · Priority selector · Reminder inline row */}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', statusConfig.badge)}>
                        <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', statusConfig.dot)} />
                        {t(statusConfig.labelKey)}
                      </Badge>

                      <ShadcnSelect value={priority ?? '__none'} onValueChange={(value) => setPriority(value === '__none' ? null : (value as TaskPriority))}>
                        <SelectTrigger
                          aria-label={t('tasks.drawer.priority')}
                          className={cn(
                            'task-detail-select-trigger tdv2-priority-select h-7 w-auto min-w-0 gap-1.5 rounded-full border px-3 text-[11px] font-semibold transition-colors',
                            priority === 'high' && 'border-rose-300/60 bg-rose-50/60 text-rose-700 hover:bg-rose-50',
                            priority === 'medium' && 'border-amber-300/60 bg-amber-50/60 text-amber-700 hover:bg-amber-50',
                            priority === 'low' && 'border-cyan-300/60 bg-cyan-50/60 text-cyan-700 hover:bg-cyan-50',
                            !priority && 'border-dashed text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]',
                          )}
                        >
                          <Flag className="h-3 w-3 shrink-0" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">
                            {t('tasks.drawer.priority')}
                          </span>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', priorityConfig.dot)} />
                          <SelectValue placeholder={t('tasks.drawer.none')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">{t('tasks.drawer.none')}</SelectItem>
                          {priorityOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {t(TASK_PRIORITY_CONFIG[option].labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </ShadcnSelect>

                      {reminderAtIso !== '—' && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3a3733]/8 bg-[color:var(--bg-muted)] px-2.5 py-0.5 text-[11px] font-medium text-[color:var(--text-secondary)]">
                          <Clock3 className="h-3 w-3" />
                          {reminderAtIso}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <TaskProjectAssignCard
                  projectId={projectId}
                  projects={projects}
                  onChange={(next) => setProjectId(next)}
                />

                <TaskAttachmentsSection
                  attachments={attachments}
                  onChange={(next) => setAttachments(next)}
                />

                {/* ── CORE PROPERTIES ── */}
                <section
                  className="task-detail-card tdv2-section-enter rounded-[26px] border border-[#3a3733]/6 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]"
                  style={{ animationDelay: '40ms' }}
                >
                  <p className="task-detail-kicker">{t('tasks.drawer.details')}</p>
                  <h2 className="task-detail-title mt-0.5">{t('tasks.drawer.coreProperties')}</h2>

                  <div className="mt-4 space-y-3">
                    {/* Today toggle */}
                    <div className="flex items-center justify-between rounded-[18px] border border-[#3a3733]/6 bg-[color:var(--bg-muted)] px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[color:var(--text-primary)]">{t('tasks.today.title')}</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]">{t('tasks.today.switchHint')}</p>
                      </div>
                      <Switch checked={isToday} onCheckedChange={setIsToday} aria-label={t('tasks.today.title')} />
                    </div>

                    {/* Due date + reminder */}
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-1.5">
                        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{t('tasks.drawer.dueDate')}</span>
                        <DatePicker value={dueDate} onChange={(date) => setDueDate(date ?? '')} placeholder={t('tasks.drawer.setDate')} className="task-detail-picker rounded-[14px]" />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{t('tasks.drawer.reminder')}</span>
                        <DateTimePicker
                          dateValue={reminderDate}
                          timeValue={reminderTime}
                          onDateChange={(date) => {
                            const nextDate = date ?? ''
                            setReminderDate(nextDate)
                            if (!nextDate) setReminderTime('')
                          }}
                          onTimeChange={(time) => setReminderTime(time ?? '')}
                          placeholder={t('tasks.drawer.setReminder')}
                          ariaLabel={t('tasks.drawer.reminder')}
                          className="w-full"
                          triggerClassName="task-detail-picker rounded-[14px]"
                        />
                      </label>
                    </div>

                    {/* Date range */}
                    <label className="grid gap-1.5">
                      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{t('tasks.drawer.dateRange')}</span>
                      <DateRangePicker
                        value={{ startDate, endDate }}
                        className="task-detail-picker rounded-[14px]"
                        onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                          setStartDate(nextStartDate ?? '')
                          setEndDate(nextEndDate ?? '')
                        }}
                      />
                    </label>

                    {/* Summary */}
                    <label className="grid gap-1.5">
                      <span className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">{t('tasks.drawer.summary')}</span>
                      <Textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        className="min-h-[90px] resize-none rounded-[16px] border-[#3a3733]/8 bg-[color:var(--bg-muted)] text-[13px] leading-6 shadow-none"
                        placeholder={t('tasks.drawer.summaryPlaceholder')}
                      />
                    </label>
                  </div>
                </section>

                {/* ── TAGS ── */}
                <section
                  className="task-detail-card tdv2-section-enter rounded-[26px] border border-[#3a3733]/6 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]"
                  style={{ animationDelay: '80ms' }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="task-detail-kicker">{t('tasks.drawer.tags')}</p>
                      <h2 className="task-detail-title mt-0.5">{t('tasks.drawer.tagContext')}</h2>
                    </div>
                    <Popover open={tagPickerOpen} onOpenChange={setTagPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" size="sm"
                          className="h-8 rounded-full border-[#3a3733]/12 px-3.5 text-[11px] font-semibold hover:bg-[color:var(--surface-hover)]">
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          {t('tasks.drawer.newTag')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[260px] rounded-[20px] border border-[#3a3733]/8 p-3 shadow-[0_20px_50px_rgba(15,23,42,0.12)]" align="end" sideOffset={10}>
                        <div className="space-y-2.5">
                          <div className="space-y-0.5">
                            {tagOptions.map((tagName) => {
                              const selected = tags.some((item) => item.toLowerCase() === tagName.toLowerCase())
                              const tone = getTaskTagTone(tagName)
                              return (
                                <button
                                  key={tagName}
                                  type="button"
                                  className={cn(
                                    'flex w-full items-center justify-between rounded-[13px] px-3 py-2 text-left transition-colors',
                                    selected ? 'bg-[color:var(--surface-hover)]' : 'hover:bg-[color:var(--surface-hover)]',
                                  )}
                                  onClick={() => toggleTag(tagName)}
                                >
                                  <span className={cn('task-detail-tag inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', tone.badge)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                                    {tagName}
                                  </span>
                                  {selected ? <Check className="h-3 w-3 text-[color:var(--text-secondary)]" /> : null}
                                </button>
                              )
                            })}
                          </div>
                          <form
                            className="flex items-center gap-2"
                            onSubmit={(event) => { event.preventDefault(); addCustomTag() }}
                          >
                            <Input
                              value={tagDraft}
                              onChange={(event) => setTagDraft(event.target.value)}
                              placeholder={t('tasks.drawer.customTag')}
                              className="h-9 rounded-[12px] border-[#3a3733]/8 bg-[color:var(--bg-muted)] text-[13px]"
                            />
                            <Button type="submit" size="sm" className="h-9 shrink-0 rounded-full px-3.5 text-[11px] font-semibold" disabled={!tagDraft.trim()}>
                              {t('tasks.drawer.add')}
                            </Button>
                          </form>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.length > 0 ? (
                      tags.map((tagName) => {
                        const tone = getTaskTagTone(tagName)
                        return (
                          <span key={tagName} className={cn('task-detail-tag inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium', tone.badge)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                            {tagName}
                          </span>
                        )
                      })
                    ) : (
                      <p className="text-[13px] text-[color:var(--text-secondary)]">{t('tasks.drawer.noTags')}</p>
                    )}
                  </div>
                </section>

                {/* ── ACTIVITY ── */}
                <section
                  className="task-detail-card-shell tdv2-section-enter"
                  style={{ animationDelay: '120ms' }}
                >
                  <div className="task-detail-card rounded-[26px] border border-[#3a3733]/6 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                    <p className="task-detail-kicker">{t('tasks.drawer.activity')}</p>
                    <h2 className="task-detail-title mt-0.5">{t('tasks.drawer.systemTimeline')}</h2>
                    <div className="mt-4">
                      {activityLogs.length === 0 ? (
                        <div className="rounded-[16px] border border-dashed border-[#3a3733]/10 bg-[color:var(--bg-muted)] px-4 py-5 text-center text-[13px] text-[color:var(--text-secondary)]">
                          {t('tasks.drawer.noActivity')}
                        </div>
                      ) : (
                        <div className="tdv2-timeline">
                          {activityLogs.map((log, index) => (
                            <div
                              key={log.id}
                              className={cn('tdv2-timeline-item', index < activityLogs.length - 1 && 'tdv2-timeline-item--lined')}
                            >
                              <div className="tdv2-timeline-dot" />
                              <div className="tdv2-timeline-content">
                                <p className="text-[13px] font-medium leading-[1.4] text-[color:var(--text-primary)]">
                                  {localizeActivityMessage(log.message, t)}
                                </p>
                                <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">{formatTaskDateTime(log.createdAt)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </ScrollArea>

            {/* ─── DIVIDER ─── */}
            <button
              type="button"
              aria-label={t('tasks.drawer.resizeColumns')}
              className="group relative h-full cursor-col-resize border-x border-[#3a3733]/6 bg-[color:var(--bg-muted)] transition-colors hover:bg-[color:var(--surface-hover)]"
              onPointerDown={beginSplitResize}
              onDoubleClick={toggleSplitPreset}
            >
              <span className="absolute left-1/2 top-1/2 h-14 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#3a3733]/12 transition-all duration-200 group-hover:h-20 group-hover:bg-[#3a3733]/28" />
            </button>

            {/* ════ RIGHT PANE ════ */}
            <aside className="task-detail-aside flex min-h-0 min-w-0 flex-col">
              <ScrollArea className="task-detail-pane task-detail-pane--right min-h-0 min-w-0 flex-1">
                <div className="task-detail-column min-w-0 space-y-4 px-5 py-6">

                  {/* ── SUBTASKS ── */}
                  <section
                    className="task-detail-card task-detail-card--side tdv2-section-enter rounded-[24px] border border-[#3a3733]/6 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.05)]"
                    style={{ animationDelay: '60ms' }}
                  >
                    {/* Header row */}
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="task-detail-kicker flex items-center gap-1">
                          {t('tasks.drawer.subtasks')}
                          <HelpBadge label={t('tasks.drawer.subtasks')}>
                            {t('helpBadge.taskSubtasks')}
                          </HelpBadge>
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <h2 className="task-detail-title">{t('tasks.drawer.executionChecklist')}</h2>
                          {subtasks.length > 0 && (
                            <span className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-colors duration-300',
                              allDone ? 'bg-emerald-100 text-emerald-700' : 'bg-[color:var(--bg-muted)] text-[color:var(--text-secondary)]',
                            )}>
                              {doneCount}/{subtasks.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {/* Progress ring */}
                        {subtasks.length > 0 && (
                          <div className="tdv2-progress-ring">
                            <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                              <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#3a3733]/8" />
                              <circle
                                cx="18" cy="18" r="14"
                                fill="none" stroke="currentColor" strokeWidth="3"
                                strokeDasharray={`${2 * Math.PI * 14}`}
                                strokeDashoffset={`${2 * Math.PI * 14 * (1 - doneCount / subtasks.length)}`}
                                strokeLinecap="round"
                                className={cn(
                                  'transition-all duration-500',
                                  allDone ? 'text-emerald-500' : 'text-teal-500',
                                )}
                              />
                            </svg>
                          </div>
                        )}
                        {/* Filter tabs */}
                        <div className="inline-flex items-center gap-0.5 rounded-full border border-[#3a3733]/8 bg-[color:var(--bg-muted)] p-0.5">
                          {([
                            { key: 'all', label: t('tasks.drawer.subtaskFilterAll') },
                            { key: 'todo', label: t('tasks.drawer.subtaskFilterTodo') },
                            { key: 'done', label: t('tasks.drawer.subtaskFilterDone') },
                          ] as const).map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setSubtaskFilter(option.key)}
                              className={cn(
                                'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-200',
                                subtaskFilter === option.key
                                  ? 'bg-[#3a3733] text-[#f5f3f0] shadow-sm'
                                  : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]',
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Subtask list */}
                    <div className="space-y-1.5">
                      {visibleSubtasks.length > 0 ? (
                        visibleSubtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="group rounded-[15px] border border-[#3a3733]/6 bg-[color:var(--bg-muted)] px-3 py-2.5 transition-all duration-150 hover:border-[#3a3733]/12 hover:shadow-sm"
                          >
                            <div className="task-popup-detail__subtask-checkbox-row flex items-center gap-2.5">
                              <AnimatedPlanCheckbox
                                checked={subtask.done}
                                className="shrink-0 self-center"
                                onChange={(event) => {
                                  if (!guardSubtasks()) return
                                  setSubtasks((prev) =>
                                    prev.map((item) => (item.id === subtask.id ? { ...item, done: event.target.checked } : item)),
                                  )
                                }}
                              />
                              <div className="task-popup-detail__subtask-title min-w-0 flex-1">
                                <input
                                  value={subtask.title}
                                  onChange={(event) => {
                                    if (!guardSubtasks()) return
                                    setSubtasks((prev) =>
                                      prev.map((item) => (item.id === subtask.id ? { ...item, title: event.target.value } : item)),
                                    )
                                  }}
                                  placeholder={t('tasks.drawer.subtaskPlaceholder')}
                                  className={cn('task-popup-detail__subtask-title-input', subtask.done && 'is-done')}
                                />
                              </div>
                              <button
                                type="button"
                                aria-label="Remove subtask"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[color:var(--text-secondary)] opacity-0 transition-all duration-150 hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100"
                                onClick={() => {
                                  if (!guardSubtasks()) return
                                  setSubtasks((prev) => prev.filter((item) => item.id !== subtask.id))
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[14px] border border-dashed border-[#3a3733]/10 bg-[color:var(--bg-muted)] px-4 py-5 text-center text-[12px] text-[color:var(--text-secondary)]">
                          {subtasks.length === 0 ? t('tasks.drawer.noSubtasks') : t('tasks.drawer.noSubtasksInFilter')}
                        </div>
                      )}
                    </div>

                    {/* Add subtask composer — aligned with the main task add composer */}
                    <form
                      className="mt-3 w-full"
                      onSubmit={(event) => {
                        event.preventDefault()
                        if (!guardSubtasks()) return
                        void subtaskComposer.submit()
                      }}
                    >
                      <div
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border bg-[color:color-mix(in_srgb,var(--accent-action)_5%,white)] px-3.5 py-2 transition-all duration-300',
                          'border-[color:color-mix(in_srgb,var(--accent-action)_22%,transparent)]',
                          subtaskComposer.value.trim().length > 0
                            ? 'border-[color:color-mix(in_srgb,var(--accent-action)_50%,transparent)] shadow-[0_0_0_3px_rgba(139,94,52,0.10)]'
                            : '',
                        )}
                      >
                        <span
                          className="tasks-fg__hero-plus inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-transparent text-[color:var(--accent-action)] shadow-none"
                          style={{ transition: 'transform 320ms cubic-bezier(0.22,1,0.36,1)' }}
                          aria-hidden="true"
                        >
                          <Plus
                            className={cn(
                              'h-[18px] w-[18px] transition-transform duration-300',
                              subtaskComposer.value.trim().length > 0 ? 'rotate-90 scale-110' : 'rotate-0',
                            )}
                            strokeWidth={2.4}
                          />
                        </span>
                        <input
                          ref={subtaskComposer.inputRef as React.RefObject<HTMLInputElement>}
                          value={subtaskComposer.value}
                          onChange={(event) => subtaskComposer.setValue(event.target.value)}
                          onAnimationEnd={subtaskComposer.clearShake}
                          placeholder={t('tasks.drawer.addSubtask')}
                          className={cn(
                            'tasks-fg__input flex-1 h-auto min-h-0 border-0 bg-transparent px-0 py-0 text-[13px] font-medium shadow-none outline-none placeholder:text-muted-foreground/85 caret-[color:var(--accent-action)] focus-visible:ring-0',
                            subtaskComposer.isShaking && 'is-shaking',
                          )}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!subtaskComposer.canSubmit}
                          className={cn(
                            'tasks-fg__add-btn h-8 shrink-0 gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-none transition-all duration-300',
                            'bg-[color:var(--accent-action)] hover:bg-[color:color-mix(in_srgb,var(--accent-action)_88%,white)] hover:shadow-[0_6px_16px_-6px_rgba(139,94,52,0.5)] active:scale-[0.96]',
                            subtaskComposer.value.trim().length > 0
                              ? 'opacity-100 scale-100 shadow-[0_2px_10px_-2px_rgba(139,94,52,0.4)]'
                              : 'opacity-60 scale-[0.94]',
                          )}
                          style={{ transitionTimingFunction: 'cubic-bezier(0.34,1.56,0.64,1)' }}
                        >
                          {subtasksLocked ? <PremiumMark /> : null}
                          {t('tasks.drawer.add')}
                          <kbd
                            className="inline-flex items-center justify-center rounded border border-current/25 bg-current/10 px-1 font-mono text-[10px] font-normal leading-none opacity-80"
                            style={{ letterSpacing: 0 }}
                          >
                            ⏎
                          </kbd>
                        </Button>
                      </div>
                    </form>
                  </section>

                  {/* ── NOTES ── */}
                  <TaskNotesPanel key={currentTask.id} taskId={currentTask.id} taskTitle={currentTask.title} />

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
