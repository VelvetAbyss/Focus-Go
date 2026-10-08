import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react'
import type { FocusSession, ProjectItem, TaskItem } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { buildTaskReview, localDateKey, reviewRange, type ReviewPeriod } from './taskWorkspaceModel'
import { TASK_STATUS_CONFIG } from '../components/taskPresentation'
import type { WorkspaceActions } from './WorkspaceTask'

export default function ReviewWorkspace({ tasks, allTasks, projects, sessions, sessionsAvailable, actions, now, onViewChange }: {
  tasks: TaskItem[]; allTasks: TaskItem[]; projects: ProjectItem[]; sessions: FocusSession[]; sessionsAvailable: boolean; actions: WorkspaceActions; now: number; onViewChange: (view: 'today' | 'list') => void
}) {
  const { t, language } = useI18n(), toast = useToast()
  const [period, setPeriod] = useState<ReviewPeriod>('week')
  const [offset, setOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [metric, setMetric] = useState<'completed'|'minutes'>('completed')
  const [limit, setLimit] = useState(20)
  const [undatedLimit,setUndatedLimit]=useState(20)
  const range = useMemo(()=>reviewRange(period,offset,now),[now,offset,period]), previousRange = useMemo(()=>reviewRange(period,offset-1,now),[now,offset,period])
  const review = useMemo(() => buildTaskReview(tasks,sessions,range,now,allTasks),[allTasks,now,range,sessions,tasks])
  const previous = useMemo(() => buildTaskReview(tasks,sessions,previousRange,now,allTasks),[allTasks,now,previousRange,sessions,tasks])
  const dateFormat = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN':'en-US',{month:'short',day:'numeric'})
  const rangeLabel = `${dateFormat.format(range.start)} – ${dateFormat.format(range.end-1)}`
  const peak = Math.max(1,...review.days.map(day => day[metric]))
  const records = review.records.filter(record => !selectedDay || localDateKey(record.completedAt) === selectedDay)
  const taskMap = new Map(allTasks.map(task=>[task.id,task]))
  const projectMap = new Map(projects.map(project=>[project.id,project]))
  const attribution = new Map<string,{ title:string; completed:number; minutes:number }>()
  const getProject = (task?:TaskItem) => { const id=task?.projectId ?? (task ? '__inbox__':'__unlinked__');if(!attribution.has(id)) attribution.set(id,{title:projectMap.get(id)?.title ?? t(id==='__unlinked__'?'tasks.flow.freeFocus':'tasks.flow.inbox'),completed:0,minutes:0});return attribution.get(id)! }
  review.records.forEach(record=> {getProject(record.task).completed++})
  review.sessions.forEach(session=> {if(typeof session.actualMinutes==='number' && Number.isFinite(session.actualMinutes) && session.actualMinutes>=0) getProject(session.taskId ? taskMap.get(session.taskId):undefined).minutes+=session.actualMinutes})
  const metrics = [
    {key:'completedCount',value:review.records.length,previous:previous.records.length},
    {key:'createdCount',value:review.created,previous:previous.created},
    {key:'focusMinutes',value:Math.round(review.minutes),previous:Math.round(previous.minutes)},
    {key:'focusSessions',value:review.sessions.length,previous:previous.sessions.length},
  ] as const
  const changePeriod = (next:ReviewPeriod) => {setPeriod(next);setOffset(0);setSelectedDay(null);setLimit(20)}
  const changeOffset = (next:number) => {setOffset(next);setSelectedDay(null);setLimit(20)}
  const copy = async () => {
    const text=[rangeLabel,...metrics.map(item=>`${t(`tasks.flow.${item.key}`)}: ${!sessionsAvailable&&item.key.startsWith('focus')?'—':item.value}`),...review.records.map(record=>`✓ ${record.task.title} · ${dateFormat.format(record.completedAt)}`)].join('\n')
    try {await navigator.clipboard.writeText(text);toast.push({message:t('tasks.flow.copied')})} catch {toast.push({variant:'error',message:t('tasks.flow.copyFailed')})}
  }
  const friction = [
    {key:'reviewWaiting',items:review.followUps}, {key:'reviewBlocked',items:review.blocked}, {key:'reviewVerify',items:review.verify}, {key:'reviewOverdue',items:review.overdue},
  ] as const
  return <div className="flow-review">
    <header className="flow-review-controls">
      <div role="group" aria-label={t('tasks.flow.reviewTitle')} className="flow-segmented">{(['day','week','month'] as const).map(option=><button type="button" key={option} aria-pressed={period===option} onClick={()=>changePeriod(option)}>{t(`tasks.flow.${option}`)}</button>)}</div>
      <div className="flow-period-nav"><button type="button" className="flow-icon" aria-label={t('tasks.flow.previous')} onClick={()=>changeOffset(offset-1)}><ChevronLeft size={16}/></button><span>{rangeLabel}</span><button type="button" className="flow-icon" aria-label={t('tasks.flow.nextPeriod')} disabled={offset>=0} onClick={()=>changeOffset(offset+1)}><ChevronRight size={16}/></button>{offset!==0?<button type="button" onClick={()=>changeOffset(0)}>{t('tasks.flow.current')}</button>:null}</div>
      <button type="button" className="flow-text-button" onClick={()=>void copy()}><Copy size={14}/>{t('tasks.flow.copyReview')}</button>
    </header>
    <div className="flow-review-columns">
      <main>
        <dl className="flow-review-metrics">{metrics.map(item=>{const delta=item.value-item.previous;return <div key={item.key}><dt>{t(`tasks.flow.${item.key}`)}</dt><dd>{!sessionsAvailable&&item.key.startsWith('focus')?'—':item.value}</dd><p>{!sessionsAvailable&&item.key.startsWith('focus')?t('tasks.flow.focusUnavailable'):t('tasks.flow.previousDelta',{n:`${delta>0?'+':''}${delta}`})}</p></div>})}</dl>
        <p className="flow-caption">{t('tasks.flow.metricsMethod')}</p>
        {review.undatedFocusSessions>0?<p className="flow-caption">{t('tasks.flow.focusUndated',{n:review.undatedFocusSessions})}</p>:null}
        {review.unmeasuredSessions>0?<p className="flow-caption">{t('tasks.flow.minutesUnknown',{n:review.unmeasuredSessions})}</p>:null}
        <section className="flow-review-trend"><header className="flow-section-heading"><h2>{t('tasks.flow.trend')}</h2><div className="flow-segmented"><button type="button" aria-pressed={metric==='completed'} onClick={()=>setMetric('completed')}>{t('tasks.flow.taskTrend')}</button><button type="button" aria-pressed={metric==='minutes'} disabled={!sessionsAvailable} onClick={()=>setMetric('minutes')}>{t('tasks.flow.focusTrend')}</button></div></header>
          <div className="flow-chart">{review.days.map((day,index)=><button type="button" key={day.key} aria-pressed={selectedDay===day.key} aria-label={`${dateFormat.format(day.at)} · ${day[metric]} ${t(metric==='completed'?'tasks.flow.taskTrend':'tasks.flow.focusTrend')}`} title={`${day.key} · ${day[metric]}`} onClick={()=>setSelectedDay(selectedDay===day.key?null:day.key)}>
            <span className="flow-chart-value">{Math.round(day[metric])}</span><span className="flow-chart-track"><span className="flow-chart-bar" style={{height:`${day[metric]/peak*100}%`}}/></span><span className="flow-chart-date">{review.days.length<=7 || index%4===0 || index===review.days.length-1 ? dateFormat.format(day.at):''}</span>
          </button>)}</div><p className="flow-caption">{t('tasks.flow.trendHint')}</p>
        </section>
        <section className="flow-review-records"><header className="flow-section-heading"><h2>{t('tasks.flow.reviewRecords')}</h2>{selectedDay?<button type="button" onClick={()=>setSelectedDay(null)}>{selectedDay} ×</button>:<span>{records.length}</span>}</header>
          {records.length?records.slice(0,limit).map(record=><button type="button" className="flow-record" key={record.task.id} onClick={()=>actions.open(record.task)}><span>✓ {record.task.title}<small>{projectMap.get(record.task.projectId??'')?.title ?? t('tasks.flow.inbox')}{record.task.status!=='done'?` · ${t('tasks.flow.currentState')} ${t(TASK_STATUS_CONFIG[record.task.status].labelKey)}`:''}</small></span><time>{dateFormat.format(record.completedAt)}</time></button>):<p className="flow-empty">{t('tasks.flow.noRecords')}</p>}
          {records.length>limit?<button type="button" onClick={()=>setLimit(value=>value+30)}>{t('tasks.flow.loadMore')}</button>:null}
        </section>
        <section><h2 className="flow-group-heading">{t('tasks.flow.projects')}</h2><div className="flow-attribution"><div className="flow-attribution-head"><span>{t('tasks.flow.project')}</span><span>{t('tasks.flow.completedCount')}</span><span>{t('tasks.flow.focusMinutes')}</span></div>{[...attribution.entries()].map(([id,row])=><div key={id}><span>{row.title}</span><strong>{row.completed}</strong><strong>{sessionsAvailable?Math.round(row.minutes):'—'}</strong></div>)}</div><p className="flow-caption">{t('tasks.flow.projectHint')}</p></section>
        {review.undatedCompletions.length?<details className="flow-undated"><summary>{t('tasks.flow.undated')} · {review.undatedCompletions.length}</summary><p className="flow-caption">{t('tasks.flow.undatedHint')}</p>{review.undatedCompletions.slice(0,undatedLimit).map(task=><button type="button" key={task.id} onClick={()=>actions.open(task)}>{task.title}</button>)}{review.undatedCompletions.length>undatedLimit?<button type="button" onClick={()=>setUndatedLimit(value=>value+20)}>{t('tasks.flow.loadMore')}</button>:null}</details>:null}
      </main>
      <aside className="flow-friction"><h2>{t('tasks.flow.currentFriction')}</h2><p className="flow-caption">{t('tasks.flow.frictionHint')}</p>
        {friction.filter(item=>item.items.length>0).map(item=><section key={item.key}><h3>{t(`tasks.flow.${item.key}`,{n:item.items.length})}</h3>{item.items.slice(0,3).map(task=><button type="button" key={task.id} onClick={()=>actions.open(task)}>{task.title} →</button>)}</section>)}
        {friction.every(item=>item.items.length===0)?<p className="flow-empty">{t('tasks.flow.noFriction')}</p>:null}
        <button type="button" className="flow-text-button" onClick={()=>onViewChange('list')}>{t('tasks.flow.boardTitle')} →</button><button type="button" className="flow-text-button" onClick={()=>onViewChange('today')}>{t('tasks.flow.backPlan')} →</button>
      </aside>
    </div>
  </div>
}
