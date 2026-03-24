import { forwardRef, useEffect, useState } from 'react'
import { Calendar, CircleCheck, Crosshair, Ellipsis, Pin, PinOff, Play, RotateCcw, Trash2 } from 'lucide-react'
import type { CSSProperties, HTMLAttributes } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaskItem } from '../tasks.types'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, getTaskDeadlineState, getTaskPriorityKey, getTaskTagTone } from './taskPresentation'

type TaskCardProps = {
  task: TaskItem
  onSelect: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
  statusActions?: {
    key: string
    label: string
    onClick: (task: TaskItem) => Promise<void> | void
    disabled?: boolean
  }[]
  dragAttributes?: HTMLAttributes<HTMLDivElement>
  dragListeners?: HTMLAttributes<HTMLDivElement>
  interactive?: boolean
  style?: CSSProperties
  onFocusStart?: (task: TaskItem) => void
  loadingActionKey?: string | null
  successActionKey?: string | null
  compact?: boolean
  onClick?: (task: TaskItem) => void
  selected?: boolean
  selectionMode?: boolean
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(
  (
    {
      task,
      onSelect,
      onDelete,
      onTogglePin,
      statusActions,
      dragAttributes,
      dragListeners,
      interactive = true,
      style,
      onFocusStart,
      loadingActionKey,
      compact = false,
      onClick,
      selected = false,
      selectionMode = false,
    },
    ref,
    ) => {
    const { t } = useI18n()
    const [isHovered, setIsHovered] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const priorityKey = getTaskPriorityKey(task.priority)
    const priorityCfg = TASK_PRIORITY_CONFIG[priorityKey]
    const statusCfg = TASK_STATUS_CONFIG[task.status]
    const displayTags = task.tags.slice(0, 2)
    const extraTagCount = task.tags.length - 2

    useEffect(() => {
      const timer = window.setInterval(() => setNow(Date.now()), 60_000)
      return () => window.clearInterval(timer)
    }, [])

    const deadline = getTaskDeadlineState(task, now)

    return (
      <div
        ref={ref}
        className={cn(
          'task-card-shell group relative overflow-hidden cursor-pointer rounded-lg bg-card shadow-[0_3px_10px_rgba(58,55,51,0.1)]',
          'hover:-translate-y-[1px] hover:shadow-[0_8px_18px_rgba(58,55,51,0.13)]',
          task.status === 'done' && 'opacity-75',
          compact && 'rounded-md',
          selected && 'ring-2 ring-[#3A3733]/35',
          deadline.shellClass,
        )}
        style={style}
        {...(interactive ? dragAttributes : undefined)}
        {...(interactive ? dragListeners : undefined)}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => (onClick ?? onSelect)(task)}
        onKeyDown={(event) => {
          if (!interactive || event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') (onClick ?? onSelect)(task)
        }}
      >
        {selectionMode ? (
          <span
            className={cn(
              'absolute left-2 top-2 z-[2] inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-[10px] font-semibold',
              selected ? 'border-[#3A3733]/35 bg-[#3A3733] text-[#F5F3F0]' : 'border-[#3A3733]/18 bg-white text-[#3A3733]',
            )}
          >
            {selected ? '✓' : ''}
          </span>
        ) : null}
        {priorityKey !== 'none' ? <div className={cn('task-card__priority-flag', priorityCfg.dot)} aria-hidden /> : null}

        <div className="space-y-2.5 p-3.5">
          <div className="flex items-start gap-2">
            {task.pinned ? <Pin className="mt-0.5 size-3.5 shrink-0 fill-amber-500 text-amber-500" /> : null}
            <h4
              className={cn(
                'task-card__title flex-1 text-[0.95rem] font-semibold leading-[1.35] tracking-[0.005em] line-clamp-2',
                task.status === 'done' && 'text-muted-foreground line-through',
              )}
            >
              {task.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {priorityKey !== 'none' ? (
              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold', priorityCfg.badge)}>
                <span className={cn('size-1.5 rounded-full', priorityCfg.dot)} />
                {t(priorityCfg.labelKey)}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className={cn('inline-flex items-center gap-1 text-xs', deadline.textClass)}>
                <Calendar className="size-3" />
                <span>{formatDate(task.dueDate)}</span>
                {deadline.label ? <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', deadline.badgeClass)}>{deadline.label}</span> : null}
              </span>
            ) : null}
            <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold', statusCfg.badge)}>
              {t(statusCfg.labelKey)}
            </span>
          </div>

          {task.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {displayTags.map((tag) => {
                const tone = getTaskTagTone(tag)
                return (
                  <span key={tag} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', tone.badge)}>
                    <span className={cn('size-1.5 rounded-full', tone.dot)} />
                    {tag}
                  </span>
                )
              })}
              {extraTagCount > 0 ? <span className="px-1 text-xs text-muted-foreground">+{extraTagCount}</span> : null}
            </div>
          ) : null}

          {!selectionMode ? (
            <div
              data-testid="task-card-actions"
              className={cn(
                'task-card__actions grid overflow-hidden group-focus-within:grid-rows-[1fr] group-focus-within:translate-y-0 group-focus-within:pt-1 group-focus-within:opacity-100',
                isHovered ? 'grid-rows-[1fr] translate-y-0 pt-1 opacity-100' : 'grid-rows-[0fr] -translate-y-1 pt-0 opacity-0',
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex items-center gap-0.5 border-t border-transparent pt-1">
                  {statusActions?.map((action) => {
                    const icon =
                      action.key === 'doing' || action.key === 'start' ? Play :
                      action.key === 'done' ? CircleCheck :
                      RotateCcw
                    const Icon = icon
                    return (
                      <Button
                        key={action.key}
                        variant="ghost"
                        size="icon"
                        className="task-card__action-btn size-7 text-muted-foreground hover:text-foreground"
                        disabled={Boolean(action.disabled || loadingActionKey)}
                        onClick={() => void action.onClick(task)}
                      >
                        <Icon className="size-3.5" />
                      </Button>
                    )
                  })}

                  {onFocusStart ? (
                    <Button variant="ghost" size="icon" className="task-card__action-btn size-7 text-muted-foreground hover:text-foreground" onClick={() => onFocusStart(task)}>
                      <Crosshair className="size-3.5" />
                    </Button>
                  ) : null}

                  <div className="flex-1" />

                  {onTogglePin ? (
                    <Button variant="ghost" size="icon" className="task-card__action-btn size-7 text-muted-foreground" onClick={() => onTogglePin(task)}>
                      {task.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button variant="ghost" size="icon" className="task-card__action-btn size-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="task-card__action-btn size-7 text-muted-foreground">
                    <Ellipsis className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)

TaskCard.displayName = 'TaskCard'

export default TaskCard
