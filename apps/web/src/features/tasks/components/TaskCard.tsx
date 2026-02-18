import { forwardRef, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Trash2 } from 'lucide-react'
import type { TaskItem } from '../tasks.types'
import Button from '../../../shared/ui/Button'
import type { HTMLAttributes } from 'react'

type TaskCardProps = {
  task: TaskItem
  onClick: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  statusActions?: {
    key: string
    label: string
    onClick: (task: TaskItem) => void
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
}

const priorityLabels: Record<'high' | 'medium' | 'low', string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const priorityTextColors: Record<'high' | 'medium' | 'low' | 'none', string> = {
  high: '#b91c1c',
  medium: '#b45309',
  low: '#1d4ed8',
  none: '#6b7280',
}

const tagToneClass = (tag: string) => {
  const key = tag.toLowerCase()
  if (key === 'work') return 'task-tag-chip--work'
  if (key === 'life') return 'task-tag-chip--life'
  if (key === 'health') return 'task-tag-chip--health'
  if (key === 'study') return 'task-tag-chip--study'
  if (key === 'finance') return 'task-tag-chip--finance'
  if (key === 'family') return 'task-tag-chip--family'
  return 'task-tag-chip--custom'
}

const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>((
  { task, onClick, onDelete, statusActions, progressComposer, dragAttributes, dragListeners, interactive = true, style },
  ref,
) => {
  const visibleTags = task.tags.slice(0, 2)
  const hiddenTagCount = Math.max(0, task.tags.length - visibleTags.length)
  const priorityKey = task.priority ?? 'none'
  const progressInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (!progressComposer?.isOpen) return
    const node = progressInputRef.current
    if (!node) return
    requestAnimationFrame(() => {
      node.focus()
      node.setSelectionRange(node.value.length, node.value.length)
    })
  }, [progressComposer?.isOpen])

  const handleDelete = (e: React.SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete?.(task)
  }

  return (
    <div
      ref={ref}
      className={`task-card task-card--${task.priority ?? 'none'}`}
      style={style}
      {...(interactive ? dragAttributes : undefined)}
      {...(interactive ? dragListeners : undefined)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onClick(task) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.target !== e.currentTarget) return
              if (e.key === 'Enter' || e.key === ' ') onClick(task)
            }
          : undefined
      }
    >
      <div className="task-card__top">
        <div className="task-card__title" title={task.title.trim() || 'Untitled'}>
          {task.title.trim() || 'Untitled'}
        </div>
        {interactive && onDelete && (
          <button
            type="button"
            className="task-card__delete"
            onClick={handleDelete}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Delete task"
            title="Delete task"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <div className="task-card__bottom">
        <div className="task-card__meta">
          <span
            className={`task-card__priority task-card__priority--${priorityKey}`}
            style={{ color: priorityTextColors[priorityKey] }}
          >
            {task.priority ? priorityLabels[task.priority] : 'None'}
          </span>
          {task.dueDate && <span className="task-card__due muted">{task.dueDate}</span>}
          {task.tags.length > 0 ? (
            <div className="task-card__tags task-card__tags--meta" aria-label="Task tags">
              {visibleTags.map((tag) => (
                <span key={tag} className={`task-tag-chip task-card__tag ${tagToneClass(tag)}`}>
                  {tag}
                </span>
              ))}
              {hiddenTagCount > 0 ? (
                <span className="task-tag-chip task-card__tag task-tag-chip--count">+{hiddenTagCount}</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="task-card__actions" aria-label="Task quick actions">
          <div className={`task-card__progress ${progressComposer?.isOpen ? 'is-open' : ''}`}>
            {!progressComposer?.isOpen ? (
              <Button
                type="button"
                className="button button--ghost task-card__progress-btn"
                disabled={progressComposer?.disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  progressComposer?.onToggle(task)
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Update
              </Button>
            ) : (
              <form
                className="task-card__progress-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  progressComposer.onSubmit(task)
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <textarea
                  ref={progressInputRef}
                  className="task-card__progress-input"
                  rows={1}
                  value={progressComposer.value}
                  placeholder={progressComposer.placeholder ?? 'Log progress...'}
                  onChange={(e) => progressComposer.onChange(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      progressComposer.onCancel(task)
                      return
                    }
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      progressComposer.onSubmit(task)
                    }
                  }}
                />
              </form>
            )}
          </div>
          {statusActions?.map((statusAction) => (
            <Button
              key={statusAction.key}
              type="button"
              className="button button--ghost task-card__status"
              data-status-action={statusAction.key}
              disabled={statusAction.disabled}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                statusAction.onClick(task)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {statusAction.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
})

TaskCard.displayName = 'TaskCard'

export default TaskCard
