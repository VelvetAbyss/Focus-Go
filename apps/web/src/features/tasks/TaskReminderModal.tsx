import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Check, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ROUTES } from '../../app/routes/routes'
import { tasksRepo } from '../../data/repositories/tasksRepo'
import { useI18n } from '../../shared/i18n/useI18n'
import { emitTasksChanged } from './taskSync'
import { reminderQueueStore, useReminderQueue } from './reminderQueueStore'
import { formatTaskDateTime } from './components/taskPresentation'

const FIVE_MIN = 5 * 60 * 1000
const FIFTEEN_MIN = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000
const ONE_DAY = 24 * 60 * 60 * 1000

const TaskReminderModal = () => {
  const { t } = useI18n()
  const queue = useReminderQueue()
  const [busy, setBusy] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)

  const head = queue[0] ?? null
  const total = queue.length
  const totalLabel = useMemo(
    () => (total > 1 ? t('tasks.reminder.queueCounter', { current: 1, total }) : ''),
    [total, t],
  )

  if (!head) return null

  const dismiss = () => {
    reminderQueueStore.dismiss(head.taskId)
  }

  const handleSnooze = async (deltaMs: number) => {
    if (busy) return
    setBusy(true)
    try {
      const nextReminderAt = Date.now() + deltaMs
      const updated = { ...head.task, reminderAt: nextReminderAt, reminderFiredAt: undefined }
      await tasksRepo.update(updated)
      emitTasksChanged('reminder-snooze')
      dismiss()
    } catch (error) {
      console.error('[TaskReminderModal] snooze failed', error)
    } finally {
      setBusy(false)
    }
  }

  const handleMarkDone = async () => {
    if (busy) return
    setBusy(true)
    try {
      await tasksRepo.updateStatus(head.taskId, 'done')
      emitTasksChanged('reminder-mark-done')
      dismiss()
    } catch (error) {
      console.error('[TaskReminderModal] mark done failed', error)
    } finally {
      setBusy(false)
    }
  }

  const dueLabel = head.task.endDate || head.task.dueDate
  const progressPreview = head.task.progressNote?.trim()

  return (
    <Dialog open onOpenChange={(open) => (open ? null : dismiss())}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlarmClock className="h-4 w-4 text-amber-500" />
              {t('tasks.reminder.modalTitle')}
            </DialogTitle>
            {totalLabel ? <span className="text-muted-foreground text-xs">{totalLabel}</span> : null}
          </div>
          <DialogDescription className="text-foreground mt-1 text-base font-semibold">
            {head.task.title?.trim() || 'Untitled task'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {dueLabel ? (
            <p className="text-muted-foreground">
              <span className="font-semibold">{t('tasks.reminder.dueLabel')}：</span>
              {dueLabel}
              {head.task.reminderAt ? <span className="ml-2 opacity-70">· {formatTaskDateTime(head.task.reminderAt)}</span> : null}
            </p>
          ) : null}
          {progressPreview ? (
            <div className="rounded-md border border-amber-300/40 bg-amber-50/60 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700/80">
                {t('tasks.drawer.progressTitle')}
              </p>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[13px] leading-6 text-[color:var(--text-primary)]">
                {progressPreview}
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-row flex-wrap justify-end gap-2 sm:justify-end">
          <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" disabled={busy}>
                {t('tasks.reminder.snooze')}
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 p-1">
              {(
                [
                  { ms: FIVE_MIN, label: t('tasks.reminder.snoozeFiveMin') },
                  { ms: FIFTEEN_MIN, label: t('tasks.reminder.snoozeFifteenMin') },
                  { ms: ONE_HOUR, label: t('tasks.reminder.snoozeOneHour') },
                  { ms: ONE_DAY, label: t('tasks.reminder.snoozeTomorrow') },
                ]
              ).map((option) => (
                <button
                  key={option.ms}
                  type="button"
                  className="hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    setSnoozeOpen(false)
                    void handleSnooze(option.ms)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void handleMarkDone()}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {t('tasks.reminder.markDone')}
          </Button>
          <Button asChild type="button" variant="outline" size="sm">
            <Link to={ROUTES.TASKS} onClick={dismiss}>
              {t('tasks.reminder.openInTasks')}
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={dismiss} disabled={busy}>
            {t('tasks.reminder.dismiss')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default TaskReminderModal
