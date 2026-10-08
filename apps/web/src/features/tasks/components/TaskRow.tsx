import { Pin, Repeat, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import { describeTaskRecurrence, formatTaskDate, getTaskCompletion, getTaskPriorityKey, TASK_PRIORITY_CONFIG } from './taskPresentation'
import { isTaskFollowUpDue, isTaskOverdue } from '../domain/taskRules'
import { useI18n } from '../../../shared/i18n/useI18n'
import InkMark from '../../../shared/ui/InkMark'

type TaskRowProject = { id: string; title: string; color?: string }
export type TaskRowVariant = 'todo' | 'doing' | 'done'
export type TaskRowProps = {
  task: TaskItem
  project?: TaskRowProject | null
  index?: number
  ownerName?: string
  variant?: TaskRowVariant
  onClick?: (task: TaskItem) => void
  onCycleStatus?: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
}

/** A task has one readable title and a secondary context line in every queue.
 * Status marks advance the workflow; Enter opens the full task document. */
const TaskRow = ({ task, project, ownerName, variant = 'todo', onClick, onCycleStatus, onDelete, onTogglePin }: TaskRowProps) => {
  const { t } = useI18n()
  const completion = getTaskCompletion(task)
  const dueLabel = formatTaskDate(task.dueDate)
  const isOverdue = isTaskOverdue(task)
  const isFollowUp = isTaskFollowUpDue(task)
  const recurrenceLabel = describeTaskRecurrence(task.recurrence, t)
  const priority = getTaskPriorityKey(task.priority)
  const tag = task.tags.find(value => value.trim() && !['undefined', 'null'].includes(value.trim().toLowerCase()))
  const cycleLabel = variant === 'done' ? t('tasks.status.reopen') : task.status === 'todo' ? t('tasks.status.start') : t('tasks.status.complete')
  const handleCycle = (event: React.MouseEvent | React.KeyboardEvent) => { event.stopPropagation(); onCycleStatus?.(task) }
  return (
    <div className={cn('fg-task-row tasks-workspace-row', `fg-task-row--${variant}`, task.pinned && 'is-pinned', isOverdue && 'is-overdue')} role="button" tabIndex={0}
      onClick={() => onClick?.(task)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter') { event.preventDefault(); onClick?.(task) }
        if (event.key === ' ') { event.preventDefault(); handleCycle(event) }
      }}
      style={{ '--row-accent': project?.color || 'var(--ink-3)' } as React.CSSProperties}>
      <InkMark state={variant} size={16} aria-label={cycleLabel} className="fg-task-row__mark" onClick={handleCycle} />
      <div className="fg-task-row__main">
        <div className="fg-task-row__title-line">
          {task.pinned ? <Pin className="size-3 shrink-0 fill-current text-ink-3" aria-hidden /> : null}
          <span className={cn('fg-task-row__title', `fg-task-row__title--${variant}`)}>{task.title}</span>
        </div>
        <div className="fg-task-row__meta">
          {priority !== 'none' ? <span className={cn('fg-task-row__meta-piece', priority === 'high' ? 'text-tone-urgent' : priority === 'medium' ? 'text-tone-warn' : 'text-ink-3')}>{t(TASK_PRIORITY_CONFIG[priority].labelKey)}</span> : null}
          {task.status === 'waiting' ? <span className={cn('fg-task-row__meta-piece', isFollowUp && 'text-tone-warn')}>{isFollowUp ? t('tasks.card.followUp') : t('tasks.status.waiting')}{task.waitingOn ? ` · ${task.waitingOn}` : ''}</span> : null}
          {dueLabel ? <span className={cn('fg-task-row__meta-piece', isOverdue && 'is-overdue')}>{isOverdue ? `${t('tasks.row.overdue')} · ` : ''}{dueLabel}</span> : null}
          {completion ? <span className="fg-task-row__meta-piece">{completion.completed}/{completion.total}</span> : null}
          {recurrenceLabel ? <span className="fg-task-row__meta-piece inline-flex items-center gap-1"><Repeat className="size-3" aria-hidden />{recurrenceLabel}</span> : null}
          {ownerName ? <span className="fg-task-row__meta-piece">@{ownerName}</span> : null}
          {project ? <span className="fg-task-row__meta-piece fg-task-row__project"><span className="fg-task-row__project-dot" style={{ background: project.color || 'var(--ink-3)' }} aria-hidden />{project.title}</span> : null}
          {tag ? <span className="fg-task-row__meta-piece">#{tag}</span> : null}
        </div>
      </div>
      <div className="fg-task-row__actions">
        {onTogglePin ? <button type="button" aria-label={t(task.pinned ? 'tasks.card.unpin' : 'tasks.card.pin')} className="fg-task-row__action" onClick={event => { event.stopPropagation(); onTogglePin(task) }}><Pin className="size-3" /></button> : null}
        {onDelete ? <button type="button" aria-label={t('tasks.card.delete')} className="fg-task-row__action fg-task-row__action--danger" onClick={event => { event.stopPropagation(); onDelete(task) }}><Trash2 className="size-3" /></button> : null}
      </div>
    </div>
  )
}
export default TaskRow
