// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { TaskItem } from '../../../data/models/types'
import TaskWorkspace from './TaskWorkspace'
const mocks=vi.hoisted(()=>({list:vi.fn(),update:vi.fn(),status:vi.fn(),push:vi.fn(),focus:vi.fn()}))
vi.mock('../../../data/repositories/tasksRepo',()=>({tasksRepo:{list:mocks.list,update:mocks.update,updateStatus:mocks.status}}))
vi.mock('../../../data/repositories/projectsRepo',()=>({projectsRepo:{list:async()=>[]}}))
vi.mock('../../../data/repositories/focusRepo',()=>({focusRepo:{listSessions:async()=>[]}}))
vi.mock('../../../data/sync/service',()=>({useSyncDataRefresh:()=>undefined}))
vi.mock('../../../shared/i18n/useI18n',()=>({useI18n:()=>({language:'en',t:(key:string,values?:Record<string,unknown>)=>key+(values?.n!==undefined?` ${values.n}`:'')})}))
vi.mock('../../../shared/ui/toast/toast',()=>({useToast:()=>({push:mocks.push})}))
vi.mock('../../auth/AuthGateContext',()=>({useAuthGate:()=>({isGated:false,requireAuth:vi.fn()})}))
vi.mock('../../focus/focusTask',()=>({setFocusTaskId:mocks.focus}))
vi.mock('../TaskDrawer',()=>({default:()=>null}))
vi.mock('../components/TaskAddComposer',()=>({default:()=>null}))
vi.mock('../application/useTaskDeletion',()=>({useTaskDeletion:()=>vi.fn()}))
vi.mock('../../../shared/ui/Dialog',()=>({default:({open,children}:{open:boolean;children:ReactNode})=>open?children:null}))
vi.mock('../../../shared/ui/popover',()=>({Popover:({children}:{children:ReactNode})=>children,PopoverTrigger:({children}:{children:ReactNode})=>children,PopoverContent:({children}:{children:ReactNode})=><div>{children}</div>}))
const task=(id:string,patch:Partial<TaskItem>={}):TaskItem=>({id,title:id,description:'',createdAt:Date.now(),updatedAt:Date.now(),pinned:false,isToday:false,status:'todo',priority:null,tags:[],subtasks:[],taskNoteBlocks:[],activityLogs:[],...patch})
let records:TaskItem[]
beforeEach(()=>{vi.clearAllMocks();records=[];mocks.list.mockImplementation(async()=>structuredClone(records));mocks.update.mockImplementation(async(updated:TaskItem)=>{records=records.map(item=>item.id===updated.id?updated:item);return updated});mocks.status.mockImplementation(async(id:string,status:TaskItem['status'])=>{const latest=records.find(item=>item.id===id)!;const updated={...latest,status,activityLogs:[...latest.activityLogs,{id:'completion',type:'status' as const,message:status==='done'?'Status changed to Done':`Status changed to ${status}`,createdAt:Date.now()}]};records=records.map(item=>item.id===id?updated:item);return updated})})
afterEach(cleanup)
function Location(){const location=useLocation();return <output data-testid="location">{location.pathname}{location.search}</output>}
const mount=(view:'today'|'list'|'analytics')=>render(<MemoryRouter initialEntries={['/tasks']}><TaskWorkspace view={view} onViewChange={vi.fn()}/><Location/></MemoryRouter>)
describe('Task workspace user workflows',()=>{
 it('does not auto-plan overdue tasks, and lets the user add one to their plan',async()=>{
  records=[task('overdue',{dueDate:'2020-01-01'})];mount('today')
  await screen.findByText('overdue')
  expect(screen.getByText('tasks.flow.noNext')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'+ tasks.flow.addPlan'}))
  await waitFor(()=>expect(records[0].isToday).toBe(true))
  await waitFor(()=>expect(screen.queryByText('tasks.flow.noNext')).not.toBeInTheDocument())
 })
 it('saves waiting details before an actionable status transition',async()=>{
  records=[task('waiting-item',{status:'waiting',waitingOn:'Original',dueDate:'2026-10-09'})];mount('list')
  fireEvent.click(await screen.findByRole('button',{name:'tasks.flow.waitingEdit'}))
  fireEvent.change(screen.getByLabelText('tasks.flow.waitingWho'),{target:{value:'Buyer response'}})
  fireEvent.change(screen.getByLabelText('tasks.flow.waitingDate'),{target:{value:'2026-10-12'}})
  fireEvent.click(screen.getByRole('button',{name:'tasks.flow.waitingSave'}))
  await waitFor(()=>expect(records[0]).toMatchObject({status:'waiting',waitingOn:'Buyer response',dueDate:'2026-10-12'}))
  await waitFor(()=>expect(screen.queryByRole('button',{name:'tasks.flow.waitingSave'})).not.toBeInTheDocument())
 })
 it('accepts verification through the repository and can undo it',async()=>{
  records=[task('verify-result',{status:'verify'})];mount('list')
  fireEvent.click(await screen.findByRole('button',{name:'tasks.flow.accept'}))
  await waitFor(()=>expect(records[0].status).toBe('done'))
  const notice=mocks.push.mock.calls.find(([notice])=>notice.onAction)?.[0]
  expect(notice).toBeDefined()
  await waitFor(()=>expect(mocks.list).toHaveBeenCalled())
  // Give the completed action time to release its per-task mutation lock.
  await waitFor(()=>expect(screen.queryByRole('button',{name:'tasks.flow.accept'})).not.toBeInTheDocument())
  notice.onAction()
  await waitFor(()=>expect(records[0].status).toBe('verify'))
 })
 it('starts focus only after the task status write succeeds',async()=>{
  records=[task('selected',{isToday:true})];mount('today')
  const buttons=await screen.findAllByRole('button',{name:/tasks.flow.focus/})
  fireEvent.click(buttons[0])
  await waitFor(()=>expect(records[0].status).toBe('doing'))
  await waitFor(()=>expect(mocks.focus).toHaveBeenCalledWith('selected'))
  expect(screen.getByTestId('location')).toHaveTextContent('/focus')
 })
 it('keeps a failed transition on the original queue with an error notice',async()=>{
  records=[task('not-saved')];mocks.status.mockRejectedValueOnce(new Error('offline'));mount('list')
  const region=await screen.findByRole('region',{name:'tasks.flow.queueTodo'})
  fireEvent.click(within(region).getByRole('button',{name:'tasks.status.start'}))
  await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({variant:'error'})))
  expect(records[0].status).toBe('todo')
  expect(within(region).getByText('not-saved')).toBeInTheDocument()
 })
})
