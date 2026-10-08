import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import { focusRepo } from '../../../data/repositories/focusRepo'
import { useSyncDataRefresh } from '../../../data/sync/service'
import type { FocusSession, ProjectItem, TaskItem, TaskStatus } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useToast } from '../../../shared/ui/toast/toast'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import Dialog from '../../../shared/ui/Dialog'
import { useAuthGate } from '../../auth/AuthGateContext'
import { setFocusTaskId } from '../../focus/focusTask'
import { ROUTES } from '../../../app/routes/routes'
import { useOpenRequest } from '../../../shared/navigation/openRequest'
import { withReturnPath, withTaskContext } from '../../../shared/navigation/returnPath'
import { subscribeTasksChanged, emitTasksChanged } from '../taskSync'
import TaskDrawer from '../TaskDrawer'
import TaskAddComposer, { type TaskAddComposerHandle } from '../components/TaskAddComposer'
import { parseQuickAddTaskInput, createTask } from '../application/taskActions'
import { useTaskDeletion } from '../application/useTaskDeletion'
import { blockedForExecution, localDateKey } from './taskWorkspaceModel'
import { moveWorkflowTask, planTaskToday, WorkflowError, type WaitingDetails } from './taskWorkflow'
import type { WorkspaceActions } from './WorkspaceTask'
import TodayWorkspace from './TodayWorkspace'
import WorkflowBoard from './WorkflowBoard'
import ReviewWorkspace from './ReviewWorkspace'
import './task-flow.css'

export type TaskWorkspaceView = 'today'|'list'|'analytics'
export default function TaskWorkspace({ view, onViewChange }: { view: TaskWorkspaceView; onViewChange: (view: TaskWorkspaceView) => void }) {
  const { t } = useI18n(), toast = useToast(), { isGated, requireAuth } = useAuthGate()
  const navigate = useNavigate(), location = useLocation(), [params,setParams] = useSearchParams()
  const [tasks,setTasks] = useState<TaskItem[]>([]), [projects,setProjects] = useState<ProjectItem[]>([]), [sessions,setSessions] = useState<FocusSession[]>([])
  const [loaded,setLoaded] = useState(false), [loadFailed,setLoadFailed] = useState(false), [sessionsAvailable,setSessionsAvailable] = useState(true)
  const [composerProjectId,setComposerProjectId] = useState<string|undefined>(), [projectId,setProjectId] = useState(''), [query,setQuery] = useState(''), [tag,setTag] = useState('')
  const [now,setNow] = useState(Date.now), [activeTask,setActiveTask] = useState<TaskItem|null>(null), [deleteTarget,setDeleteTarget] = useState<TaskItem|null>(null)
  const [waiting,setWaiting] = useState<{task:TaskItem; who:string; date:string}|null>(null)
  const [busyIds,setBusyIds] = useState<Set<string>>(new Set())
  const pending = useRef(new Set<string>()), reloadToken = useRef(0), composer = useRef<TaskAddComposerHandle>(null)
  const deleteTasks = useTaskDeletion()
  const load = useCallback(async () => {
    const token=++reloadToken.current
    const results=await Promise.allSettled([tasksRepo.list(),projectsRepo.list(),focusRepo.listSessions()])
    if(token!==reloadToken.current) return
    const [taskResult,projectResult,sessionResult]=results
    if(taskResult.status==='rejected'||projectResult.status==='rejected') {setLoadFailed(true);setLoaded(true);return}
    setTasks(taskResult.value);setProjects(projectResult.value);setLoadFailed(false);setLoaded(true)
    setActiveTask(prev=>prev?taskResult.value.find(task=>task.id===prev.id)??null:null)
    setSessionsAvailable(sessionResult.status==='fulfilled')
    if(sessionResult.status==='fulfilled') setSessions(sessionResult.value)
  },[])
  useEffect(()=> {const generations=reloadToken;void load();const unsubscribe=subscribeTasksChanged(()=>void load());const refresh=()=>{setNow(Date.now());void load()};window.addEventListener('focus:timer-updated',refresh);window.addEventListener('focus',refresh);return()=>{unsubscribe();window.removeEventListener('focus:timer-updated',refresh);window.removeEventListener('focus',refresh);generations.current++}},[load])
  useSyncDataRefresh(load,['tasks','projects','focusSessions'])
  useVisibleInterval(()=>setNow(Date.now()),60_000,{runOnVisible:true})
  const linkedId=params.get('task')
  useEffect(()=> {if(loaded&&linkedId) setActiveTask(tasks.find(task=>task.id===linkedId)??null)},[linkedId,loaded,tasks])
  useEffect(()=> {if(projectId&&!projects.some(project=>project.id===projectId)) setProjectId('')},[projectId,projects])
  useEffect(()=> {const key=(event:KeyboardEvent)=>{const target=event.target as HTMLElement|null;if(event.defaultPrevented||activeTask||waiting||view==='analytics'||target?.matches('input,textarea,select,[contenteditable=true]')) return;if(event.key.toLowerCase()==='n'&&!event.metaKey&&!event.ctrlKey&&!event.altKey){event.preventDefault();composer.current?.focus()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[activeTask,view,waiting])
  const open = (task:TaskItem) => {setActiveTask(task);setParams(current=>{const next=new URLSearchParams(current);next.set('task',task.id);return next})}
  useOpenRequest('task',loaded,id=>{const task=tasks.find(item=>item.id===id);if(task) open(task)})
  const close = () => {setActiveTask(null);setParams(current=>{const next=new URLSearchParams(current);next.delete('task');return next},{replace:true})}
  const run = async (id:string,operation:()=>Promise<unknown>) => {
    if(pending.current.has(id)) return false
    if(isGated){requireAuth(()=>undefined);return false}
    pending.current.add(id);setBusyIds(new Set(pending.current))
    try {await operation();emitTasksChanged('task-workspace:mutation');await load();return true}
    catch(error){const message=error instanceof WorkflowError&&error.code==='blocked'?t('tasks.flow.blockedError'):error instanceof WorkflowError&&error.code==='waitingRequired'?t('tasks.flow.waitingRequired'):t('tasks.flow.mutationFailed');toast.push({variant:'error',message});await load();return false}
    finally{pending.current.delete(id);setBusyIds(new Set(pending.current))}
  }
  const move = (task:TaskItem,status:TaskStatus) => {
    if(status==='waiting'){const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);setWaiting({task,who:task.waitingOn??'',date:task.status==='waiting'&&task.dueDate?task.dueDate:localDateKey(tomorrow.getTime())});return}
    void (async()=>{
      let previousStatus=task.status
      let result:TaskItem|undefined
      const success=await run(task.id,async()=>{
        const latest=(await tasksRepo.list()).find(item=>item.id===task.id)
        if(!latest) throw new WorkflowError('missingTask')
        previousStatus=latest.status
        result=await moveWorkflowTask(task.id,status)
      })
      if(success&&status==='done'&&previousStatus!=='done'&&result) toast.push({message:t('tasks.flow.completedToast',{title:result.title}),actionLabel:t('tasks.flow.undo'),onAction:()=>{
        void run(task.id,async()=>{if(!await tasksRepo.updateStatus(task.id,previousStatus)) throw new WorkflowError('missingTask')})
      }})
    })()
  }
  const focus = (task:TaskItem) => {void (async()=>{
    const success=await run(task.id,async()=>{const all=await tasksRepo.list();const latest=all.find(item=>item.id===task.id);if(!latest) throw new WorkflowError('missingTask');if(blockedForExecution(latest,all)) throw new WorkflowError('blocked');await moveWorkflowTask(task.id,'doing')})
    if(success){setFocusTaskId(task.id);navigate(withReturnPath(ROUTES.FOCUS,withTaskContext(`${location.pathname}${location.search}`,task.id)))}
  })()}
  const actions:WorkspaceActions={open,move,focus,unblock:task=>{void run(task.id,async()=>{const latest=(await tasksRepo.list()).find(item=>item.id===task.id);if(!latest) throw new WorkflowError('missingTask');await tasksRepo.update({...latest,isBlocked:false})})},plan:(task,value)=>{void run(task.id,()=>planTaskToday(task.id,value))},busy:id=>busyIds.has(id)}
  const search=useDeferredValue(query.trim().toLowerCase())
  const scoped=tasks.filter(task=>(!projectId||task.projectId===projectId)&&(!tag||task.tags.some(value=>value.trim().toLowerCase()===tag))&&(!search||[task.title,task.description,task.waitingOn??'',...task.tags].join(' ').toLowerCase().includes(search)))
  const scopedIds=new Set(scoped.map(task=>task.id))
  const scopedSessions=sessions.filter(session=>!projectId&&!tag&&!search || Boolean(session.taskId&&scopedIds.has(session.taskId)))
  const tags=[...new Set(tasks.flatMap(task=>task.tags.map(value=>value.trim().toLowerCase())).filter(value=>value&&!['undefined','null'].includes(value)))].sort()
  const filtered=Boolean(projectId||query||tag)
  const add=async(raw:string,attachments?:TaskItem['attachments'],selectedProjectId?:string)=>{
    return run('__composer__',async()=>{const parsed=await parseQuickAddTaskInput(raw,{projects,fallbackProjectId:selectedProjectId||projectId||undefined});await createTask({...parsed,isToday:view==='today'||parsed.isToday===true,status:'todo',attachments,subtasks:[]})})
  }
  return <section className="task-flow" data-flow-view={view}>
    <div className="flow-controls"><input type="search" className="flow-search" aria-label={t('tasks.flow.search')} placeholder={t('tasks.flow.search')} value={query} onChange={event=>setQuery(event.target.value)}/>
      <select aria-label={t('tasks.flow.project')} value={projectId} onChange={event=>setProjectId(event.target.value)}><option value="">{t('tasks.flow.allProjects')}</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select>
      <select aria-label={t('tasks.drawer.tags')} value={tag} onChange={event=>setTag(event.target.value)}><option value="">{t('tasks.flow.allTags')}</option>{tags.map(value=><option key={value} value={value}>#{value}</option>)}</select>
      {filtered?<button type="button" onClick={()=>{setProjectId('');setQuery('');setTag('')}}>{t('tasks.flow.clear')}</button>:null}
    </div>
    {loadFailed?<div role="alert" className="flow-load-error">{t('tasks.flow.loadFailed')} <button type="button" onClick={()=>void load()}>{t('tasks.flow.retry')}</button></div>:null}
    {!loaded?<p role="status" className="flow-empty">{t('tasks.flow.loading')}</p>:<div className="flow-content">
      {view==='today'?<TodayWorkspace tasks={scoped} allTasks={tasks} projects={projects} now={now} actions={actions} onBulkPlan={async ids=>{let ok=true;for(const id of ids) if(!await run(id,()=>planTaskToday(id,true))) ok=false;return ok}}/>
        :view==='list'?<WorkflowBoard tasks={scoped} allTasks={tasks} projects={projects} actions={actions}/>
        :<ReviewWorkspace tasks={scoped} allTasks={tasks} projects={projects} sessions={scopedSessions} sessionsAvailable={sessionsAvailable} now={now} actions={actions} onViewChange={onViewChange}/>}
    </div>}
    {waiting?<form className="flow-waiting-form" onSubmit={event=>{event.preventDefault();const details:WaitingDetails={who:waiting.who,followUpDate:waiting.date};void run(waiting.task.id,()=>moveWorkflowTask(waiting.task.id,'waiting',details)).then(success=>{if(success) setWaiting(null)})}}>
      <header><h2>{t('tasks.flow.waitingTitle')}</h2><button type="button" disabled={actions.busy(waiting.task.id)} onClick={()=>setWaiting(null)}>{t('tasks.flow.cancel')}</button></header><p>{waiting.task.title}</p>
      <label>{t('tasks.flow.waitingWho')}<input autoFocus required value={waiting.who} onChange={event=>setWaiting({...waiting,who:event.target.value})}/></label>
      <label>{t('tasks.flow.waitingDate')}<input type="date" required value={waiting.date} onChange={event=>setWaiting({...waiting,date:event.target.value})}/></label>
      <button type="submit" className="flow-cta" disabled={actions.busy(waiting.task.id)}>{t('tasks.flow.waitingSave')}</button>
    </form>:null}
    {view!=='analytics'?<TaskAddComposer ref={composer} hero projects={projects.filter(project=>project.status!=='archived')} selectedProjectId={projectId||composerProjectId} projectLocked={Boolean(projectId)} onProjectChange={setComposerProjectId} placeholder={view==='today'?t('tasks.today.addPlaceholder'):undefined} onSubmit={add}/>:null}
    <TaskDrawer open={Boolean(activeTask)} task={activeTask} projects={projects} onClose={close} onUpdated={updated=>setTasks(prev=>prev.map(task=>task.id===updated.id?updated:task))} onDeleted={id=>{setTasks(prev=>prev.filter(task=>task.id!==id));close()}} onRequestDelete={setDeleteTarget}/>
    <Dialog open={Boolean(deleteTarget)} title={t('tasks.deleteTitle')} onClose={()=>setDeleteTarget(null)}><div className="dialog__body"><p>{t('tasks.deleteConfirm',{title:deleteTarget?.title??''})}</p><div className="dialog__actions"><button type="button" onClick={()=>setDeleteTarget(null)}>{t('tasks.cancel')}</button><button type="button" disabled={deleteTarget?actions.busy(deleteTarget.id):false} onClick={()=>{const target=deleteTarget;if(target) void run(target.id,()=>deleteTasks([target],'task-workspace')).then(success=>{if(success){setDeleteTarget(null);close()}})}}>{t('tasks.delete')}</button></div></div></Dialog>
  </section>
}
