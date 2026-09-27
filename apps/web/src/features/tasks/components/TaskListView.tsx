import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem } from '../../../data/models/types'
import type { TaskItem, TaskStatus } from '../tasks.types'
import { resolveProjectColor } from '../../../shared/design/tokens'
import TaskRow from './TaskRow'
import '../tasks-ledger.css'
import { useI18n } from '../../../shared/i18n/useI18n'
import { DURATION, EASE } from '../../../shared/motion/tokens'

const DONE_COLLAPSED_LIMIT = 4
const STORAGE_DONE_EXPANDED_KEY = 'tasks_list_done_expanded'

type TaskListViewProps = {
  tasks: TaskItem[]
  projectById: Map<string, ProjectItem>
  ownerName?: (task: TaskItem) => string | undefined
  onTaskClick: (task: TaskItem) => void
  onCycleStatus: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
  onAddTask?: (status: TaskStatus) => void
  /** Dropping a row on another column moves the task to that status. */
  onMoveTask?: (task: TaskItem, status: TaskStatus) => void
}

/** A column that accepts dropped rows; highlights while a row from another column hovers it. */
const DropColumn = ({ status, dragStatus, className, children }: { status: TaskStatus; dragStatus: TaskStatus | null; className: string; children: ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={cn(className, 'fg-task-list__drop', isOver && dragStatus && dragStatus !== status && 'is-drop-target')}>
      {children}
    </div>
  )
}

/** A row that can be picked up; a short drag threshold keeps plain clicks opening the task. */
const DraggableRow = ({ task, enabled, children }: { task: TaskItem; enabled: boolean; children: ReactNode }) => {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task.id, disabled: !enabled })
  return (
    <div
      ref={setNodeRef}
      {...(enabled ? listeners : {})}
      {...(enabled ? { 'aria-roledescription': attributes['aria-roledescription'] } : {})}
      className={cn(enabled && 'fg-task-list__draggable', isDragging && 'is-dragging')}
    >
      {children}
    </div>
  )
}

const TaskListView = ({
  tasks,
  projectById,
  ownerName,
  onTaskClick,
  onCycleStatus,
  onDelete,
  onTogglePin,
  onAddTask,
  onMoveTask,
}: TaskListViewProps) => {
  const { t } = useI18n()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggingTask, setDraggingTask] = useState<TaskItem | null>(null)
  const canDrag = Boolean(onMoveTask)
  const handleDragStart = (event: DragStartEvent) => {
    setDraggingTask(tasks.find((task) => task.id === event.active.id) ?? null)
  }
  const handleDragEnd = (event: DragEndEvent) => {
    const task = tasks.find((item) => item.id === event.active.id)
    setDraggingTask(null)
    const target = event.over?.id as TaskStatus | undefined
    if (task && target && target !== task.status) onMoveTask?.(task, target)
  }
  const [doneExpanded, setDoneExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_DONE_EXPANDED_KEY) === '1'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_DONE_EXPANDED_KEY, doneExpanded ? '1' : '0')
  }, [doneExpanded])

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, TaskItem[]> = { todo: [], doing: [], done: [] }
    tasks.forEach((task) => {
      groups[task.status].push(task)
    })
    return groups
  }, [tasks])

  const visibleDone = doneExpanded ? byStatus.done : byStatus.done.slice(0, DONE_COLLAPSED_LIMIT)
  const hiddenDoneCount = Math.max(0, byStatus.done.length - DONE_COLLAPSED_LIMIT)

  const resolveProjectForRow = (task: TaskItem) => {
    if (!task.projectId) return null
    const project = projectById.get(task.projectId)
    if (!project || project.status === 'archived') return null
    return { id: project.id, title: project.title, color: resolveProjectColor(project) }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingTask(null)}>
    <div className="fg-task-list">
      <div className="fg-task-list__board">
        {/* ── TODO ───────────────────────────────── */}
        <motion.section
          className="fg-task-list__col fg-task-list__col--todo"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: DURATION.slow }}
        >
          <header className="fg-task-list__col-head">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph" aria-hidden />
              <span className="fg-task-list__col-name">{t('tasks.list.todo')}</span>
              <span className="fg-task-list__col-count">{byStatus.todo.length}</span>
            </div>
            {onAddTask ? (
              <button
                type="button"
                className="fg-task-list__add"
                aria-label="Add todo"
                onClick={() => onAddTask('todo')}
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </header>

          <DropColumn status="todo" dragStatus={draggingTask?.status ?? null} className="fg-task-list__rows">
            {byStatus.todo.length === 0 ? (
              <p className="fg-task-list__empty">{t('tasks.list.todoEmpty')}</p>
            ) : (
              byStatus.todo.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.025, duration: DURATION.medium }}
                >
                  <DraggableRow task={task} enabled={canDrag}>
<TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    index={i}
                    variant="todo"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                  </DraggableRow>
                </motion.div>
              ))
            )}
          </DropColumn>
        </motion.section>

        {/* ── DOING (hero) ───────────────────────── */}
        <motion.section
          className="fg-task-list__col fg-task-list__col--doing"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: DURATION.slow }}
        >
          <header className="fg-task-list__col-head fg-task-list__col-head--hero">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph fg-task-list__col-glyph--hero" aria-hidden />
              <span className="fg-task-list__col-name fg-task-list__col-name--hero">{t('tasks.list.doing')}</span>
              <span className="fg-task-list__col-count fg-task-list__col-count--hero">{byStatus.doing.length}</span>
            </div>
            {onAddTask ? (
              <button
                type="button"
                className="fg-task-list__add"
                aria-label="Add doing"
                onClick={() => onAddTask('doing')}
              >
                <Plus className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </header>

          <DropColumn status="doing" dragStatus={draggingTask?.status ?? null} className="fg-task-list__rows fg-task-list__rows--hero">
            {byStatus.doing.length === 0 ? (
              <p className="fg-task-list__empty">{t('tasks.list.doingEmpty')}</p>
            ) : (
              byStatus.doing.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.16 + i * 0.04, duration: DURATION.slow, ease: EASE.outExpo }}
                >
                  <DraggableRow task={task} enabled={canDrag}>
<TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    ownerName={ownerName?.(task)}
                    variant="doing"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                    onTogglePin={onTogglePin}
                  />
                  </DraggableRow>
                </motion.div>
              ))
            )}
          </DropColumn>
        </motion.section>

        {/* ── DONE (archive) ─────────────────────── */}
        <motion.section
          className={cn('fg-task-list__col fg-task-list__col--done', doneExpanded && 'is-expanded')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: DURATION.slow }}
        >
          <header className="fg-task-list__col-head fg-task-list__col-head--archive">
            <div className="fg-task-list__col-head__title">
              <span className="fg-task-list__col-glyph" aria-hidden />
              <span className="fg-task-list__col-name">{t('tasks.list.done')}</span>
              <span className="fg-task-list__col-count">{byStatus.done.length}</span>
            </div>
          </header>

          <DropColumn status="done" dragStatus={draggingTask?.status ?? null} className="fg-task-list__rows fg-task-list__rows--archive">
            {byStatus.done.length === 0 ? (
              <p className="fg-task-list__empty">{t('tasks.list.doneEmpty')}</p>
            ) : (
              visibleDone.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.22 + i * 0.02, duration: DURATION.medium }}
                >
                  <DraggableRow task={task} enabled={canDrag}>
<TaskRow
                    task={task}
                    project={resolveProjectForRow(task)}
                    variant="done"
                    onClick={onTaskClick}
                    onCycleStatus={onCycleStatus}
                    onDelete={onDelete}
                  />
                  </DraggableRow>
                </motion.div>
              ))
            )}
          </DropColumn>
          {hiddenDoneCount > 0 ? (
            <button
              type="button"
              className="fg-task-list__expand"
              onClick={() => setDoneExpanded((v) => !v)}
            >
              {doneExpanded ? t('tasks.list.collapse') : t('tasks.list.showAll', { count: byStatus.done.length })}
              <span aria-hidden>{doneExpanded ? ' ↑' : ' →'}</span>
            </button>
          ) : null}
        </motion.section>
      </div>
    </div>
    <DragOverlay dropAnimation={null}>
      {draggingTask ? (
        <div className="fg-task-list__drag-overlay">
          <TaskRow task={draggingTask} project={resolveProjectForRow(draggingTask)} variant={draggingTask.status === 'doing' ? 'doing' : draggingTask.status === 'done' ? 'done' : 'todo'} />
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}

export default TaskListView
