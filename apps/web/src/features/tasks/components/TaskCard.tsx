import { forwardRef, useState } from 'react'
import { Calendar, CircleCheck, Circle, GitBranch, ListChecks, LockKeyhole, Pin, PinOff, Play, RotateCcw, SunMedium, Trash2, Undo2 } from 'lucide-react'
import type { CSSProperties, HTMLAttributes } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import type { TaskItem } from '../tasks.types'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, getTaskDeadlineState, getTaskPriorityKey, getTaskTagTone } from './taskPresentation'

type TaskCardProject = {
  id: string
  title: string
  color?: string
}

type TaskCardProps = {
  task: TaskItem
  project?: TaskCardProject | null
  onSelect: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
  onToggleToday?: (task: TaskItem) => void
  onProjectClick?: (projectId: string) => void
  dependencyTasks?: TaskItem[]
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
      project,
      onSelect,
      onDelete,
      onTogglePin,
      onToggleToday,
      onProjectClick,
      dependencyTasks = [],
      statusActions,
      dragAttributes,
      dragListeners,
      interactive = true,
      style,
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

    const subtasks = task.subtasks ?? []
    const totalSubtasks = subtasks.length
    const doneSubtasks = subtasks.filter((s) => s.done).length
    const pendingSubtasks = subtasks.filter((s) => !s.done)
    const SUBTASK_PEEK_LIMIT = 4
    const visibleSubtasks = pendingSubtasks.slice(0, SUBTASK_PEEK_LIMIT)
    const remainingSubtasks = pendingSubtasks.length - visibleSubtasks.length
    const hasSubtasks = totalSubtasks > 0
    const showHoverPanel = isHovered && pendingSubtasks.length > 0
    const blockedCount = task.blockedByTaskIds?.length ?? 0
    const dependencyCount = task.dependencyTaskIds?.length ?? 0
    const isBlocked = task.isBlocked || blockedCount > 0

    useVisibleInterval(() => setNow(Date.now()), 60_000, { runOnVisible: true })

    const deadline = getTaskDeadlineState(task, now)

    const activateTask = (cardElement: HTMLDivElement) => {
      setIsHovered(false)
      cardElement.blur()
      const handler = onClick ?? onSelect
      handler(task)
    }

    const priorityStripeClass =
      priorityKey === 'high' ? 'task-card--priority-high' :
      priorityKey === 'medium' ? 'task-card--priority-medium' :
      priorityKey === 'low' ? 'task-card--priority-low' : ''

    return (
      <div
        ref={ref}
        className={cn(
          'task-card-shell group relative overflow-hidden cursor-pointer rounded-lg bg-card shadow-[0_2px_6px_rgba(58,55,51,0.08)]',
          'hover:-translate-y-[2px] hover:shadow-[0_10px_24px_rgba(58,55,51,0.14)]',
          task.status === 'done' && 'opacity-70',
          compact && 'rounded-md',
          selected && 'ring-2 ring-[#3A3733]/35',
          deadline.shellClass,
          priorityStripeClass,
        )}
        style={style}
        data-priority={priorityKey}
        data-status={task.status}
        {...(interactive ? dragAttributes : undefined)}
        {...(interactive ? dragListeners : undefined)}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(event) => activateTask(event.currentTarget)}
        onKeyDown={(event) => {
          if (!interactive || event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            activateTask(event.currentTarget)
          }
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
                'task-card__title flex-1 text-[0.95rem] font-semibold leading-[1.35] tracking-[0.005em] line-clamp-2 transition-colors duration-300',
                task.status === 'done' ? 'text-muted-foreground line-through decoration-[#3A3733]/30' : 'text-foreground',
              )}
            >
              {task.title}
            </h4>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {priorityKey !== 'none' ? (
              <span
                className={cn('task-card__priority-badge inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold', priorityCfg.badge)}
                data-priority={priorityKey}
              >
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
            <span
              className={cn('task-card__status-badge inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold', statusCfg.badge)}
              data-status={task.status}
            >
              {t(statusCfg.labelKey)}
            </span>
            {hasSubtasks ? (
              <span
                className={cn(
                  'task-card__subtask-progress inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                  doneSubtasks === totalSubtasks
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-[#3A3733]/6 text-muted-foreground',
                )}
              >
                <ListChecks className="size-3" />
                <span className="tabular-nums">{doneSubtasks}/{totalSubtasks}</span>
              </span>
            ) : null}
            {isBlocked ? (
              <span className="task-card__blocked-chip inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold">
                <LockKeyhole className="size-3" />
                Blocked by {blockedCount || dependencyCount}
              </span>
            ) : dependencyCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded border border-[#3A3733]/10 px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                <GitBranch className="size-3" />
                {dependencyCount} dep
              </span>
            ) : null}
          </div>

          {task.tags.length > 0 || project ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {project ? (
                <button
                  type="button"
                  className="task-card__project-chip inline-flex max-w-[140px] items-center gap-1.5 rounded-full bg-[#F5F3F0] px-2 py-0.5 text-[11px] font-medium text-[#3A3733] transition-colors hover:bg-[#ECE8E1]"
                  aria-label={t('tasks.card.projectBadgeAria', { title: project.title })}
                  title={project.title}
                  onClick={(event) => {
                    event.stopPropagation()
                    onProjectClick?.(project.id)
                  }}
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: project.color ?? '#3A3733' }}
                    aria-hidden
                  />
                  <span className="truncate">{project.title}</span>
                </button>
              ) : null}
              {displayTags.map((tag) => {
                const tone = getTaskTagTone(tag)
                return (
                  <span key={tag} className={cn('task-card__tag inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium', tone.badge)}>
                    <span className={cn('size-1.5 rounded-full', tone.dot)} />
                    {tag}
                  </span>
                )
              })}
              {extraTagCount > 0 ? <span className="px-1 text-xs text-muted-foreground">+{extraTagCount}</span> : null}
            </div>
          ) : null}

          {isBlocked && dependencyTasks.length > 0 && !selectionMode ? (
            <div className="task-card__dependency-mini" aria-label={`Blocked by ${dependencyTasks.length} tasks`}>
              {dependencyTasks.slice(0, 3).map((dependency) => (
                <div key={dependency.id} className="task-card__dependency-row">
                  <span className={`task-card__dependency-status task-card__dependency-status--${dependency.status}`} aria-hidden />
                  <span className="truncate">{dependency.title}</span>
                  <span>{dependency.status}</span>
                </div>
              ))}
              {dependencyTasks.length > 3 ? (
                <div className="task-card__dependency-more">+{dependencyTasks.length - 3} more blockers</div>
              ) : null}
            </div>
          ) : null}

          {hasSubtasks && !selectionMode ? (
            <div
              data-testid="task-card-subtasks"
              className={cn(
                'task-card__subtasks grid overflow-hidden transition-all duration-200 ease-out',
                showHoverPanel ? 'grid-rows-[1fr] opacity-100 pt-1.5' : 'grid-rows-[0fr] opacity-0 pt-0',
              )}
              aria-hidden={!showHoverPanel}
            >
              <div className="min-h-0 overflow-hidden">
                <ul className="flex flex-col gap-1 border-t border-[#3A3733]/8 pt-1.5">
                  {visibleSubtasks.map((subtask) => (
                    <li
                      key={subtask.id}
                      className="flex items-start gap-1.5 text-[12.5px] leading-[1.4] text-muted-foreground"
                    >
                      <Circle className="mt-[3px] size-3 shrink-0 text-[#3A3733]/35" />
                      <span className="line-clamp-1 flex-1">{subtask.title}</span>
                    </li>
                  ))}
                  {remainingSubtasks > 0 ? (
                    <li className="pl-[18px] text-[11.5px] font-medium text-muted-foreground/80">
                      {t('tasks.card.subtaskMore', { n: remainingSubtasks })}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          ) : null}

          {!selectionMode ? (
            <div
              data-testid="task-card-actions"
              className={cn(
                'task-card__actions grid overflow-hidden group-focus-within:grid-rows-[1fr] group-focus-within:translate-y-0 group-focus-within:pt-1.5 group-focus-within:opacity-100',
                isHovered ? 'grid-rows-[1fr] translate-y-0 pt-1.5 opacity-100' : 'grid-rows-[0fr] -translate-y-2 pt-0 opacity-0',
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="flex items-center gap-0.5 border-t border-[#3A3733]/8 pt-1.5">
                  {statusActions?.map((action) => {
                    const icon =
                      action.key === 'doing' || action.key === 'start' ? Play :
                      action.key === 'done' ? CircleCheck :
                      action.key === 'todo' && task.status === 'doing' ? Undo2 :
                      RotateCcw
                    const Icon = icon
                    return (
                      <Button
                        key={action.key}
                        variant="ghost"
                        size="icon"
                        aria-label={action.label}
                        title={action.label}
                        className="task-card__action-btn size-7 text-muted-foreground hover:text-foreground"
                        disabled={Boolean(action.disabled || loadingActionKey)}
                        onClick={() => void action.onClick(task)}
                      >
                        <Icon className="size-3.5" />
                      </Button>
                    )
                  })}

                  {onToggleToday ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={task.isToday ? t('tasks.today.remove') : t('tasks.today.add')}
                      title={task.isToday ? t('tasks.today.remove') : t('tasks.today.add')}
                      className={cn(
                        'task-card__action-btn size-7 hover:text-foreground',
                        task.isToday ? 'text-amber-600' : 'text-muted-foreground',
                      )}
                      onClick={() => onToggleToday(task)}
                    >
                      <SunMedium className="size-3.5" />
                    </Button>
                  ) : null}

                  <div className="flex-1" />

                  {onTogglePin ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={task.pinned ? t('tasks.card.unpin') : t('tasks.card.pin')}
                      title={task.pinned ? t('tasks.card.unpin') : t('tasks.card.pin')}
                      className="task-card__action-btn size-7 text-muted-foreground"
                      onClick={() => onTogglePin(task)}
                    >
                      {task.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('tasks.card.delete')}
                      title={t('tasks.card.delete')}
                      className="task-card__action-btn size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(task)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  ) : null}
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
