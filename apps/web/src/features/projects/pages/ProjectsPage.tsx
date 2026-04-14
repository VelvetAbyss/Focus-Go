import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
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

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
}

const cardVariant = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

const heroVariant = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
}

const toolbarVariant = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: 0.12 } },
}

let hasAnimatedProjectsList = false
let projectsListCache: { projects: ProjectItem[]; people: ProjectPerson[] } | null = null

const ProjectsPage = () => {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectItem[]>(() => projectsListCache?.projects ?? [])
  const [people, setPeople] = useState<ProjectPerson[]>(() => projectsListCache?.people ?? [])
  const [loading, setLoading] = useState(() => !projectsListCache)
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectItem['status']>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [healthFilter, setHealthFilter] = useState<'all' | ProjectHealth>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null)

  const load = async () => {
    setLoading((prev) => prev && !projectsListCache)
    const [nextProjects, nextPeople] = await Promise.all([projectsRepo.list(), db.projectPeople.toArray()])
    projectsListCache = { projects: nextProjects, people: nextPeople }
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

  const shouldAnimateIn = !hasAnimatedProjectsList

  useEffect(() => {
    hasAnimatedProjectsList = true
  }, [])

  return (
    <section className="project-page">
      {/* Hero */}
      <motion.div
        className="project-page__hero"
        variants={heroVariant}
        initial={shouldAnimateIn ? 'hidden' : false}
        animate="show"
      >
        <div>
          <div className="project-page__heading-row">
            <h1 className="project-page__title">Projects</h1>
            <span className="project-page__labs-pill">LABS</span>
          </div>
          <p className="project-page__subtitle">Dedicated workspace for complex projects with clear goals and timelines</p>
        </div>
        <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
          <Plus size={16} />
          New Project
        </Button>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        className="project-list-toolbar"
        variants={toolbarVariant}
        initial={shouldAnimateIn ? 'hidden' : false}
        animate="show"
      >
        <div className="project-list-toolbar__search">
          <Search size={18} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="project-list-toolbar__input"
            placeholder="Search projects..."
          />
        </div>
        <Button
          variant="outline"
          className={`project-button project-button--secondary${filtersOpen ? ' project-button--secondary-active' : ''}`}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <SlidersHorizontal size={16} />
          Filter
        </Button>
      </motion.div>

      <AnimatePresence>
        {filtersOpen ? (
          <motion.div
            className="project-filter-panel"
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 18 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
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
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loading ? <div className="project-empty-state">Loading projects…</div> : null}

      {!loading && filtered.length === 0 ? (
        <motion.div
          className="project-empty-state"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <h2>No projects yet</h2>
          <p>Create your first project workspace to organize tasks, people, timelines, and notes in one place.</p>
          <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
            <Plus size={16} />
            Create First Project
          </Button>
        </motion.div>
      ) : null}

      <motion.div
        className="project-card-list"
        variants={listStagger}
        initial={shouldAnimateIn ? 'hidden' : false}
        animate="show"
      >
        {filtered.map((project) => (
          <motion.button
            key={project.id}
            type="button"
            className="project-card"
            variants={cardVariant}
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
                <p className="project-card__value">{project.startDate ?? 'TBD'} – {project.dueDate ?? 'TBD'}</p>
              </div>
              <div>
                <p className="project-card__label">Progress</p>
                <div className="project-card__progress-row">
                  <div className="project-progress-bar">
                    <motion.span
                      initial={shouldAnimateIn ? { width: '0%' } : false}
                      animate={{ width: `${project.progress}%` }}
                      transition={shouldAnimateIn ? { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 } : { duration: 0.28, ease: EASE }}
                    />
                  </div>
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
              <motion.span
                className="project-card__arrow"
                initial={false}
                whileHover={{ x: 3 }}
                transition={{ duration: 0.15 }}
              >
                <ArrowRight size={16} />
              </motion.span>
            </div>
          </motion.button>
        ))}
      </motion.div>

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
