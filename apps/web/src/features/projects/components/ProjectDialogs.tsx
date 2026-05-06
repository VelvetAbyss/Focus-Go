import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Search } from 'lucide-react'
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
import type { LifePerson, ProjectItem, ProjectPerson, TaskItem } from '../../../data/models/types'
import { peopleRepo } from '../../../data/repositories/peopleRepo'
import { PROJECT_COLORS, resolveProjectColor } from '../../../shared/design/tokens'
import { useProjectsI18n } from '../projectsI18n'

type ProjectFormPayload = {
  title: string
  goal: string
  description: string
  color?: string
  status: ProjectItem['status']
  priority: ProjectItem['priority']
  ownerId?: string
  startDate?: string
  dueDate?: string
  nextAction?: string
  riskSummary?: string
}

type ProjectFormDialogProps = {
  open: boolean
  project?: ProjectItem | null
  people: ProjectPerson[]
  onClose: () => void
  onAutoSave?: (payload: ProjectFormPayload) => Promise<void> | void
  onSubmit: (payload: ProjectFormPayload) => Promise<void> | void
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

const GROUP_COLORS: Record<string, string> = {
  Family: '#f59e0b',
  Friends: '#10b981',
  Work: '#3b82f6',
  Community: '#8b5cf6',
  Other: '#9ca3af',
}

export const ProjectFormDialog = ({ open, project, people, onClose, onAutoSave, onSubmit }: ProjectFormDialogProps) => {
  const i18n = useProjectsI18n()
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])
  const [status, setStatus] = useState<ProjectItem['status']>('planning')
  const [priority, setPriority] = useState<ProjectItem['priority']>('medium')
  const [ownerId, setOwnerId] = useState<string>('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [riskSummary, setRiskSummary] = useState('')

  const isInitializedRef = useRef(false)

  useEffect(() => {
    isInitializedRef.current = false
    if (!open) return
    setTitle(project?.title ?? '')
    setGoal(project?.goal ?? '')
    setDescription(project?.description ?? '')
    setColor(project ? resolveProjectColor(project) : PROJECT_COLORS[0])
    setStatus(project?.status ?? 'planning')
    setPriority(project?.priority ?? 'medium')
    setOwnerId(project?.ownerId ?? 'unassigned')
    setStartDate(project?.startDate ?? '')
    setDueDate(project?.dueDate ?? '')
    setNextAction(project?.nextAction ?? '')
    setRiskSummary(project?.riskSummary ?? '')
  }, [open, project])

  useEffect(() => {
    if (!open || !onAutoSave || !project) return
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      void onAutoSave({
        title, goal, description, status, priority,
        color,
        ownerId: ownerId === 'unassigned' ? undefined : ownerId,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        nextAction: nextAction || undefined,
        riskSummary: riskSummary || undefined,
      })
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, goal, description, color, status, priority, ownerId, startDate, dueDate, nextAction, riskSummary])

  const canSubmit = title.trim().length > 0
  const isEditMode = !!project && !!onAutoSave

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
            <p className="project-dialog__eyebrow">{i18n.dialog.projectEyebrow}</p>
            <h2 className="project-dialog__title">{project ? i18n.dialog.editProject : i18n.dialog.newProject}</h2>
          </div>
        </div>

        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldTitle}</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClassName} placeholder={i18n.dialog.titlePlaceholder} />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldGoal}</span>
              <Input value={goal} onChange={(event) => setGoal(event.target.value)} className={inputClassName} placeholder={i18n.dialog.goalPlaceholder} />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldDescription}</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClassName} placeholder={i18n.dialog.descPlaceholder} />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <div className="project-dialog__field">
              <span>Project color</span>
              <div className="project-dialog__swatches" role="radiogroup" aria-label="Project color">
                {PROJECT_COLORS.map((nextColor) => (
                  <button
                    key={nextColor}
                    type="button"
                    role="radio"
                    aria-checked={color === nextColor}
                    className={`project-dialog__swatch${color === nextColor ? ' is-active' : ''}`}
                    style={{ background: nextColor }}
                    onClick={() => setColor(nextColor)}
                  >
                    <span className="sr-only">{nextColor}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldStatus}</span>
              <Select value={status} onValueChange={(value: ProjectItem['status']) => setStatus(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">{i18n.dialog.statusPlanning}</SelectItem>
                  <SelectItem value="active">{i18n.dialog.statusActive}</SelectItem>
                  <SelectItem value="blocked">{i18n.dialog.statusBlocked}</SelectItem>
                  <SelectItem value="done">{i18n.dialog.statusDone}</SelectItem>
                  <SelectItem value="archived">{i18n.dialog.statusArchived}</SelectItem>
                </SelectContent>
              </Select>
            </label>

            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldPriority}</span>
              <Select value={priority ?? 'medium'} onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{i18n.dialog.priorityHigh}</SelectItem>
                  <SelectItem value="medium">{i18n.dialog.priorityMedium}</SelectItem>
                  <SelectItem value="low">{i18n.dialog.priorityLow}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldOwner}</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className={inputClassName}><SelectValue placeholder={i18n.dialog.unassigned} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{i18n.dialog.unassigned}</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <div className="project-dialog__field">
              <span>{i18n.dialog.fieldStartDate}</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </div>
          </div>

          <div className="project-dialog__grid">
            <div className="project-dialog__field">
              <span>{i18n.dialog.fieldDueDate}</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClassName} />
            </div>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldNextAction}</span>
              <Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} className={inputClassName} placeholder={i18n.dialog.nextActionPlaceholder} />
            </label>
          </div>

          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldRiskSummary}</span>
              <Textarea value={riskSummary} onChange={(event) => setRiskSummary(event.target.value)} className={textareaClassName} placeholder={i18n.dialog.riskPlaceholder} />
            </label>
          </div>
        </div>

        <div className="project-dialog__footer">
          {isEditMode ? (
            <Button type="button" className="project-button project-button--primary" onClick={onClose}>
              {i18n.dialog.done}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
                {i18n.dialog.cancel}
              </Button>
              <Button
                type="button"
                className="project-button project-button--primary"
                disabled={!canSubmit}
                onClick={() => void onSubmit({
                  title,
                  goal,
                  description,
                  color,
                  status,
                  priority,
                  ownerId: ownerId === 'unassigned' ? undefined : ownerId,
                  startDate: startDate || undefined,
                  dueDate: dueDate || undefined,
                  nextAction: nextAction || undefined,
                  riskSummary: riskSummary || undefined,
                })}
              >
                {i18n.dialog.createProject}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}

export const PersonFormDialog = ({ open, person, onClose, onSubmit }: PersonFormDialogProps) => {
  const i18n = useProjectsI18n()
  const [name, setName] = useState('')
  const [roleType, setRoleType] = useState<ProjectPerson['roleType']>('collaborator')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  const [contacts, setContacts] = useState<LifePerson[]>([])
  const [contactQuery, setContactQuery] = useState('')
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(person?.name ?? '')
    setRoleType(person?.roleType ?? 'collaborator')
    setPhone(person?.phone ?? '')
    setEmail(person?.email ?? '')
    setNote(person?.note ?? '')
    setContactQuery('')
    setSelectedContactId(null)
  }, [open, person])

  useEffect(() => {
    if (!open || person) return
    void peopleRepo.list().then(setContacts)
  }, [open, person])

  const filteredContacts = useMemo(() => {
    const q = contactQuery.trim().toLowerCase()
    const list = q
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.role?.toLowerCase().includes(q)
        )
      : contacts
    return list.slice(0, 20)
  }, [contacts, contactQuery])

  const handleSelectContact = (contact: LifePerson) => {
    if (selectedContactId === contact.id) {
      setSelectedContactId(null)
      setName('')
      setPhone('')
      setEmail('')
      setNote('')
    } else {
      setSelectedContactId(contact.id)
      setName(contact.name)
      setPhone(contact.phone ?? '')
      setEmail(contact.email ?? '')
      setNote(contact.notes ?? '')
    }
  }

  const dialogTitle = useMemo(() => (person ? i18n.dialog.editPerson : i18n.dialog.addPerson), [person, i18n])

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
            <p className="project-dialog__eyebrow">{i18n.dialog.peopleEyebrow}</p>
            <h2 className="project-dialog__title">{dialogTitle}</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          {!person && contacts.length > 0 ? (
            <div className="pd-contact-picker">
              <p className="pd-contact-picker__label">{i18n.dialog.fromContacts}</p>
              <div className="pd-contact-picker__search-wrap">
                <Search className="pd-contact-picker__search-icon" size={14} />
                <input
                  className="pd-contact-picker__search"
                  placeholder={i18n.dialog.searchContacts}
                  value={contactQuery}
                  onChange={(e) => setContactQuery(e.target.value)}
                />
              </div>
              <div className="pd-contact-picker__list">
                {filteredContacts.length === 0 ? (
                  <p className="pd-contact-picker__empty">{i18n.dialog.noContactsMatch}</p>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSelected = selectedContactId === contact.id
                    const color = GROUP_COLORS[contact.group] ?? '#9ca3af'
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        className={`pd-contact-item${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handleSelectContact(contact)}
                      >
                        <span
                          className="pd-contact-item__avatar"
                          style={{ background: color + '22', color }}
                        >
                          {contact.avatarInitials || contact.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="pd-contact-item__info">
                          <span className="pd-contact-item__name">{contact.name}</span>
                          {contact.role || contact.group ? (
                            <span className="pd-contact-item__meta">{contact.role || contact.group}</span>
                          ) : null}
                        </span>
                        {isSelected ? (
                          <Check className="pd-contact-item__check" size={14} />
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="pd-contact-picker__divider">
                <span>{i18n.dialog.orFillManually}</span>
              </div>
            </div>
          ) : null}
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldName}</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} placeholder={i18n.dialog.namePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldRole}</span>
              <Select value={roleType} onValueChange={(value: ProjectPerson['roleType']) => setRoleType(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{i18n.dialog.roleOwner}</SelectItem>
                  <SelectItem value="collaborator">{i18n.dialog.roleCollaborator}</SelectItem>
                  <SelectItem value="reviewer">{i18n.dialog.roleReviewer}</SelectItem>
                  <SelectItem value="external">{i18n.dialog.roleExternal}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldPhone}</span>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClassName} placeholder={i18n.dialog.phonePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldEmail}</span>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} placeholder={i18n.dialog.emailPlaceholder} />
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldNote}</span>
              <Input value={note} onChange={(event) => setNote(event.target.value)} className={inputClassName} placeholder={i18n.dialog.notePlaceholder} />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
            {i18n.dialog.cancel}
          </Button>
          <Button
            type="button"
            className="project-button project-button--primary"
            disabled={name.trim().length === 0}
            onClick={() => void onSubmit({ name, roleType, phone: phone || undefined, email: email || undefined, note: note || undefined })}
          >
            {person ? i18n.dialog.savePerson : i18n.dialog.addPerson}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

type ProjectTaskPayload = {
  title: string
  description: string
  status: 'todo' | 'doing' | 'done'
  priority: 'high' | 'medium' | 'low'
  ownerId?: string
  dueDate?: string
  startDate?: string
}

type ProjectTaskDialogProps = {
  open: boolean
  task?: TaskItem | null
  people: ProjectPerson[]
  onClose: () => void
  onAutoSave?: (payload: ProjectTaskPayload) => Promise<void> | void
  onSubmit: (payload: ProjectTaskPayload) => Promise<void> | void
}

export const ProjectTaskDialog = ({ open, task, people, onClose, onAutoSave, onSubmit }: ProjectTaskDialogProps) => {
  const i18n = useProjectsI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'todo' | 'doing' | 'done'>('todo')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [ownerId, setOwnerId] = useState('unassigned')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  const isInitializedRef = useRef(false)

  useEffect(() => {
    isInitializedRef.current = false
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setStatus(task?.status ?? 'todo')
    setPriority(task?.priority ?? 'medium')
    setOwnerId(task?.ownerId ?? 'unassigned')
    setStartDate(task?.startDate ?? '')
    setDueDate(task?.dueDate ?? '')
  }, [open, task])

  useEffect(() => {
    if (!open || !onAutoSave || !task) return
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      void onAutoSave({
        title, description, status, priority,
        ownerId: ownerId === 'unassigned' ? undefined : ownerId,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      })
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, priority, ownerId, startDate, dueDate])

  const isEditMode = !!task && !!onAutoSave

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
            <p className="project-dialog__eyebrow">{i18n.dialog.tasksEyebrow}</p>
            <h2 className="project-dialog__title">{task ? i18n.dialog.editTask : i18n.dialog.addTask}</h2>
          </div>
        </div>
        <div className="project-dialog__body">
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldTitle}</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClassName} placeholder={i18n.dialog.taskTitlePlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldDescription}</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClassName} placeholder={i18n.dialog.taskDescPlaceholder} />
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldStatus}</span>
              <Select value={status} onValueChange={(value: 'todo' | 'doing' | 'done') => setStatus(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">{i18n.dialog.taskStatusTodo}</SelectItem>
                  <SelectItem value="doing">{i18n.dialog.taskStatusInProgress}</SelectItem>
                  <SelectItem value="done">{i18n.dialog.taskStatusDone}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldPriority}</span>
              <Select value={priority} onValueChange={(value: 'high' | 'medium' | 'low') => setPriority(value)}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{i18n.dialog.priorityHigh}</SelectItem>
                  <SelectItem value="medium">{i18n.dialog.priorityMedium}</SelectItem>
                  <SelectItem value="low">{i18n.dialog.priorityLow}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <div className="project-dialog__grid">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldOwner}</span>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className={inputClassName}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">{i18n.dialog.unassigned}</SelectItem>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldStartDate}</span>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
          <div className="project-dialog__grid project-dialog__grid--single">
            <label className="project-dialog__field">
              <span>{i18n.dialog.fieldDueDate}</span>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClassName} />
            </label>
          </div>
        </div>
        <div className="project-dialog__footer">
          {isEditMode ? (
            <Button type="button" className="project-button project-button--primary" onClick={onClose}>
              {i18n.dialog.done}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" className="project-button project-button--secondary" onClick={onClose}>
                {i18n.dialog.cancel}
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
                {i18n.dialog.addTask}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
