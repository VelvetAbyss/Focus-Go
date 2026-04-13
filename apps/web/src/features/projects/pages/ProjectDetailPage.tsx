import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ClipboardList, Mail, Pencil, Phone, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { projectPeopleRepo } from '../../../data/repositories/projectPeopleRepo'
import { projectNoteLinksRepo } from '../../../data/repositories/projectNoteLinksRepo'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import type { NoteItem, ProjectHealth, ProjectItem, ProjectPerson, TaskItem } from '../../../data/models/types'
import { ROUTES } from '../../../app/routes/routes'
import { PersonFormDialog, ProjectFormDialog, ProjectTaskDialog } from '../components/ProjectDialogs'
import '../projects.css'

type ProjectTab = 'overview' | 'tasks' | 'timeline' | 'people' | 'notes'

const tabs: Array<{ key: ProjectTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'people', label: 'People' },
  { key: 'notes', label: 'Notes' },
]

const healthToneClass: Record<ProjectHealth, string> = {
  'on-track': 'project-health-badge project-health-badge--track',
  'at-risk': 'project-health-badge project-health-badge--risk',
  blocked: 'project-health-badge project-health-badge--blocked',
}

const statusToneClass: Record<string, string> = {
  todo: 'project-task-status',
  doing: 'project-task-status project-task-status--doing',
  done: 'project-task-status project-task-status--done',
}

const labelHealth = (health: ProjectHealth) => (health === 'on-track' ? 'On Track' : health === 'at-risk' ? 'At Risk' : 'Blocked')

const sortTasksByDate = (tasks: TaskItem[]) =>
  [...tasks].sort((left, right) => (left.startDate ?? left.dueDate ?? '9999-12-31').localeCompare(right.startDate ?? right.dueDate ?? '9999-12-31'))

const ProjectDetailPage = () => {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as ProjectTab | null) ?? 'overview'
  const [project, setProject] = useState<ProjectItem | null>(null)
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [notes, setNotes] = useState<Array<{ note: NoteItem }>>([])
  const [loading, setLoading] = useState(true)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<ProjectPerson | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all')
  const [taskOwnerFilter, setTaskOwnerFilter] = useState<string>('all')
  const [timelineMode, setTimelineMode] = useState<'week' | 'month'>('week')
  const [notesQuery, setNotesQuery] = useState('')

  const load = async () => {
    if (!projectId) return
    setLoading(true)
    const [nextProject, nextPeople, nextTasks, nextNotes] = await Promise.all([
      projectsRepo.getById(projectId),
      projectPeopleRepo.listByProject(projectId),
      tasksRepo.list(),
      projectNoteLinksRepo.listByProject(projectId),
    ])
    setProject(nextProject)
    setPeople(nextPeople)
    setTasks(nextTasks.filter((task) => task.projectId === projectId))
    setNotes(nextNotes)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [projectId])

  const ownerMap = useMemo(() => new Map(people.map((person) => [person.id, person.name] as const)), [people])
  const visibleTasks = useMemo(() => {
    return sortTasksByDate(tasks).filter((task) => {
      if (taskStatusFilter !== 'all' && task.status !== taskStatusFilter) return false
      if (taskOwnerFilter !== 'all' && (task.ownerId ?? '') !== taskOwnerFilter) return false
      return true
    })
  }, [taskOwnerFilter, taskStatusFilter, tasks])
  const overdueCount = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10)
    return tasks.filter((task) => task.status !== 'done' && task.dueDate && task.dueDate < todayKey).length
  }, [tasks])
  const activeCount = useMemo(() => tasks.filter((task) => task.status === 'doing').length, [tasks])
  const completedCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks])
  const activity = useMemo(() => {
    const items = [
      ...tasks.map((task) => ({
        id: `task:${task.id}`,
        title: task.status === 'done' ? `${task.title} completed` : `Task updated: ${task.title}`,
        createdAt: task.updatedAt,
      })),
      ...people.map((person) => ({
        id: `person:${person.id}`,
        title: `People updated: ${person.name}`,
        createdAt: person.updatedAt,
      })),
      ...notes.map(({ note }) => ({
        id: `note:${note.id}`,
        title: `Note linked: ${note.title}`,
        createdAt: note.updatedAt,
      })),
    ]
    return items.sort((left, right) => right.createdAt - left.createdAt).slice(0, 6)
  }, [notes, people, tasks])
  const visibleNotes = useMemo(
    () => notes.filter(({ note }) => note.title.toLowerCase().includes(notesQuery.toLowerCase())),
    [notes, notesQuery],
  )

  if (loading) return <section className="project-page"><div className="project-empty-state">Loading project…</div></section>
  if (!project) return <section className="project-page"><div className="project-empty-state"><h2>Project not found</h2></div></section>

  return (
    <section className="project-detail-page">
      <div className="project-detail-hero">
        <div className="project-detail-hero__top">
          <Link to={ROUTES.PROJECTS} className="project-back-link"><ArrowLeft size={16} />Back to Projects</Link>
          <div className="project-detail-hero__actions">
            <Button variant="outline" className="project-button project-button--secondary" onClick={() => setProjectDialogOpen(true)}>
              <Pencil size={16} />
              Edit
            </Button>
            <Button variant="outline" className="project-button project-button--secondary" onClick={() => void projectsRepo.archive(project.id).then(load)}>
              <Trash2 size={16} />
              Archive
            </Button>
            <Button className="project-button project-button--primary" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={16} />
              Add Task
            </Button>
          </div>
        </div>

        <div className="project-detail-hero__main">
          <div className="project-detail-hero__heading">
            <h1>{project.title}</h1>
            <span className={healthToneClass[project.health]}>{labelHealth(project.health)}</span>
          </div>
          <p className="project-detail-hero__description">{project.goal || project.description || 'No project description yet.'}</p>
          <div className="project-detail-hero__stats">
            <span>Owner: <strong>{project.ownerId ? (ownerMap.get(project.ownerId) ?? 'Unassigned') : 'Unassigned'}</strong></span>
            <span>Timeline: <strong>{project.startDate ?? 'TBD'} - {project.dueDate ?? 'TBD'}</strong></span>
            <span>Progress:</span>
            <div className="project-progress-bar project-progress-bar--compact"><span style={{ width: `${project.progress}%` }} /></div>
            <strong>{project.progress}%</strong>
          </div>
        </div>

        <div className="project-tabs" role="tablist" aria-label="Project detail sections">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`project-tabs__item${tab === item.key ? ' is-active' : ''}`}
              onClick={() => setParams({ tab: item.key })}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="project-detail-body">
        {tab === 'overview' ? (
          <div className="project-overview">
            <div className="project-overview__stats">
              <article className="project-stat-card">
                <p>TOTAL TASKS</p>
                <strong>{tasks.length}</strong>
                <ClipboardList size={18} />
              </article>
              <article className="project-stat-card">
                <p>COMPLETED</p>
                <strong>{completedCount}</strong>
                <span className="project-stat-card__accent project-stat-card__accent--green" />
              </article>
              <article className="project-stat-card">
                <p>ACTIVE</p>
                <strong>{activeCount}</strong>
                <span className="project-stat-card__accent project-stat-card__accent--blue" />
              </article>
            </div>

            <div className="project-overview__grid">
              <article className="project-panel">
                <h3>Next Action</h3>
                <p>{project.nextAction || 'Define the next meaningful action for this project.'}</p>
                <button type="button" onClick={() => setProjectDialogOpen(true)}>Update Next Action →</button>
              </article>
              <article className="project-panel">
                <h3>Risks & Blockers</h3>
                <p><ShieldAlert size={16} /> {project.riskSummary || (overdueCount > 0 ? `${overdueCount} task(s) are overdue.` : 'No critical risks recorded yet.')}</p>
                <button type="button" onClick={() => setProjectDialogOpen(true)}>Update Risks →</button>
              </article>
            </div>

            <article className="project-panel project-panel--activity">
              <h3>Recent Activity</h3>
              <div className="project-activity-list">
                {activity.length === 0 ? <p className="project-muted">No activity yet.</p> : activity.map((item) => (
                  <div key={item.id} className="project-activity-item">
                    <span className="project-activity-item__dot" />
                    <div>
                      <p>{item.title}</p>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        ) : null}

        {tab === 'tasks' ? (
          <div className="project-section">
            <div className="project-section__header">
              <h2>Project Tasks</h2>
              <div className="project-section__actions">
                <select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value as typeof taskStatusFilter)}>
                  <option value="all">All Status</option>
                  <option value="todo">Todo</option>
                  <option value="doing">In Progress</option>
                  <option value="done">Done</option>
                </select>
                <select value={taskOwnerFilter} onChange={(event) => setTaskOwnerFilter(event.target.value)}>
                  <option value="all">All Owners</option>
                  {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                </select>
              </div>
            </div>
            <div className="project-task-list">
              {visibleTasks.map((task) => (
                <article key={task.id} className="project-task-row">
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.description || 'No description'}</p>
                    <div className="project-task-row__meta">
                      <span>{task.ownerId ? (ownerMap.get(task.ownerId) ?? 'Unassigned') : 'Unassigned'}</span>
                      <span>•</span>
                      <span>Due {task.dueDate ?? 'TBD'}</span>
                    </div>
                  </div>
                  <span className={statusToneClass[task.status]}>{task.status === 'doing' ? 'IN PROGRESS' : task.status.toUpperCase()}</span>
                </article>
              ))}
              {visibleTasks.length === 0 ? <div className="project-empty-inline">No tasks match the current filters.</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'timeline' ? (
          <div className="project-section">
            <div className="project-section__header">
              <h2>Project Timeline</h2>
              <div className="project-section__actions">
                <div className="project-toggle">
                  <button type="button" className={timelineMode === 'week' ? 'is-active' : ''} onClick={() => setTimelineMode('week')}>Week</button>
                  <button type="button" className={timelineMode === 'month' ? 'is-active' : ''} onClick={() => setTimelineMode('month')}>Month</button>
                </div>
                <Button variant="outline" className="project-button project-button--secondary">Today</Button>
              </div>
            </div>
            <div className="project-timeline">
              {sortTasksByDate(tasks).map((task, index) => (
                <div key={task.id} className="project-timeline__row">
                  <div className="project-timeline__date">{task.startDate ?? task.dueDate ?? `T+${index + 1}`}</div>
                  <div className="project-timeline__track">
                    <div className={`project-timeline__bar project-timeline__bar--${timelineMode}`}>
                      <strong>{task.title}</strong>
                      <span>{task.ownerId ? (ownerMap.get(task.ownerId) ?? 'Unassigned') : 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 ? <div className="project-empty-inline">No scheduled tasks yet.</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'people' ? (
          <div className="project-section">
            <div className="project-section__header">
              <h2>Team Members</h2>
              <Button className="project-button project-button--primary" onClick={() => { setEditingPerson(null); setPersonDialogOpen(true) }}>
                <Plus size={16} />
                Add Person
              </Button>
            </div>
            <div className="project-people-grid">
              {people.map((person) => {
                const linkedCount = tasks.filter((task) => task.ownerId === person.id || task.collaboratorIds?.includes(person.id)).length
                return (
                  <article key={person.id} className="project-person-card" onClick={() => { setEditingPerson(person); setPersonDialogOpen(true) }}>
                    <div className="project-person-card__top">
                      <div>
                        <h3>{person.name}</h3>
                        <p>{person.roleType.charAt(0).toUpperCase() + person.roleType.slice(1)}</p>
                      </div>
                      <span>{linkedCount} tasks</span>
                    </div>
                    <div className="project-person-card__meta"><Mail size={14} />{person.email || 'No email'}</div>
                    <div className="project-person-card__meta"><Phone size={14} />{person.phone || 'No phone'}</div>
                  </article>
                )
              })}
              {people.length === 0 ? <div className="project-empty-inline">No people added yet.</div> : null}
            </div>
          </div>
        ) : null}

        {tab === 'notes' ? (
          <div className="project-section">
            <div className="project-section__header">
              <h2>Project Notes</h2>
              <div className="project-notes-search">
                <Search size={16} />
                <Input value={notesQuery} onChange={(event) => setNotesQuery(event.target.value)} className="project-list-toolbar__input" placeholder="Search Notes" />
              </div>
            </div>
            <div className="project-note-list">
              {visibleNotes.map(({ note }) => (
                <article key={note.id} className="project-note-row">
                  <div>
                    <h3>{note.title}</h3>
                    <p>{note.excerpt || 'No summary available.'}</p>
                    <span>Last modified {new Date(note.updatedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="project-note-row__actions">
                    <Button variant="outline" className="project-button project-button--secondary" onClick={() => navigate(ROUTES.NOTE)}>
                      Open
                    </Button>
                    <Button variant="outline" className="project-button project-button--secondary" onClick={() => void projectNoteLinksRepo.remove(project.id, note.id).then(load)}>
                      Remove Link
                    </Button>
                  </div>
                </article>
              ))}
              {visibleNotes.length === 0 ? <div className="project-empty-inline">No linked notes yet. Add the project tag in Notes to associate them here.</div> : null}
            </div>
          </div>
        ) : null}
      </div>

      <ProjectFormDialog
        open={projectDialogOpen}
        project={project}
        people={people}
        onClose={() => setProjectDialogOpen(false)}
        onSubmit={async (payload) => {
          await projectsRepo.update(project.id, payload)
          setProjectDialogOpen(false)
          await load()
        }}
      />

      <PersonFormDialog
        open={personDialogOpen}
        person={editingPerson}
        onClose={() => setPersonDialogOpen(false)}
        onSubmit={async (payload) => {
          if (editingPerson) await projectPeopleRepo.update(editingPerson.id, payload)
          else await projectPeopleRepo.create({ projectId: project.id, ...payload })
          setPersonDialogOpen(false)
          setEditingPerson(null)
          await load()
        }}
      />

      <ProjectTaskDialog
        open={taskDialogOpen}
        people={people}
        onClose={() => setTaskDialogOpen(false)}
        onSubmit={async (payload) => {
          await tasksRepo.add({
            title: payload.title,
            description: payload.description,
            status: payload.status,
            priority: payload.priority,
            projectId: project.id,
            ownerId: payload.ownerId,
            startDate: payload.startDate,
            dueDate: payload.dueDate,
            tags: [],
            subtasks: [],
            collaboratorIds: [],
            dependencyTaskIds: [],
            blockedByTaskIds: [],
            isBlocked: false,
          })
          setTaskDialogOpen(false)
          await load()
        }}
      />
    </section>
  )
}

export default ProjectDetailPage
