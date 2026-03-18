import { forwardRef, useEffect, useRef, useState } from 'react'
import { Calendar, CircleCheck, Crosshair, Ellipsis, MessageSquarePlus, Pin, PinOff, Play, RotateCcw, Trash2 } from 'lucide-react'
import type { CSSProperties, HTMLAttributes } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, getTaskPriorityKey, getTaskTagTone } from './taskPresentation'

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
  progressComposer?: {
    isOpen: boolean
    value: string
    placeholder?: string
    disabled?: boolean
    onToggle: (task: TaskItem) => void
    onChange: (value: string) => void
    onSubmit: (task: TaskItem) => void
    onCancel: (task: TaskItem) => void
  }
  dragAttributes?: HTMLAttributes<HTMLDivElement>
  dragListeners?: HTMLAttributes<HTMLDivElement>
  interactive?: boolean
  style?: CSSProperties
  onFocusStart?: (task: TaskItem) => void
  loadingActionKey?: string | null
  successActionKey?: string | null
  compact?: boolean
  onClick?: (task: TaskItem) => void
}

const TODAY = new Date('2026-03-12')

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
      progressComposer,
      dragAttributes,
      dragListeners,
      interactive = true,
      style,
      onFocusStart,
      loadingActionKey,
      compact = false,
      onClick,
    },
    ref,
  ) => {
    const [isHovered, setIsHovered] = useState(false)
    const progressInputRef = useRef<HTMLTextAreaElement | null>(null)
    const priorityKey = getTaskPriorityKey(task.priority)
    const priorityCfg = TASK_PRIORITY_CONFIG[priorityKey]
    const statusCfg = TASK_STATUS_CONFIG[task.status]
    const displayTags = task.tags.slice(0, 2)
    const extraTagCount = task.tags.length - 2
    const isOverdue = task.dueDate != null && new Date(task.dueDate) < TODAY && task.status !== 'done'

    useEffect(() => {
      if (!progressComposer?.isOpen) return
      const node = progressInputRef.current
      if (!node) return
      requestAnimationFrame(() => node.focus())
    }, [progressComposer?.isOpen])

    return (
      <div
        ref={ref}
        className={cn(
          'task-card-shell group relative overflow-hidden cursor-pointer rounded-lg border bg-card shadow-[0_10px_26px_rgba(15,23,42,0.04)]',
          'hover:-translate-y-[1px] hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]',
          task.pinned && 'border-l-2 border-l-amber-400',
          task.status === 'done' && 'opacity-75',
          compact && 'rounded-md',
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
        {priorityKey !== 'none' ? <div className={cn('task-card__priority-flag', priorityCfg.dot)} aria-hidden /> : null}

        <div className="space-y-2.5 p-3.5">
          <div className="flex items-start gap-2">
            {task.pinned ? <Pin className="mt-0.5 size-3.5 shrink-0 fill-amber-500 text-amber-500" /> : null}
            <h4 className={cn('flex-1 text-sm leading-snug line-clamp-2', task.status === 'done' && 'text-muted-foreground line-through')}>
              {task.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {priorityKey !== 'none' ? (
              <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium', priorityCfg.badge)}>
                <span className={cn('size-1.5 rounded-full', priorityCfg.dot)} />
                {priorityCfg.label}
              </span>
            ) : null}
            {task.dueDate ? (
              <span className={cn('inline-flex items-center gap-1 text-[11px] text-muted-foreground', isOverdue && 'text-red-500')}>
                <Calendar className="size-3" />
                {formatDate(task.dueDate)}
              </span>
            ) : null}
            <span className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]', statusCfg.badge)}>
              {statusCfg.label}
            </span>
          </div>

          {task.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {displayTags.map((tag) => {
                const tone = getTaskTagTone(tag)
                return (
                  <span key={tag} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium', tone.badge)}>
                    <span className={cn('size-1.5 rounded-full', tone.dot)} />
                    {tag}
                  </span>
                )
              })}
              {extraTagCount > 0 ? <span className="px-1 text-[11px] text-muted-foreground">+{extraTagCount}</span> : null}
            </div>
          ) : null}

          <div
            data-testid="task-card-actions"
            className={cn(
              'task-card__actions grid overflow-hidden group-focus-within:grid-rows-[1fr] group-focus-within:translate-y-0 group-focus-within:pt-1 group-focus-within:opacity-100',
              isHovered || progressComposer?.isOpen ? 'grid-rows-[1fr] translate-y-0 pt-1 opacity-100' : 'grid-rows-[0fr] -translate-y-1 pt-0 opacity-0',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex items-center gap-0.5 border-t border-transparent pt-1">
                {!progressComposer?.isOpen ? (
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => progressComposer?.onToggle(task)}>
                    <MessageSquarePlus className="size-3.5" />
                  </Button>
                ) : (
                  <div className="flex flex-1 items-start gap-2">
                    <textarea
                      ref={progressInputRef}
                      rows={2}
                      value={progressComposer.value}
                      placeholder={progressComposer.placeholder ?? 'Record progress...'}
                      className="min-h-[56px] flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
                      onChange={(event) => progressComposer.onChange(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') progressComposer.onCancel(task)
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          progressComposer.onSubmit(task)
                        }
                      }}
                    />
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => progressComposer.onSubmit(task)}>
                      Save
                    </Button>
                  </div>
                )}

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
                      className="size-7 text-muted-foreground hover:text-foreground"
                      disabled={Boolean(action.disabled || loadingActionKey)}
                      onClick={() => void action.onClick(task)}
                    >
                      <Icon className="size-3.5" />
                    </Button>
                  )
                })}

                {onFocusStart ? (
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground" onClick={() => onFocusStart(task)}>
                    <Crosshair className="size-3.5" />
                  </Button>
                ) : null}

                <div className="flex-1" />

                {onTogglePin ? (
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => onTogglePin(task)}>
                    {task.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                  </Button>
                ) : null}
                {onDelete ? (
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(task)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                  <Ellipsis className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

TaskCard.displayName = 'TaskCard'

export default TaskCard
