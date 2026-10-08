import { useState } from 'react'
import { Check, ChevronDown, LockKeyhole, Pin, Timer } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import { TASK_STATUS_CONFIG, formatTaskDate, getTaskCompletion } from '../components/taskPresentation'
import type { ProjectItem, TaskItem, TaskStatus } from '../../../data/models/types'
import { blockedForExecution, unresolvedDependencies } from './taskWorkspaceModel'
import { workflowNextStatus } from './taskWorkflow'

export type WorkspaceActions = {
  open: (task: TaskItem) => void
  move: (task: TaskItem, status: TaskStatus) => void
  plan: (task: TaskItem, value: boolean) => void
  focus: (task: TaskItem) => void
  unblock: (task: TaskItem) => void
  busy: (id: string) => boolean
}
export default function WorkspaceTask({ task, allTasks, project, actions, candidate = false, selectable, selected, onSelect }: {
  task: TaskItem; allTasks: TaskItem[]; project?: ProjectItem; actions: WorkspaceActions
  candidate?: boolean; selectable?: boolean; selected?: boolean; onSelect?: () => void
}) {
  const { t } = useI18n()
  const [menuOpen,setMenuOpen]=useState(false)
  const perform=(action:()=>void)=>{setMenuOpen(false);action()}
  const blocked = blockedForExecution(task, allTasks)
  const next = workflowNextStatus(task)
  const nextLabel = task.status === 'doing' ? t('tasks.status.complete') : task.status === 'verify' ? t('tasks.flow.accept')
    : task.status === 'waiting' ? t('tasks.flow.resume') : task.status === 'done' || task.status === 'dropped' ? t('tasks.status.reopen') : t('tasks.status.start')
  const completion = getTaskCompletion(task)
  const refs = unresolvedDependencies(task, allTasks)
  return <article className="flow-task" data-status={task.status} data-blocked={blocked} data-selected={selected}>
    <div className="flow-task-heading">
      {selectable ? <input type="checkbox" checked={selected ?? false} aria-label={`${t('tasks.flow.selectTask')} · ${task.title}`} onChange={onSelect} /> : null}
      <button type="button" className="flow-task-title" onClick={() => actions.open(task)}>{task.pinned ? <Pin size={12} aria-hidden /> : null}{task.title}</button>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}><PopoverTrigger asChild><button type="button" className="flow-icon" aria-label={`${t('tasks.flow.detailsAction')} · ${task.title}`}><ChevronDown size={15} /></button></PopoverTrigger>
        <PopoverContent align="end" className="flow-task-menu">
          <button type="button" onClick={() => perform(()=>actions.open(task))}>{t('tasks.flow.open')}</button>
          <button type="button" disabled={actions.busy(task.id)} onClick={() => perform(()=>actions.plan(task, !task.isToday))}>{t(task.isToday ? 'tasks.flow.removePlan' : 'tasks.flow.addPlan')}</button>
          {(['todo','doing','waiting','verify','done','dropped'] as const).filter(status => status !== task.status).map(status =>
            <button type="button" key={status} disabled={actions.busy(task.id) || (status === 'doing' && blocked)} onClick={() => perform(()=>actions.move(task, status))}>{t(TASK_STATUS_CONFIG[status].labelKey)}</button>)}
        </PopoverContent>
      </Popover>
    </div>
    <div className="flow-task-meta">
      {project ? <span>{project.title}</span> : null}
      {task.priority ? <span data-priority={task.priority}>{t(`tasks.priority.${task.priority}`)}</span> : null}
      {task.dueDate ? <span>{task.status === 'waiting' ? `${t('tasks.flow.waitingDate')} · ` : ''}{formatTaskDate(task.dueDate)}</span> : null}
      {completion ? <span>{completion.completed}/{completion.total}</span> : null}
      {task.tags.slice(0, 2).map(tag => <span key={tag}>#{tag}</span>)}
    </div>
    {task.status === 'waiting' ? <p className="flow-task-note">{task.waitingOn || t('tasks.flow.waitingWho')}</p> : task.progressNote ? <p className="flow-task-note">{task.progressNote}</p> : null}
    {blocked ? <div className="flow-block-note"><LockKeyhole size={12} aria-hidden />{task.isBlocked ? <span>{t('tasks.flow.manualBlock')} <button type="button" disabled={actions.busy(task.id)} onClick={()=>actions.unblock(task)}>{t('tasks.flow.unblock')}</button></span> : null}{refs.map(id=>{const dependency=allTasks.find(item=>item.id===id);return dependency?<button type="button" key={id} onClick={()=>actions.open(dependency)}>{dependency.title} ↗</button>:<span key={id}>{t('tasks.flow.missingDependency')}</span>})}</div> : null}
    <div className="flow-task-actions">
      {candidate ? <button type="button" disabled={actions.busy(task.id)} onClick={() => actions.plan(task, true)}>+ {t('tasks.flow.addPlan')}</button> : <>
        {task.status !== 'done' && task.status !== 'dropped' ? <button type="button" className="flow-task-primary" disabled={actions.busy(task.id) || (next === 'doing' && blocked)} onClick={() => actions.move(task, next)}>{next === 'done' ? <Check size={13} aria-hidden /> : null}{nextLabel}</button> : null}
        {(task.status === 'todo' || task.status === 'doing') && !blocked ? <button type="button" disabled={actions.busy(task.id)} onClick={() => actions.focus(task)}><Timer size={13} aria-hidden />{t('tasks.flow.focus')}</button> : null}
        {task.status === 'doing' ? <button type="button" disabled={actions.busy(task.id)} onClick={() => actions.move(task, 'verify')}>{t('tasks.flow.sendVerify')}</button> : null}
        {task.status === 'verify' ? <button type="button" disabled={actions.busy(task.id)} onClick={() => actions.move(task, 'todo')}>{t('tasks.flow.return')}</button> : null}
        {task.isToday && task.status !== 'done' && task.status !== 'dropped' ? <button type="button" disabled={actions.busy(task.id)} onClick={() => actions.plan(task, false)}>{t('tasks.flow.removePlan')}</button> : null}
        {task.status === 'waiting' ? <button type="button" onClick={() => actions.move(task, 'waiting')}>{t('tasks.flow.waitingEdit')}</button> : null}
      </>}
    </div>
  </article>
}
