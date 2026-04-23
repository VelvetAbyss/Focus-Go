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
import { useProjectsI18n } from '../projectsI18n'
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
  const i18n = useProjectsI18n()
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

  const labelHealth = (health: ProjectHealth) =>
    health === 'on-track' ? i18n.health.onTrack : health === 'at-risk' ? i18n.health.atRisk : i18n.health.blocked

  const labelStatus = (status: ProjectItem['status']) =>
    i18n.status[status] ?? status

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
            <h1 className="project-page__title">{i18n.page.title}</h1>
            <span className="project-page__labs-pill">LABS</span>
          </div>
          <p className="project-page__subtitle">{i18n.page.subtitle}</p>
        </div>
        <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
          <Plus size={16} />
          {i18n.page.newProject}
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
            placeholder={i18n.page.searchPlaceholder}
          />
        </div>
        <Button
          variant="outline"
          className={`project-button project-button--secondary${filtersOpen ? ' project-button--secondary-active' : ''}`}
          onClick={() => setFiltersOpen((value) => !value)}
        >
          <SlidersHorizontal size={16} />
          {i18n.page.filter}
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
              <span>{i18n.filter.statusLabel}</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">{i18n.filter.all}</option>
                <option value="planning">{i18n.filter.planning}</option>
                <option value="active">{i18n.filter.active}</option>
                <option value="blocked">{i18n.filter.blocked}</option>
                <option value="done">{i18n.filter.done}</option>
                <option value="archived">{i18n.filter.archived}</option>
              </select>
            </label>
            <label>
              <span>{i18n.filter.priorityLabel}</span>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as typeof priorityFilter)}>
                <option value="all">{i18n.filter.all}</option>
                <option value="high">{i18n.filter.high}</option>
                <option value="medium">{i18n.filter.medium}</option>
                <option value="low">{i18n.filter.low}</option>
              </select>
            </label>
            <label>
              <span>{i18n.filter.healthLabel}</span>
              <select value={healthFilter} onChange={(event) => setHealthFilter(event.target.value as typeof healthFilter)}>
                <option value="all">{i18n.filter.all}</option>
                <option value="on-track">{i18n.filter.onTrack}</option>
                <option value="at-risk">{i18n.filter.atRisk}</option>
                <option value="blocked">{i18n.filter.blocked}</option>
              </select>
            </label>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loading ? <div className="project-empty-state">{i18n.page.loading}</div> : null}

      {!loading && filtered.length === 0 ? (
        <motion.div
          className="project-empty-state"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <h2>{i18n.page.emptyTitle}</h2>
          <p>{i18n.page.emptyDesc}</p>
          <Button className="project-button project-button--primary" onClick={() => { setEditingProject(null); setDialogOpen(true) }}>
            <Plus size={16} />
            {i18n.page.createFirst}
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
                <span>{labelStatus(project.status)}</span>
                <span className="project-card__dot">•</span>
                <span className={priorityClass[project.priority ?? 'medium']}>{(project.priority ?? 'medium').toUpperCase()}</span>
              </div>
            </div>

            <div className="project-card__grid">
              <div>
                <p className="project-card__label">{i18n.page.cardOwner}</p>
                <p className="project-card__value">{project.ownerId ? (ownerMap.get(project.ownerId) ?? i18n.page.cardUnassigned) : i18n.page.cardUnassigned}</p>
              </div>
              <div>
                <p className="project-card__label">{i18n.page.cardTimeline}</p>
                <p className="project-card__value">{project.startDate ?? i18n.page.cardTBD} – {project.dueDate ?? i18n.page.cardTBD}</p>
              </div>
              <div>
                <p className="project-card__label">{i18n.page.cardProgress}</p>
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
                <p className="project-card__label">{i18n.page.cardNextAction}</p>
                <p className="project-card__value">{project.nextAction || project.riskSummary || i18n.page.cardNextActionDefault}</p>
              </div>
            </div>

            <div className="project-card__footer">
              <span>{project.goal || project.description || i18n.page.cardOpenWorkspace}</span>
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
        onClose={async () => {
          setDialogOpen(false)
          if (editingProject) await load()
        }}
        onAutoSave={editingProject ? async (payload) => {
          await projectsRepo.update(editingProject.id, payload)
        } : undefined}
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
