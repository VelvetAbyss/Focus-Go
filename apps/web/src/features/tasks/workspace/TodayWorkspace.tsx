import { useState } from 'react'
import { X } from 'lucide-react'
import type { ProjectItem, TaskItem } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import WorkspaceTask, { type WorkspaceActions } from './WorkspaceTask'
import { buildTodayPlan } from './taskWorkspaceModel'
import { isTaskOverdue, getTaskDaysUntilDue } from '../domain/taskRules'

// Past this many open tasks a day stops being a plan; say so once a day, quietly, and let it be dismissed.
const TODAY_OVERLOAD = 7
const OVERLOAD_DISMISSED_KEY = 'focusgo.tasks.todayOverloadDismissed'
const localDayKey = (time: number) => new Date(time).toLocaleDateString('en-CA')
const readDismissedDay = () => {
  try {
    return window.localStorage.getItem(OVERLOAD_DISMISSED_KEY)
  } catch {
    return null
  }
}

export default function TodayWorkspace({ tasks, allTasks, projects, actions, now, onBulkPlan }: {
  tasks: TaskItem[]; allTasks: TaskItem[]; projects: ProjectItem[]; actions: WorkspaceActions; now: number; onBulkPlan: (ids: string[]) => Promise<boolean>
}) {
  const { t, language } = useI18n()
  const plan = buildTodayPlan(tasks, allTasks, now)
  const [selected, setSelected] = useState<string[]>([])
  const [candidateQuery, setCandidateQuery] = useState('')
  const [planning, setPlanning] = useState(false)
  const [candidateLimit,setCandidateLimit] = useState(30)
  const [dismissedDay, setDismissedDay] = useState(readDismissedDay)
  const today = localDayKey(now)
  const overloaded = plan.plannedCount > TODAY_OVERLOAD && dismissedDay !== today
  const dismissOverload = () => {
    setDismissedDay(today)
    try {
      window.localStorage.setItem(OVERLOAD_DISMISSED_KEY, today)
    } catch {
      // private mode: it just comes back on reload
    }
  }
  const candidates = plan.candidates.filter(task => task.title.toLowerCase().includes(candidateQuery.toLowerCase()))
    .sort((a, b) => Number(isTaskOverdue(b, now)) - Number(isTaskOverdue(a, now)) || Number(getTaskDaysUntilDue(b, now) === 0) - Number(getTaskDaysUntilDue(a, now) === 0))
  const selectedVisible = selected.filter(id => candidates.some(task => task.id === id))
  const row = (task: TaskItem, candidate = false) => <WorkspaceTask key={task.id} task={task} allTasks={allTasks} project={projects.find(project => project.id === task.projectId)} actions={actions} candidate={candidate}
    selectable={candidate} selected={selectedVisible.includes(task.id)} onSelect={() => setSelected(prev => prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id])} />
  const groups = [
    { key: 'doing', items: plan.doing }, { key: 'ready', items: plan.ready }, { key: 'verify', items: plan.verify }, { key: 'blocked', items: plan.blocked },
  ] as const
  return <div className="flow-today">
    <main className="flow-today-main">
      <section className="flow-next">
        <p className="flow-eyebrow">{new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { month:'long', day:'numeric', weekday:'long' }).format(now)} · {t('tasks.flow.next')}</p>
        {plan.next ? <><button type="button" className="flow-next-title" onClick={() => actions.open(plan.next!)}>{plan.next.title}</button>
          {plan.next.description ? <p className="flow-next-description">{plan.next.description}</p> : null}
          <button type="button" className="flow-cta" disabled={actions.busy(plan.next.id)} onClick={() => actions.focus(plan.next!)}>{t('tasks.flow.focus')} →</button></>
          : <><h2>{t('tasks.flow.noNext')}</h2><p>{t('tasks.flow.choose')}</p></>}
      </section>
      <section className="flow-plan">
        <header className="flow-section-heading"><h2>{t('tasks.flow.planned')}</h2><span>{plan.plannedCount}</span></header>
        {overloaded ? <p className="flow-caption flow-overload">
          <span>{t('tasks.flow.overload', { n: plan.plannedCount })}</span>
          <button type="button" className="flow-overload__dismiss" onClick={dismissOverload} aria-label={t('tasks.flow.overloadDismiss')} title={t('tasks.flow.overloadDismiss')}><X size={12} aria-hidden /></button>
        </p> : null}
        {plan.plannedCount === 0 ? <p className="flow-empty">{t('tasks.flow.planEmpty')}</p> : groups.filter(group => group.items.length > 0).map(group => <section key={group.key}>
          <h3 className="flow-group-heading">{t(`tasks.flow.${group.key}`)} <span>{group.items.length}</span></h3>{group.key === 'blocked' ? <p className="flow-caption">{t('tasks.flow.blockHint')}</p> : null}{group.items.map(task => row(task))}
        </section>)}
      </section>

      <details className="flow-completed" open={plan.completed.length > 0}><summary>{t('tasks.flow.finished')} <span>{plan.completed.length}</span></summary>{plan.completed.map(record => <button type="button" key={record.task.id} onClick={() => actions.open(record.task)}>✓ {record.task.title}</button>)}</details>
    </main>
    <aside className="flow-planning-shelf">
      {plan.followUps.length > 0 ? <details className="flow-followups" open={plan.followUps.length <= 2}><summary>{t('tasks.flow.followUps')} · {plan.followUps.length}</summary><div>{plan.followUps.map(task => row(task))}</div></details> : null}
      <header><h2>{t('tasks.flow.candidates')}</h2><span>{plan.candidates.length}</span></header><p className="flow-caption">{t('tasks.flow.candidatesHint')}</p>
      <input className="flow-search" aria-label={t('tasks.flow.candidates')} value={candidateQuery} onChange={event => setCandidateQuery(event.target.value)} placeholder={t('tasks.flow.search')} />
      {selectedVisible.length > 0 ? <div className="flow-selection"><span>{t('tasks.flow.selected', { n: selectedVisible.length })}</span><button type="button" disabled={planning || selectedVisible.some(id => actions.busy(id))} onClick={async () => { setPlanning(true); try { if (await onBulkPlan(selectedVisible)) setSelected([]) } finally { setPlanning(false) } }}>{t('tasks.flow.bulkPlan')}</button></div> : null}
      <div className="flow-shelf-list">{candidates.length ? candidates.slice(0,candidateLimit).map(task => row(task, true)) : <p className="flow-empty">{t('tasks.flow.empty')}</p>}{candidates.length>candidateLimit?<button type="button" className="flow-text-button" onClick={()=>setCandidateLimit(limit=>limit+30)}>{t('tasks.flow.loadMore')}</button>:null}</div>
    </aside>
  </div>
}
