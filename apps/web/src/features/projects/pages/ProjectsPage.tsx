import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { db } from '../../../data/db'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import type { ProjectHealth, ProjectItem, ProjectPerson } from '../../../data/models/types'
import { ProjectFormDialog } from '../components/ProjectDialogs'
import '../projects.css'

const healthToneClass: Record<ProjectHealth, string> = {
  'on-track': 'project-health-badge project-health-badge--track',
  'at-risk': 'project-health-badge project-health-badge--risk',
  blocked: 'project-health-badge project-health-badge--blocked',
}

const priorityClass: Record<string, string> = {
  high: 'project-priority project-priority--high',
  medium: 'project-priority project-priority--medium',
  low: 'project-priority project-priority--low',
}

const labelHealth = (health: ProjectHealth) => (health === 'on-track' ? 'On Track' : health === 'at-risk' ? 'At Risk' : 'Blocked')

const ProjectsPage = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectItem['status']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | ProjectHealth>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)

  const load = async () => {
    setLoading(true)
    const [nextProjects, nextPeople] = await Promise.all([projectsRepo.list(), db.projectPeople.toArray()])
    setProjects(nextProjects)
    setPeople(nextPeople)
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const ownerMap = useMemo(() => new Map(people.map((person) => [person.id, person.name] as const)), [people])

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      const haystack = `${project.title} ${project.goal} ${project.description} ${project.nextAction ?? ''} ${project.riskSummary ?? ''}`.toLowerCase()
      if (search && !haystack.includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && project.status !== statusFilter) return false
      if (priorityFilter !== 'all' && project.priority !== priorityFilter) return false
      if (healthFilter !== 'all' && project.health !== healthFilter) return false
      return true
    })
  }, [healthFilter, priorityFilter, projects, search, statusFilter])

  return (
    <section className="project-page">
      <div className="project-page__hero">
        <div>
          <div className="project-page__heading-row">
            <h1 className="project-page__title">Project</h1>
            <span className="project-page__labs-pill">LABS</span>
          </div>
          <p className="project-page__subtitle">Dedicated workspace for complex projects with clear goals and timelines</p>
        </div>
        <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
          <Plus size={16} />
          New Project
        </Button>
      </div>

      <div className="project-list-toolbar">
        <div className="project-list-toolbar__search">
          <Search size={18} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="project-list-toolbar__input"
            placeholder="Search projects..."
          />
        </div>
        <Button variant="outline" className="project-button project-button--secondary" onClick={() => setFiltersOpen((value) => !value)}>
          <SlidersHorizontal size={16} />
          Filter
        </Button>
      </div>

      {filtersOpen ? (
        <div className="project-filter-panel">
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="all">All</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <span>Health</span>
            <select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
              <option value="all">All</option>
              <option value="on-track">On Track</option>
              <option value="at-risk">At Risk</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>
      ) : null}

      {loading ? <div className="project-empty-state">Loading projects…</div> : null}

      {!loading && filtered.length === 0 ? (
        <div className="project-empty-state">
          <h2>No projects yet</h2>
          <p>Create your first project workspace to organize tasks, people, timelines, and notes in one place.</p>
          <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
            <Plus size={16} />
            Create First Project
          </Button>
        </div>
      ) : null}

      <div className="project-card-list">
        {filtered.map((project) => (
          <button
            key={project.id}
            type="button"
            className="project-card"
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <div className="project-card__header">
              <div className="project-card__title-row">
                <h2>{project.title}</h2>
                <span className={healthToneClass[project.health]}>{labelHealth(project.health)}</span>
              </div>
              <div className="project-card__meta-row">
                <span>{project.status === 'planning' ? 'Planning' : project.status === 'active' ? 'Active' : project.status === 'blocked' ? 'Blocked' : project.status === 'done' ? 'Done' : 'Archived'}</span>
                <span className="project-card__dot">•</span>
                <span className={priorityClass[project.priority ?? 'medium']}>{(project.priority ?? 'medium').toUpperCase()}</span>
              </div>
            </div>

            <div className="project-card__grid">
              <div>
                <p className="project-card__label">Owner</p>
                <p className="project-card__value">{project.ownerId ? (ownerMap.get(project.ownerId) ?? 'Unassigned') : 'Unassigned'}</p>
              </div>
              <div>
                <p className="project-card__label">Timeline</p>
                <p className="project-card__value">{project.startDate ?? 'TBD'} - {project.dueDate ?? 'TBD'}</p>
              </div>
              <div>
                <p className="project-card__label">Progress</p>
                <div className="project-card__progress-row">
                  <div className="project-progress-bar"><span style={{ width: `${project.progress}%` }} /></div>
                  <strong>{project.progress}%</strong>
                </div>
              </div>
              <div>
                <p className="project-card__label">Next Action</p>
                <p className="project-card__value">{project.nextAction || project.riskSummary || 'Review current plan'}</p>
              </div>
            </div>

            <div className="project-card__footer">
              <span>{project.goal || project.description || 'Open project workspace'}</span>
              <ArrowRight size={16} />
            </div>
          </button>
        ))}
      </div>

      <ProjectFormDialog
        open={dialogOpen}
        project={editingProject}
        people={people.filter((person) => !editingProject || person.projectId === editingProject.id)}
        onClose={() => setDialogOpen(false)}
        onSubmit={async (payload) => {
          if (editingProject) {
            await projectsRepo.update(editingProject.id, payload)
          } else {
            await projectsRepo.create(payload)
          }
          setDialogOpen(false)
          await load()
        }}
      />
    </section>
  )
}

export default ProjectsPage
