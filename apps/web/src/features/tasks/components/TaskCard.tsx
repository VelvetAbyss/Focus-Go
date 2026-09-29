import { forwardRef, useEffect, useRef, useState } from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CircleCheck, GitBranch, LockKeyhole, Pin, PinOff, Play, RotateCcw, SunMedium, Trash2, Undo2 } from 'lucide-react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent } from '../../../shared/ui/popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import type { TaskItem } from '../tasks.types'
import { parseDateOnlyToLocalDayStart } from '../domain/taskRules'
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

// How long the pointer has to rest on a card before the subtask/blocker peek
// opens. Sweeping the cursor across the grid must not flash a popover per card.
const PEEK_INTENT_MS = 400
const SUBTASK_PEEK_LIMIT = 4

// Reads the due date through the same strict YYYY-MM-DD parser the deadline,
// Today and calendar logic use, so the card never shows a date the rest of the
// app ignores (it used to print "Invalid Date" for malformed values).
const formatDueDay = (dayStart: number, language: string) =>
  new Date(dayStart).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })

/**
 * Every card has the same shape, so a grid of them lines up:
 *   - the title box always reserves two lines (short titles leave the second
 *     line as air, long ones clamp),
 *   - one footer line sits at the bottom: state on the left ("● 高 · 9月25日 ·
 *     3/5"), the project on the right.
 * Hover never changes the card's size. The footer swaps in place to the action
 * row, and pending subtasks / blockers open in a portaled peek below the card
 * after a short rest, instead of unfolding the card and pushing the grid.
 */
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
    const [peekOpen, setPeekOpen] = useState(false)
    const peekTimerRef = useRef<number | null>(null)
    const [now, setNow] = useState(() => Date.now())
    const priorityKey = getTaskPriorityKey(task.priority)
    const priorityCfg = TASK_PRIORITY_CONFIG[priorityKey]
    const firstTag = task.tags[0]
    const extraTagCount = task.tags.length - 1

    const subtasks = task.subtasks ?? []
    const totalSubtasks = subtasks.length
    const doneSubtasks = subtasks.filter((s) => s.done).length
    const pendingSubtasks = subtasks.filter((s) => !s.done)
    const visibleSubtasks = pendingSubtasks.slice(0, SUBTASK_PEEK_LIMIT)
    const remainingSubtasks = pendingSubtasks.length - visibleSubtasks.length
    const hasSubtasks = totalSubtasks > 0
    const blockedCount = task.blockedByTaskIds?.length ?? 0
    const dependencyCount = task.dependencyTaskIds?.length ?? 0
    const isBlocked = task.isBlocked || blockedCount > 0
    const peekBlockers = isBlocked ? dependencyTasks : []
    const hasPeek = !selectionMode && (pendingSubtasks.length > 0 || peekBlockers.length > 0)

    useVisibleInterval(() => setNow(Date.now()), 60_000, { runOnVisible: true })

    const clearPeekTimer = () => {
      if (peekTimerRef.current != null) {
        window.clearTimeout(peekTimerRef.current)
        peekTimerRef.current = null
      }
    }

    useEffect(() => clearPeekTimer, [])

    const deadline = getTaskDeadlineState(task, now)
    const dueDay = parseDateOnlyToLocalDayStart(task.dueDate)

    const activateTask = (cardElement: HTMLDivElement) => {
      clearPeekTimer()
      setPeekOpen(false)
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

    const metaItems: { key: string; node: ReactNode; shrink?: boolean }[] = []
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
    if (dueDay != null) {
      metaItems.push({
        key: 'due',
        node: (
          <span className={cn('task-card__due', task.status !== 'done' && deadline.textClass)}>
            {formatDueDay(dueDay, language)}
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
    if (firstTag) {
      metaItems.push({
        key: 'tags',
        shrink: true,
        node: (
          <span className="task-card__tag">
            <span className="truncate">#{firstTag}</span>
            {extraTagCount > 0 ? <span className="task-card__tag--more">+{extraTagCount}</span> : null}
          </span>
        ),
      })
    }

    return (
      <Popover open={hasPeek && peekOpen} onOpenChange={(open) => { if (!open) setPeekOpen(false) }}>
        <PopoverPrimitive.Anchor asChild>
          <div
            ref={ref}
            className={cn(
              'task-card-shell group relative cursor-pointer',
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
            onMouseEnter={() => {
              setIsHovered(true)
              if (!hasPeek) return
              clearPeekTimer()
              peekTimerRef.current = window.setTimeout(() => setPeekOpen(true), PEEK_INTENT_MS)
            }}
            onMouseLeave={() => {
              setIsHovered(false)
              clearPeekTimer()
              setPeekOpen(false)
            }}
            onPointerDown={() => {
              // Pressing starts a click or a drag; the peek would only be in the way.
              clearPeekTimer()
              setPeekOpen(false)
            }}
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

            <div className="task-card__body">
              <div className="task-card__head">
                {task.pinned ? <Pin className="task-card__pin-mark size-3.5 shrink-0 fill-current text-ink-3" aria-hidden /> : null}
                <h4
                  className={cn(
                    'task-card__title font-semibold line-clamp-2 transition-colors duration-300',
                    task.status === 'done' ? 'text-ink-3 line-through decoration-ink-2' : 'text-ink-1',
                  )}
                  title={task.title}
                >
                  {task.title}
                </h4>
              </div>

              <div className="task-card__foot" data-revealed={isHovered && !selectionMode ? 'true' : 'false'}>
                {/* Resting face: state on the left joined by "·", project on the right.
                    Only what needs action carries a tone (an overdue date, a blocker). */}
                <div className="task-card__foot-rest">
                  <div className="task-card__meta">
                    {metaItems.map((item, index) => (
                      <span key={item.key} className={cn('task-card__meta-item', item.shrink && 'task-card__meta-item--shrink')}>
                        {index > 0 ? <span className="task-card__meta-sep" aria-hidden>·</span> : null}
                        {item.node}
                      </span>
                    ))}
                  </div>
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
                </div>

                {!selectionMode ? (
                  <div
                    data-testid="task-card-actions"
                    className="task-card__actions"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {statusActions?.map((action) => {
                      const Icon =
                        action.key === 'doing' || action.key === 'start' ? Play :
                        action.key === 'done' ? CircleCheck :
                        action.key === 'todo' && task.status === 'doing' ? Undo2 :
                        RotateCcw
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
                ) : null}
              </div>
            </div>
          </div>
        </PopoverPrimitive.Anchor>

        {hasPeek ? (
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={6}
            className="task-card__peek"
            data-testid="task-card-peek"
            // Read-only glance: never steal focus, and let the pointer pass
            // through to whatever card sits underneath.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            style={{ width: 'calc(var(--radix-popper-anchor-width) / var(--overlay-scale, 1))', pointerEvents: 'none' }}
          >
            {peekBlockers.length > 0 ? (
              <section className="task-card__peek-section">
                <p className="task-card__peek-label">{t('tasks.card.blockedAria', { n: peekBlockers.length })}</p>
                <ul className="task-card__peek-list">
                  {peekBlockers.slice(0, 3).map((dependency) => (
                    <li key={dependency.id} className="task-card__dependency-row">
                      <span className="task-card__dependency-status" data-status={dependency.status} aria-hidden />
                      <span className="truncate">{dependency.title}</span>
                      <span>{t(TASK_STATUS_CONFIG[dependency.status].labelKey)}</span>
                    </li>
                  ))}
                </ul>
                {peekBlockers.length > 3 ? (
                  <p className="task-card__peek-more">{t('tasks.card.moreBlockers', { n: peekBlockers.length - 3 })}</p>
                ) : null}
              </section>
            ) : null}

            {pendingSubtasks.length > 0 ? (
              <section className="task-card__peek-section" data-testid="task-card-subtasks">
                <p className="task-card__peek-label">
                  {t('tasks.drawer.subtasks')} · {doneSubtasks}/{totalSubtasks}
                </p>
                <ul className="task-card__peek-list">
                  {visibleSubtasks.map((subtask) => (
                    <li key={subtask.id} className="task-card__peek-subtask">
                      <span className="task-card__peek-mark" aria-hidden />
                      <span className="line-clamp-1 flex-1">{subtask.title}</span>
                    </li>
                  ))}
                </ul>
                {remainingSubtasks > 0 ? (
                  <p className="task-card__peek-more">{t('tasks.card.subtaskMore', { n: remainingSubtasks })}</p>
                ) : null}
              </section>
            ) : null}
          </PopoverContent>
        ) : null}
      </Popover>
    )
  },
)

TaskCard.displayName = 'TaskCard'

export default TaskCard
