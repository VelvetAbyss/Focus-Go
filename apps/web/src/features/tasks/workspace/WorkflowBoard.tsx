import { useState, type ReactNode } from 'react'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { GripVertical } from 'lucide-react'
import type { ProjectItem, TaskItem, TaskStatus } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import WorkspaceTask, { type WorkspaceActions } from './WorkspaceTask'
import { completionRecords } from './taskWorkspaceModel'

const QUEUES = ['todo','doing','waiting','verify'] as const
const queueKey = { todo:'queueTodo', doing:'queueDoing', waiting:'queueWaiting', verify:'queueVerify' } as const
const hintKey = { todo:'queueTodoHint', doing:'queueDoingHint', waiting:'queueWaitingHint', verify:'queueVerifyHint' } as const
function Queue({ status, children }: { status: TaskStatus; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return <div ref={setNodeRef} className="flow-queue-body" data-over={isOver}>{children}</div>
}
function DraggableTask({ task, disabled, children }: { task: TaskItem; disabled: boolean; children: ReactNode }) {
  const { t } = useI18n()
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id:task.id, disabled })
  return <div ref={setNodeRef} className="flow-draggable" data-dragging={isDragging}>
    <button type="button" className="flow-drag-handle" disabled={disabled} {...listeners} {...attributes} aria-label={`${t('tasks.flow.moveTask')} · ${task.title}`}><GripVertical size={14} /></button>{children}
  </div>
}
export default function WorkflowBoard({ tasks, allTasks, projects, actions }: { tasks: TaskItem[]; allTasks: TaskItem[]; projects: ProjectItem[]; actions: WorkspaceActions }) {
  const { t } = useI18n()
  const [dragging, setDragging] = useState<TaskItem | null>(null)
  const [archiveLimit, setArchiveLimit] = useState(10)
  const [queueLimits,setQueueLimits] = useState<Record<string,number>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint:{ distance:6 } }))
  const done = tasks.filter(task => task.status === 'done')
  const completionById = new Map(completionRecords(done, {start:0,end:Number.MAX_SAFE_INTEGER}).map(record => [record.task.id,record.completedAt]))
  const archive = done.slice().sort((a,b) => (completionById.get(b.id) ?? 0) - (completionById.get(a.id) ?? 0))
  const row = (task: TaskItem) => <WorkspaceTask task={task} allTasks={allTasks} project={projects.find(project => project.id === task.projectId)} actions={actions} />
  return <div className="flow-board">
    <DndContext sensors={sensors} onDragStart={event => setDragging(tasks.find(task => task.id === event.active.id) ?? null)} onDragCancel={() => setDragging(null)} onDragEnd={event => {
      const task = tasks.find(item => item.id === event.active.id), target = event.over?.id
      setDragging(null)
      if (task && QUEUES.some(status => status === target) && task.status !== target) actions.move(task, target as TaskStatus)
    }}>
      <div className="flow-kanban">
        {QUEUES.map(status => { const queue = tasks.filter(task => task.status === status).sort((a,b) => Number(b.pinned)-Number(a.pinned) || a.createdAt-b.createdAt)
          return <section className="flow-queue" data-status={status} key={status} aria-label={t(`tasks.flow.${queueKey[status]}`)}>
            <header><h2>{t(`tasks.flow.${queueKey[status]}`)}</h2><span>{queue.length}</span></header>
            <p className="flow-caption">{t(`tasks.flow.${hintKey[status]}`)}</p>
            {status === 'doing' && queue.length > 3 ? <p className="flow-wip-note">{t('tasks.flow.wip',{ n:queue.length })}</p> : null}
            <Queue status={status}>{queue.length ? queue.slice(0,queueLimits[status]??30).map(task => <DraggableTask key={task.id} task={task} disabled={actions.busy(task.id)}>{row(task)}</DraggableTask>) : <p className="flow-empty">{t('tasks.flow.empty')}</p>}{queue.length>(queueLimits[status]??30)?<button type="button" className="flow-text-button" onClick={()=>setQueueLimits(prev=>({...prev,[status]:(prev[status]??30)+30}))}>{t('tasks.flow.loadMore')}</button>:null}</Queue>
          </section> })}
      </div>
      <DragOverlay dropAnimation={null}>{dragging ? <div className="flow-drag-overlay">{row(dragging)}</div> : null}</DragOverlay>
    </DndContext>
    <details className="flow-board-archive"><summary>{t('tasks.flow.archive')} <span>{archive.length}</span></summary><p className="flow-caption">{t('tasks.flow.archiveHint')}</p>
      {archive.slice(0,archiveLimit).map(task => <button type="button" key={task.id} onClick={() => actions.open(task)}><span>✓ {task.title}</span><time>{completionById.has(task.id) ? new Date(completionById.get(task.id)!).toLocaleDateString() : t('tasks.flow.completionUnknown')}</time></button>)}
      {archive.length > archiveLimit ? <button type="button" onClick={() => setArchiveLimit(limit => limit+20)}>{t('tasks.flow.loadMore')}</button> : null}
    </details>
  </div>
}
