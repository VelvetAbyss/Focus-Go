import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from '../../../data/models/types'
import { moveWorkflowTask, planTaskToday, validLocalDate, workflowNextStatus } from './taskWorkflow'
const repo=vi.hoisted(()=>({list:vi.fn(),update:vi.fn(),updateStatus:vi.fn()}))
vi.mock('../../../data/repositories/tasksRepo',()=>({tasksRepo:repo}))
const base:TaskItem={id:'task',title:'Original',description:'',createdAt:Date.now(),updatedAt:Date.now(),status:'todo',isToday:false,pinned:false,priority:null,tags:[],subtasks:[],taskNoteBlocks:[],activityLogs:[]}
let records:TaskItem[]
beforeEach(()=>{records=[{...base}];vi.clearAllMocks();repo.list.mockImplementation(async()=>structuredClone(records));repo.update.mockImplementation(async(t:TaskItem)=>{records=records.map(item=>item.id===t.id?t:item);return t});repo.updateStatus.mockImplementation(async(id:string,status:TaskItem['status'])=>{const task=records.find(item=>item.id===id)!;const updated={...task,status};records=records.map(item=>item.id===id?updated:item);return updated})})
describe('Workflow writes',()=>{
 it('plans the latest task snapshot without overwriting unrelated edits',async()=>{records[0].title='Edited elsewhere';await planTaskToday('task',true);expect(records[0]).toMatchObject({title:'Edited elsewhere',isToday:true})})
 it('rejects starts with unresolved blockers before writing a status',async()=>{records[0].isBlocked=true;await expect(moveWorkflowTask('task','doing')).rejects.toMatchObject({code:'blocked'});expect(repo.updateStatus).not.toHaveBeenCalled()})
 it('requires actionable waiting details and rejects impossible calendar dates',async()=>{expect(validLocalDate('2026-02-31')).toBe(false);await expect(moveWorkflowTask('task','waiting',{who:' ',followUpDate:'2026-10-09'})).rejects.toMatchObject({code:'waitingRequired'});expect(repo.update).not.toHaveBeenCalled()})
 it('stores waiting context and routes the transition through central side effects',async()=>{await moveWorkflowTask('task','waiting',{who:' Buyer ',followUpDate:'2026-10-09'});expect(records[0]).toMatchObject({status:'waiting',waitingOn:'Buyer',dueDate:'2026-10-09'});expect(repo.updateStatus).toHaveBeenCalledWith('task','waiting')})
 it('restores only waiting context after a failed transition',async()=>{records[0].dueDate='2026-10-12';repo.updateStatus.mockRejectedValueOnce(new Error('failed'));await expect(moveWorkflowTask('task','waiting',{who:'Buyer',followUpDate:'2026-10-09'})).rejects.toThrow('failed');expect(records[0]).toMatchObject({status:'todo',dueDate:'2026-10-12'});expect(records[0].waitingOn).toBeUndefined()})
 it('allows simple work to finish directly, and verification to accept separately',()=>{expect(workflowNextStatus({...base,status:'doing'})).toBe('done');expect(workflowNextStatus({...base,status:'verify'})).toBe('done');expect(workflowNextStatus({...base,status:'waiting'})).toBe('doing')})
})
