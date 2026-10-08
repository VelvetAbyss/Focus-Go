// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem, FocusSession } from '../../../data/models/types'
import ReviewWorkspace from './ReviewWorkspace'
vi.mock('../../../shared/i18n/useI18n',()=>({useI18n:()=>({language:'en',t:(key:string)=>key})}))
vi.mock('../../../shared/ui/toast/toast',()=>({useToast:()=>({push:vi.fn()})}))
const now=new Date(2026,9,8,14).getTime()
const task={id:'completed',title:'Verified result',description:'',status:'done',priority:null,isToday:false,pinned:false,tags:[],subtasks:[],taskNoteBlocks:[],createdAt:now,updatedAt:now,activityLogs:[{id:'done',type:'status',message:'Status changed to Done',createdAt:now}]} as TaskItem
const actions={open:vi.fn(),move:vi.fn(),plan:vi.fn(),focus:vi.fn(),unblock:vi.fn(),busy:()=>false}
afterEach(()=>{cleanup();vi.clearAllMocks()})
describe('Evidence review interactions',()=>{
 it('changes real period boundaries, excludes current records in the previous period and restores them',()=>{
  render(<ReviewWorkspace tasks={[task]} allTasks={[task]} projects={[]} sessions={[]} sessionsAvailable actions={actions} now={now} onViewChange={vi.fn()}/>)
  expect(screen.getByRole('button',{name:/Verified result/})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'tasks.flow.previous'}))
  expect(screen.queryByRole('button',{name:/Verified result/})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'tasks.flow.current'}))
  fireEvent.click(screen.getByRole('button',{name:/Verified result/}))
  expect(actions.open).toHaveBeenCalledWith(task)
 })
 it('drills into a real day and allows clearing the day selection',()=>{
  render(<ReviewWorkspace tasks={[task]} allTasks={[task]} projects={[]} sessions={[]} sessionsAvailable actions={actions} now={now} onViewChange={vi.fn()}/>)
  const zeroDay=screen.getByRole('button',{name:/Oct 5.*0 tasks.flow.taskTrend/})
  fireEvent.click(zeroDay)
  expect(screen.queryByRole('button',{name:/Verified result/})).not.toBeInTheDocument()
  expect(zeroDay).toHaveAttribute('aria-pressed','true')
  fireEvent.click(zeroDay)
  expect(screen.getByRole('button',{name:/Verified result/})).toBeInTheDocument()
 })
 it('does not present failed focus loading as zero measured minutes',()=>{
  render(<ReviewWorkspace tasks={[task]} allTasks={[task]} projects={[]} sessions={[] as FocusSession[]} sessionsAvailable={false} actions={actions} now={now} onViewChange={vi.fn()}/>)
  expect(screen.getAllByText('tasks.flow.focusUnavailable')).toHaveLength(2)
  expect(screen.getByRole('button',{name:'tasks.flow.focusTrend'})).toBeDisabled()
 })
})
