import { forwardRef, useState } from 'react'
import { CircleCheck, Circle, GitBranch, LockKeyhole, Pin, PinOff, Play, RotateCcw, SunMedium, Trash2, Undo2 } from 'lucide-react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import type { TaskItem } from '../tasks.types'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG, getTaskDeadlineState, getTaskPriorityKey } from './taskPresentation'

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

const formatDate = (value: string, language: string) =>
  new Date(value).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
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
    const { t, language } = useI18n()
    const [isHovered, setIsHovered] = useState(false)
    const [now, setNow] = useState(() => Date.now())
    const priorityKey = getTaskPriorityKey(task.priority)
    const priorityCfg = TASK_PRIORITY_CONFIG[priorityKey]
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

    const deadlineText =
      deadline.daysRemaining == null || deadline.daysRemaining > 3
        ? null
        : deadline.daysRemaining < 0
          ? t('tasks.card.overdue', { n: -deadline.daysRemaining })
          : deadline.daysRemaining === 0
            ? t('tasks.card.dueToday')
            : t('tasks.card.dueSoon', { n: deadline.daysRemaining })

    const metaItems: { key: string; node: ReactNode }[] = []
    if (priorityKey !== 'none') {
      metaItems.push({
        key: 'priority',
        node: (
          <span className="task-card__priority-badge" data-priority={priorityKey}>
            <span className={cn('task-card__priority-dot', priorityCfg.dot)} aria-hidden />
            {t(priorityCfg.labelKey)}
          </span>
        ),
      })
    }
    if (task.dueDate) {
      metaItems.push({
        key: 'due',
        node: (
          <span className={cn('task-card__due', task.status !== 'done' && deadline.textClass)}>
            {formatDate(task.dueDate, language)}
            {deadlineText && task.status !== 'done' ? <> · {deadlineText}</> : null}
          </span>
        ),
      })
    }
    if (hasSubtasks) {
      metaItems.push({
        key: 'subtasks',
        node: (
          <span className={cn('task-card__subtask-progress tabular-nums', doneSubtasks === totalSubtasks && 'text-tone-done')}>
            {doneSubtasks}/{totalSubtasks}
          </span>
        ),
      })
    }
    if (isBlocked) {
      metaItems.push({
        key: 'blocked',
        node: (
          <span className="task-card__blocked-chip">
            <LockKeyhole className="size-3" aria-hidden />
            {blockedCount || dependencyCount
              ? t('tasks.card.blockedBy', { n: blockedCount || dependencyCount })
              : t('tasks.card.blocked')}
          </span>
        ),
      })
    } else if (dependencyCount > 0) {
      metaItems.push({
        key: 'deps',
        node: (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="size-3" aria-hidden />
            {t('tasks.card.dependencies', { n: dependencyCount })}
          </span>
        ),
      })
    }

    return (
      <div
        ref={ref}
        className={cn(
          'task-card-shell group relative overflow-hidden cursor-pointer',
          task.status === 'done' && 'opacity-70',
          compact && 'rounded-md',
          selected && 'ring-2 ring-[color-mix(in_srgb,var(--text-primary)_35%,transparent)] dark:ring-white/40',
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
              'absolute left-2 top-2 z-[2] inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1 text-meta font-semibold',
              selected ? 'border-[color-mix(in_srgb,var(--text-primary)_35%,transparent)] bg-[var(--text-primary)] text-[var(--bg-elevated)]' : 'border-[color-mix(in_srgb,var(--text-primary)_18%,transparent)] bg-[var(--bg-elevated)] text-[var(--text-primary)]',
            )}
          >
            {selected ? '✓' : ''}
          </span>
        ) : null}

        <div className="space-y-2.5 p-3.5">
          <div className="flex items-start gap-2">
            {task.pinned ? <Pin className="mt-0.5 size-3.5 shrink-0 fill-current text-ink-3" aria-hidden /> : null}
            <h4
              className={cn(
                'task-card__title flex-1 text-body font-semibold line-clamp-2 transition-colors duration-300',
                task.status === 'done' ? 'text-ink-3 line-through decoration-[color-mix(in_srgb,var(--ink-1)_30%,transparent)]' : 'text-ink-1',
              )}
            >
              {task.title}
            </h4>
          </div>

          {/* Paper & Ink meta line: one quiet row joined by "·". Only what needs
              action carries a tone (an overdue or imminent date, a blocker). */}
          {metaItems.length > 0 ? (
            <div className="task-card__meta">
              {metaItems.map((item, index) => (
                <span key={item.key} className="task-card__meta-item">
                  {index > 0 ? <span className="task-card__meta-sep" aria-hidden>·</span> : null}
                  {item.node}
                </span>
              ))}
            </div>
          ) : null}

          {task.tags.length > 0 || project ? (
            <div className="task-card__context">
              {project ? (
                <button
                  type="button"
                  className="task-card__project-chip"
                  aria-label={t('tasks.card.projectBadgeAria', { title: project.title })}
                  title={project.title}
                  onClick={(event) => {
                    event.stopPropagation()
                    onProjectClick?.(project.id)
                  }}
                >
                  <span
                    className="task-card__project-mark"
                    style={{ background: project.color ?? 'var(--ink-3)' }}
                    aria-hidden
                  />
                  <span className="truncate">{project.title}</span>
                </button>
              ) : null}
              {displayTags.map((tag) => (
                <span key={tag} className="task-card__tag">#{tag}</span>
              ))}
              {extraTagCount > 0 ? <span className="task-card__tag task-card__tag--more">+{extraTagCount}</span> : null}
            </div>
          ) : null}

          {isBlocked && dependencyTasks.length > 0 && !selectionMode ? (
            <div className="task-card__dependency-mini" aria-label={t('tasks.card.blockedAria', { n: dependencyTasks.length })}>
              {dependencyTasks.slice(0, 3).map((dependency) => (
                <div key={dependency.id} className="task-card__dependency-row">
                  <span className={`task-card__dependency-status task-card__dependency-status--${dependency.status}`} aria-hidden />
                  <span className="truncate">{dependency.title}</span>
                  <span>{t(TASK_STATUS_CONFIG[dependency.status].labelKey)}</span>
                </div>
              ))}
              {dependencyTasks.length > 3 ? (
                <div className="task-card__dependency-more">{t('tasks.card.moreBlockers', { n: dependencyTasks.length - 3 })}</div>
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
                <ul className="flex flex-col gap-1 border-t border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] pt-1.5">
                  {visibleSubtasks.map((subtask) => (
                    <li
                      key={subtask.id}
                      className="flex items-start gap-1.5 text-label leading-[1.4] text-muted-foreground"
                    >
                      <Circle className="mt-[3px] size-3 shrink-0 text-[color-mix(in_srgb,var(--text-primary)_35%,transparent)]" />
                      <span className="line-clamp-1 flex-1">{subtask.title}</span>
                    </li>
                  ))}
                  {remainingSubtasks > 0 ? (
                    <li className="pl-[18px] text-label font-medium text-muted-foreground/80">
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
                <div className="flex items-center gap-0.5 border-t border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] pt-1.5">
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
                        task.isToday ? 'task-card__action-btn--today-active text-[var(--accent)]' : 'text-muted-foreground',
                      )}
                      data-today-active={task.isToday ? 'true' : 'false'}
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
