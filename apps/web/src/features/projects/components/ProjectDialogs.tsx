import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Dialog from '../../../shared/ui/Dialog'
import type { ProjectItem, ProjectPerson } from '../../../data/models/types'

type ProjectFormDialogProps = {
  open: boolean
  project?: ProjectItem | null
  people: ProjectPerson[]
  onClose: () => void
  onSubmit: (payload: {
    title: string
    goal: string
    description: string
    status: ProjectItem['status']
    priority: ProjectItem['priority']
    ownerId?: string
    startDate?: string
    dueDate?: string
    nextAction?: string
    riskSummary?: string
  }) => Promise<void> | void
}

type PersonFormDialogProps = {
  open: boolean
  person?: ProjectPerson | null
  onClose: () => void
  onSubmit: (payload: {
    name: string
    roleType: ProjectPerson['roleType']
    phone?: string
    email?: string
    note?: string
  }) => Promise<void> | void
}

const inputClassName = 'h-11 rounded-2xl border-[#3A3733]/12 bg-white text-[#3A3733] shadow-none'
const textareaClassName = 'min-h-[112px] rounded-3xl border-[#3A3733]/12 bg-white text-[#3A3733] shadow-none'

export const ProjectFormDialog = ({ open, project, people, onClose, onSubmit }: ProjectFormDialogProps) => {
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectItem['status']>('planning')
  const [priority, setPriority] = useState<ProjectItem['priority']>('medium')
  const [ownerId, setOwnerId] = useState<string>('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [riskSummary, setRiskSummary] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(project?.title ?? '')
    setGoal(project?.goal ?? '')
    setDescription(project?.description ?? '')
    setStatus(project?.status ?? 'planning')
    setPriority(project?.priority ?? 'medium')
    setOwnerId(project?.ownerId ?? 'unassigned')
    setStartDate(project?.startDate ?? '')
    setDueDate(project?.dueDate ?? '')
    setNextAction(project?.nextAction ?? '')
    setRiskSummary(project?.riskSummary ?? '')
  }, [open, project])

  const canSubmit = title.trim().length > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(760px,calc(100vw-32px))] rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="project-dialog">
        <div className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">Project</p>
            <h2 className="project-dialog__title">{project ? 'Edit Project' : 'New Project'}</h2>
          </div>
        </div>

        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClassName} placeholder="Focus&go v2 Launch" />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Goal</span>
              <Input value={goal} onChange={(event) => setGoal(event.target.value)} className={inputClassName} placeholder="Launch the next major version smoothly" />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClassName} placeholder="Describe the project and what success looks like." />
            </label>
          </div>

          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Status</span>
              <Select value={status} onValueChange={(value: ProjectItem['status']) => setStatus(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="project-dialog__field">
              <span>Priority</span>
              <Select value={priority ?? 'medium'} onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Owner</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className={inputClassName}><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="project-dialog__field">
              <span>Start Date</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </div>
          </div>

          <div className="project-dialog__grid">
            <div className="project-dialog__field">
              <span>Due Date</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClassName} />
            </div>
            <label className="project-dialog__field">
              <span>Next Action</span>
              <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} className={inputClassName} placeholder="Complete API integration testing" />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Risk Summary</span>
              <Textarea value={riskSummary} onChange={(event) => setRiskSummary(event.target.value)} className={textareaClassName} placeholder="Timeline may be tight for final user testing." />
            </label>
          </div>
        </div>

        <div className="project-dialog__footer">
          <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="project-button project-button--primary"
            disabled={!canSubmit}
            onClick={() => void onSubmit({
              title,
              goal,
              description,
              status,
              priority,
              ownerId: ownerId === 'unassigned' ? undefined : ownerId,
              startDate: startDate || undefined,
              dueDate: dueDate || undefined,
              nextAction: nextAction || undefined,
              riskSummary: riskSummary || undefined,
            })}
          >
            {project ? 'Save Changes' : 'Create Project'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export const PersonFormDialog = ({ open, person, onClose, onSubmit }: PersonFormDialogProps) => {
  const [name, setName] = useState('')
  const [roleType, setRoleType] = useState<ProjectPerson['roleType']>('collaborator')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setRoleType(person?.roleType ?? 'collaborator')
    setPhone(person?.phone ?? '')
    setEmail(person?.email ?? '')
    setNote(person?.note ?? '')
  }, [open, person])

  const title = useMemo(() => (person ? 'Edit Person' : 'Add Person'), [person])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(560px,calc(100vw-32px))] rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="project-dialog">
        <div className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">People</p>
            <h2 className="project-dialog__title">{title}</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} placeholder="Sarah Chen" />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Role</span>
              <Select value={roleType} onValueChange={(value: ProjectPerson['roleType']) => setRoleType(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="collaborator">Collaborator</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="external">External</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>Phone</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClassName} placeholder="+1 (555) 123-4567" />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Email</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} placeholder="sarah@focusgo.com" />
            </label>
            <label className="project-dialog__field">
              <span>Note</span>
              <Input value={note} onChange={(event) => setNote(event.target.value)} className={inputClassName} placeholder="Owns launch decisions" />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="project-button project-button--primary"
            disabled={name.trim().length === 0}
            onClick={() => void onSubmit({ name, roleType, phone: phone || undefined, email: email || undefined, note: note || undefined })}
          >
            {person ? 'Save Person' : 'Add Person'}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

type ProjectTaskDialogProps = {
  open: boolean
  people: ProjectPerson[]
  onClose: () => void
  onSubmit: (payload: {
    title: string
    description: string
    status: 'todo' | 'doing' | 'done'
    priority: 'high' | 'medium' | 'low'
    ownerId?: string
    dueDate?: string
    startDate?: string
  }) => Promise<void> | void
}

export const ProjectTaskDialog = ({ open, people, onClose, onSubmit }: ProjectTaskDialogProps) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'todo' | 'doing' | 'done'>('todo')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [ownerId, setOwnerId] = useState('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setStatus('todo')
    setPriority('medium')
    setOwnerId('unassigned')
    setStartDate('')
    setDueDate('')
  }, [open])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="w-[min(620px,calc(100vw-32px))] rounded-[32px] border border-[#3A3733]/10 bg-[#F5F3F0]"
      contentClassName="p-0"
    >
      <div className="project-dialog">
        <div className="project-dialog__header">
          <div>
            <p className="project-dialog__eyebrow">Tasks</p>
            <h2 className="project-dialog__title">Add Task</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClassName} placeholder="Complete API integration testing" />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClassName} placeholder="Describe what needs to happen next." />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Status</span>
              <Select value={status} onValueChange={(value: 'todo' | 'doing' | 'done') => setStatus(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Todo</SelectItem>
                  <SelectItem value="doing">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>Priority</span>
              <Select value={priority} onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>Owner</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>Start Date</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>Due Date</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="project-button project-button--primary"
            disabled={title.trim().length === 0}
            onClick={() => void onSubmit({
              title,
              description,
              status,
              priority,
              ownerId: ownerId === 'unassigned' ? undefined : ownerId,
              startDate: startDate || undefined,
              dueDate: dueDate || undefined,
            })}
          >
            Add Task
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
