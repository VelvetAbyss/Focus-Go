import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProjectItem } from '../../../data/models/types'
import type { TaskItem, TaskStatus } from '../tasks.types'
import { resolveProjectColor } from '../../../shared/design/tokens'
import TaskRow from './TaskRow'
import { TASK_STATUS_CONFIG } from './taskPresentation'
import { useI18n } from '../../../shared/i18n/useI18n'
import '../tasks-ledger.css'
import '../tasks-workspace.css'

const DONE_COLLAPSED_LIMIT = 4
const STORAGE_DONE_EXPANDED_KEY = 'tasks_list_done_expanded'
const COLUMNS = ['todo', 'doing', 'waiting', 'verify', 'done'] as const

type TaskListViewProps = {
  tasks: TaskItem[]
  selectionMode?: boolean
  selectedTaskIds?: Set<string>
  projectById: Map<string, ProjectItem>
  ownerName?: (task: TaskItem) => string | undefined
  onTaskClick: (task: TaskItem) => void
  onCycleStatus: (task: TaskItem) => void
  onDelete?: (task: TaskItem) => void
  onTogglePin?: (task: TaskItem) => void
  onAddTask?: (status: TaskStatus) => void
  onMoveTask?: (task: TaskItem, status: TaskStatus) => void
}

const DropColumn = ({ status, dragStatus, children }: { status: TaskStatus; dragStatus: TaskStatus | null; children: ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return <div ref={setNodeRef} className={cn('fg-task-list__rows fg-task-list__drop', isOver && dragStatus !== status && 'is-drop-target')}>{children}</div>
}

const DraggableRow = ({ task, enabled, children }: { task: TaskItem; enabled: boolean; children: ReactNode }) => {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, disabled: !enabled })
  return <div ref={setNodeRef} {...(enabled ? listeners : {})} className={cn(enabled && 'fg-task-list__draggable', isDragging && 'is-dragging')}>{children}</div>
}

/** Separate queues preserve the difference between external waiting and internal verification.
 * Empty optional queues appear during a drag, so every open status is a valid drop target.
 * Keyboard users can change the same statuses from the task details' action menu. */
const TaskListView = ({ tasks, selectionMode = false, selectedTaskIds, projectById, ownerName, onTaskClick, onCycleStatus, onDelete, onTogglePin, onAddTask, onMoveTask }: TaskListViewProps) => {
  const { t } = useI18n()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggingTask, setDraggingTask] = useState<TaskItem | null>(null)
  const [doneExpanded, setDoneExpanded] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_DONE_EXPANDED_KEY) === '1')
  useEffect(() => { window.localStorage.setItem(STORAGE_DONE_EXPANDED_KEY, doneExpanded ? '1' : '0') }, [doneExpanded])

  const byStatus = useMemo(() => {
    const groups: Record<typeof COLUMNS[number], TaskItem[]> = { todo: [], doing: [], waiting: [], verify: [], done: [] }
    tasks.forEach((task) => { if (task.status !== 'dropped') groups[task.status].push(task) })
    return groups
  }, [tasks])
  const visibleColumns = COLUMNS.filter(status => status === 'todo' || status === 'doing' || status === 'done' || byStatus[status].length > 0 || draggingTask)
  const projectFor = (task: TaskItem) => {
    const project = task.projectId ? projectById.get(task.projectId) : undefined
    return project && project.status !== 'archived' ? { id: project.id, title: project.title, color: resolveProjectColor(project) } : null
  }
  const handleDragEnd = (event: DragEndEvent) => {
    const task = tasks.find(item => item.id === event.active.id)
    const target = event.over?.id
    setDraggingTask(null)
    if (task && typeof target === 'string' && COLUMNS.some(status => status === target) && task.status !== target) {
      onMoveTask?.(task, target as TaskStatus)
    }
  }
  const emptyKey = (status: typeof COLUMNS[number]) => status === 'todo' ? 'tasks.list.todoEmpty' : status === 'doing' ? 'tasks.list.doingEmpty' : status === 'done' ? 'tasks.list.doneEmpty' : 'tasks.workspace.queueEmpty'

  return (
    <DndContext sensors={sensors} onDragStart={(event) => setDraggingTask(tasks.find(task => task.id === event.active.id) ?? null)} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingTask(null)}>
      <div className="fg-task-list tasks-workspace-kanban">
        <div className="fg-task-list__board" style={{ '--task-columns': visibleColumns.length } as React.CSSProperties}>
          {visibleColumns.map(status => {
            const items = status === 'done' && !doneExpanded ? byStatus.done.slice(0, DONE_COLLAPSED_LIMIT) : byStatus[status]
            return (
              <section key={status} className={`fg-task-list__col fg-task-list__col--${status}`} aria-label={t(TASK_STATUS_CONFIG[status].labelKey)}>
                <header className="fg-task-list__col-head">
                  <div className="fg-task-list__col-head__title">
                    <span className={cn('fg-task-list__col-glyph', TASK_STATUS_CONFIG[status].dot)} aria-hidden />
                    <h2 className="fg-task-list__col-name">{t(TASK_STATUS_CONFIG[status].labelKey)}</h2>
                    <span className="fg-task-list__col-count">{byStatus[status].length}</span>
                  </div>
                  {onAddTask && status !== 'done' ? <button type="button" className="fg-task-list__add" aria-label={`${t('tasks.drawer.add')} · ${t(TASK_STATUS_CONFIG[status].labelKey)}`} onClick={() => onAddTask(status)}><Plus className="size-3.5" /></button> : null}
                </header>
                <DropColumn status={status} dragStatus={draggingTask?.status ?? null}>
                  {items.length === 0 ? <p className="fg-task-list__empty">{t(emptyKey(status))}</p> : items.map((task, index) => (
                    <DraggableRow key={task.id} task={task} enabled={Boolean(onMoveTask) && !selectionMode}>
                      <div className={cn('tasks-kanban-item', selectionMode && 'is-selectable', selectedTaskIds?.has(task.id) && 'is-selected')}>
                        {selectionMode ? <button type="button" className="tasks-kanban-select" aria-label={`${t('tasks.workspace.selectTask')} · ${task.title}`} aria-pressed={selectedTaskIds?.has(task.id) ?? false} onClick={() => onTaskClick(task)}>{selectedTaskIds?.has(task.id) ? '✓' : ''}</button> : null}
                      <TaskRow task={task} project={projectFor(task)} ownerName={ownerName?.(task)} index={index} variant={status === 'doing' ? 'doing' : status === 'done' ? 'done' : 'todo'} onClick={onTaskClick} onCycleStatus={selectionMode ? onTaskClick : onCycleStatus} onDelete={selectionMode ? undefined : onDelete} onTogglePin={selectionMode ? undefined : onTogglePin} />
                      </div>
                    </DraggableRow>
                  ))}
                </DropColumn>
                {status === 'done' && byStatus.done.length > DONE_COLLAPSED_LIMIT ? <button type="button" className="fg-task-list__expand" aria-expanded={doneExpanded} onClick={() => setDoneExpanded(value => !value)}>{doneExpanded ? t('tasks.list.collapse') : t('tasks.list.showAll', { count: byStatus.done.length })}</button> : null}
              </section>
            )
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{draggingTask ? <div className="fg-task-list__drag-overlay"><TaskRow task={draggingTask} project={projectFor(draggingTask)} variant={draggingTask.status === 'doing' ? 'doing' : draggingTask.status === 'done' ? 'done' : 'todo'} /></div> : null}</DragOverlay>
    </DndContext>
  )
}
export default TaskListView
