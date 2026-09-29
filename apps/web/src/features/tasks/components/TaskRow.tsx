import { useMemo, useState } from 'react'
import { Pin, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import {
  formatTaskDate,
  getTaskCompletion,
  getTaskDeadlineState,
  getTaskPriorityKey,
} from './taskPresentation'
import { useI18n } from '../../../shared/i18n/useI18n'
import InkMark from '../../../shared/ui/InkMark'

type TaskRowProject = {
  id: string
  title: string
  color?: string
}

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

const isMeaningfulTag = (tag: string | undefined | null): tag is string => {
  if (!tag) return false
  const trimmed = tag.trim()
  if (!trimmed) return false
  if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase() === 'null') return false
  return true
}

const formatIndex = (n: number) => String(n).padStart(2, '0')

// Priority maps to tones (DESIGN.md › Colors): high/medium/low → urgent/warn/ink-3.
const PRIORITY_DOT_COLOR: Record<string, string> = {
  high: 'var(--tone-urgent)',
  medium: 'var(--tone-warn)',
  low: 'var(--ink-3)',
  none: 'var(--ink-4)',
}

const TaskRow = ({
  task,
  project,
  index,
  ownerName,
  variant = task.status as TaskRowVariant,
  onClick,
  onCycleStatus,
  onDelete,
  onTogglePin,
}: TaskRowProps) => {
  const { t } = useI18n()
  const [hover, setHover] = useState(false)
  const priorityKey = getTaskPriorityKey(task.priority)
  const completion = getTaskCompletion(task)
  const deadline = getTaskDeadlineState(task)
  const dueLabel = formatTaskDate(task.dueDate)
  const accent = project?.color || 'var(--ink-3)'
  const firstTag = useMemo(() => task.tags.find(isMeaningfulTag), [task.tags])
  const isOverdue = deadline.daysRemaining !== null && deadline.daysRemaining < 0 && task.status !== 'done'
  const isHighPriority = priorityKey === 'high'

  const handleCycle = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    onCycleStatus?.(task)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onClick?.(task)
    } else if (e.key === ' ') {
      e.preventDefault()
      handleCycle(e)
    }
  }

  if (variant === 'done') {
    return (
      <div
        className={cn('fg-task-row fg-task-row--done', task.pinned && 'is-pinned')}
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(task)}
        onKeyDown={handleKey}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <InkMark state="done" size={14} aria-label="Reopen task" className="fg-task-row__mark" onClick={handleCycle} />
        <span className="fg-task-row__title fg-task-row__title--done">
          {task.title || '(untitled)'}
        </span>
        {hover && onDelete ? (
          <button
            type="button"
            aria-label="Delete"
            className="fg-task-row__action fg-task-row__action--quiet"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task)
            }}
          >
            <Trash2 className="size-3" strokeWidth={1.6} />
          </button>
        ) : null}
      </div>
    )
  }

  if (variant === 'doing') {
    return (
      <div
        className={cn(
          'fg-task-row fg-task-row--doing',
          isHighPriority && 'is-high',
          task.pinned && 'is-pinned',
          isOverdue && 'is-overdue',
        )}
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(task)}
        onKeyDown={handleKey}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ ['--row-accent' as string]: accent }}
      >
        {isOverdue ? <span className="fg-task-row__overdue-mark" aria-hidden /> : null}

        <InkMark state="doing" aria-label="Mark complete" className="fg-task-row__mark" onClick={handleCycle} />

        <div className="fg-task-row__main">
          <div className="fg-task-row__title-line">
            {task.pinned ? <span className="fg-task-row__pin-mark" aria-hidden>✦</span> : null}
            <span className="fg-task-row__title fg-task-row__title--doing">
              {task.title || '(untitled)'}
            </span>
            {completion ? (
              <span className="fg-task-row__progress">
                {completion.completed}/{completion.total}
              </span>
            ) : null}
          </div>
          <div className="fg-task-row__meta">
            {dueLabel ? (
              <span className={cn('fg-task-row__meta-piece', isOverdue && 'is-overdue')}>
                {isOverdue ? `${t('tasks.row.overdue')} ` : `${t('tasks.row.due')} `}
                {dueLabel}
              </span>
            ) : null}
            {ownerName ? <span className="fg-task-row__meta-piece">@{ownerName}</span> : null}
            {project ? (
              <span className="fg-task-row__meta-piece fg-task-row__project">
                <span className="fg-task-row__project-dot" style={{ background: accent }} aria-hidden />
                {project.title}
              </span>
            ) : null}
            {firstTag ? (
              <span className="fg-task-row__meta-piece fg-task-row__tag">#{firstTag}</span>
            ) : null}
          </div>
        </div>

        <div className={cn('fg-task-row__actions', hover && 'is-visible')}>
          {onTogglePin ? (
            <button
              type="button"
              aria-label={task.pinned ? 'Unpin' : 'Pin'}
              className="fg-task-row__action"
              onClick={(e) => {
                e.stopPropagation()
                onTogglePin(task)
              }}
            >
              <Pin className={cn('size-3.5', task.pinned && 'fg-task-row__pin-active')} strokeWidth={1.6} />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label="Delete"
              className="fg-task-row__action fg-task-row__action--danger"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task)
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={1.6} />
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // todo variant — numbered ledger row
  return (
    <div
      className={cn(
        'fg-task-row fg-task-row--todo',
        task.pinned && 'is-pinned',
        isOverdue && 'is-overdue',
      )}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(task)}
      onKeyDown={handleKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ['--row-accent' as string]: accent }}
    >
      {isOverdue ? <span className="fg-task-row__overdue-mark" aria-hidden /> : null}

      <span className="fg-task-row__index">{typeof index === 'number' ? `№${formatIndex(index + 1)}` : ''}</span>

      <InkMark state="todo" size={15} aria-label="Advance status" className="fg-task-row__mark" onClick={handleCycle} />

      <span
        className="fg-task-row__priority"
        style={{ background: PRIORITY_DOT_COLOR[priorityKey] }}
        aria-hidden
        title={priorityKey === 'none' ? '' : priorityKey}
      />

      {task.pinned ? <span className="fg-task-row__pin-mark" aria-hidden>✦</span> : null}

      <span className="fg-task-row__title fg-task-row__title--todo">
        {task.title || '(untitled)'}
      </span>

      <div className="fg-task-row__trailing">
        {completion ? (
          <span className="fg-task-row__progress">
            {completion.completed}/{completion.total}
          </span>
        ) : null}
        {firstTag ? (
          <span className="fg-task-row__tag">#{firstTag}</span>
        ) : null}
        {dueLabel ? (
          <span className={cn('fg-task-row__due', isOverdue && 'is-overdue')}>{dueLabel}</span>
        ) : null}
        {project ? (
          <span
            className="fg-task-row__project-dot"
            style={{ background: accent }}
            title={project.title}
            aria-hidden
          />
        ) : null}
      </div>

      <div className={cn('fg-task-row__actions', hover && 'is-visible')}>
        {onTogglePin ? (
          <button
            type="button"
            aria-label={task.pinned ? 'Unpin' : 'Pin'}
            className="fg-task-row__action"
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin(task)
            }}
          >
            <Pin className={cn('size-3', task.pinned && 'fg-task-row__pin-active')} strokeWidth={1.6} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            aria-label="Delete"
            className="fg-task-row__action fg-task-row__action--danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(task)
            }}
          >
            <Trash2 className="size-3" strokeWidth={1.6} />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default TaskRow
