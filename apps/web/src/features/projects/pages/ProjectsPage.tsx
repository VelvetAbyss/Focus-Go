import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ArrowRight, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db } from '../../../data/db'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import type { ProjectHealth, ProjectItem, ProjectPerson } from '../../../data/models/types'
import { ProjectFormDialog } from '../components/ProjectDialogs'
import { useProjectsI18n } from '../projectsI18n'
import '../projects.css'

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const listStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
}

const cardVariant = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
}

const heroVariant = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.46, ease: EASE } },
}

let hasAnimatedProjectsList = false
let projectsListCache: { projects: ProjectItem[]; people: ProjectPerson[] } | null = null

type StatusFilter = 'all' | ProjectItem['status']

const ProjectsPage = () => {
  const navigate = useNavigate()
  const i18n = useProjectsI18n()
  const [projects, setProjects] = useState<ProjectItem[]>(() => projectsListCache?.projects ?? [])
  const [people, setPeople] = useState<ProjectPerson[]>(() => projectsListCache?.people ?? [])
  const [loading, setLoading] = useState(() => !projectsListCache)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
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

  useEffect(() => { void load() }, [])

  const ownerMap = useMemo(() => new Map(people.map((p) => [p.id, p.name] as const)), [people])

  const filtered = useMemo(() => projects.filter((p) => {
    const haystack = `${p.title} ${p.goal} ${p.description} ${p.nextAction ?? ''} ${p.riskSummary ?? ''}`.toLowerCase()
    if (search && !haystack.includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (priorityFilter !== 'all' && p.priority !== priorityFilter) return false
    if (healthFilter !== 'all' && p.health !== healthFilter) return false
    return true
  }), [healthFilter, priorityFilter, projects, search, statusFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects.length }
    for (const p of projects) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [projects])

  const shouldAnimateIn = !hasAnimatedProjectsList

  useEffect(() => { hasAnimatedProjectsList = true }, [])

  const labelHealth = (health: ProjectHealth) =>
    health === 'on-track' ? i18n.health.onTrack
    : health === 'at-risk' ? i18n.health.atRisk
    : i18n.health.blocked

  const labelStatus = (status: ProjectItem['status']) => i18n.status[status] ?? status

  const STATUS_CHIPS: Array<{ key: StatusFilter; label: string; cls: string }> = [
    { key: 'all',      label: i18n.filter.all,      cls: '' },
    { key: 'planning', label: i18n.filter.planning,  cls: 'pj-chip--planning' },
    { key: 'active',   label: i18n.filter.active,    cls: 'pj-chip--active-status' },
    { key: 'blocked',  label: i18n.filter.blocked,   cls: 'pj-chip--blocked' },
    { key: 'done',     label: i18n.filter.done,      cls: 'pj-chip--done' },
    { key: 'archived', label: i18n.filter.archived,  cls: 'pj-chip--archived' },
  ]

  return (
    <section className="pj-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div
        className="pj-header"
        variants={heroVariant}
        initial={shouldAnimateIn ? 'hidden' : false}
        animate="show"
      >
        <div>
          <div className="pj-header__title-row">
            <h1 className="pj-title">{i18n.page.title}</h1>
            <span className="pj-labs-badge">LABS</span>
          </div>
          <p className="pj-subtitle">{i18n.page.subtitle}</p>
        </div>
        <button
          type="button"
          className="pj-new-btn"
          onClick={() => { setEditingProject(null); setDialogOpen(true) }}
        >
          <Plus size={15} strokeWidth={2.2} />
          {i18n.page.newProject}
        </button>
      </motion.div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <motion.div
        className="pj-controls"
        initial={shouldAnimateIn ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: EASE, delay: 0.12 }}
      >
        {/* Top: search + secondary filters */}
        <div className="pj-controls-top">
          <div className="pj-search-wrap">
            <Search size={15} strokeWidth={2} />
            <input
              className="pj-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={i18n.page.searchPlaceholder}
            />
          </div>
          <div className="pj-secondary-filters">
            <select
              className="pj-select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            >
              <option value="all">{i18n.filter.all}</option>
              <option value="high">{i18n.filter.high}</option>
              <option value="medium">{i18n.filter.medium}</option>
              <option value="low">{i18n.filter.low}</option>
            </select>
            <select
              className="pj-select"
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as typeof healthFilter)}
            >
              <option value="all">{i18n.filter.all}</option>
              <option value="on-track">{i18n.filter.onTrack}</option>
              <option value="at-risk">{i18n.filter.atRisk}</option>
              <option value="blocked">{i18n.filter.blocked}</option>
            </select>
          </div>
        </div>

        {/* Status filter chips */}
        <div className="pj-chips">
          {STATUS_CHIPS.map((chip) => {
            const n = counts[chip.key as string] ?? 0
            if (chip.key !== 'all' && n === 0) return null
            return (
              <button
                key={chip.key}
                type="button"
                className={`pj-chip ${chip.cls}${statusFilter === chip.key ? ' pj-chip--active' : ''}`}
                onClick={() => setStatusFilter(chip.key)}
              >
                {chip.label}
                <span className="pj-chip__count">{n}</span>
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── Loading ─────────────────────────────────────────────── */}
      {loading ? (
        <div className="pj-empty">
          <p style={{ color: 'rgba(58,55,51,0.4)', fontSize: 13 }}>{i18n.page.loading}</p>
        </div>
      ) : null}

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!loading && filtered.length === 0 ? (
        <AnimatePresence>
          <motion.div
            className="pj-empty"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <h2>{i18n.page.emptyTitle}</h2>
            <p>{i18n.page.emptyDesc}</p>
            <button
              type="button"
              className="pj-new-btn"
              style={{ marginTop: 4 }}
              onClick={() => { setEditingProject(null); setDialogOpen(true) }}
            >
              <Plus size={15} />
              {i18n.page.createFirst}
            </button>
          </motion.div>
        </AnimatePresence>
      ) : null}

      {/* ── Card list ───────────────────────────────────────────── */}
      <motion.div
        className="pj-card-list"
        variants={listStagger}
        initial={shouldAnimateIn ? 'hidden' : false}
        animate="show"
      >
        {filtered.map((project, index) => {
          const ownerName = project.ownerId ? (ownerMap.get(project.ownerId) ?? i18n.page.cardUnassigned) : i18n.page.cardUnassigned
          const timeline = `${project.startDate ?? i18n.page.cardTBD} – ${project.dueDate ?? i18n.page.cardTBD}`

          return (
            <motion.div
              key={project.id}
              className="pj-card"
              style={{ '--pj-i': index } as CSSProperties}
              variants={cardVariant}
              onClick={() => navigate(`/projects/${project.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/projects/${project.id}`) } }}
            >
              {/* badges + progress % */}
              <div className="pj-card__toprow">
                <div className="pj-card__badges">
                  <span className={`pj-badge pj-badge--${project.health === 'on-track' ? 'track' : project.health === 'at-risk' ? 'risk' : 'blocked'}`}>
                    {labelHealth(project.health)}
                  </span>
                  <span className={`pj-badge-status pj-badge-status--${project.status}`}>
                    {labelStatus(project.status)}
                  </span>
                  {project.priority ? (
                    <span className={`pj-badge-priority pj-badge-priority--${project.priority}`}>
                      {project.priority}
                    </span>
                  ) : null}
                </div>
                <span className="pj-card__pct">{project.progress}%</span>
              </div>

              {/* title */}
              <h2 className="pj-card__title">{project.title}</h2>

              {/* goal / description */}
              {(project.goal || project.description) ? (
                <p className="pj-card__goal">{project.goal || project.description}</p>
              ) : null}

              {/* progress bar */}
              <div className="pj-card__progress">
                <div className="pj-progress">
                  <motion.span
                    className="pj-progress__fill"
                    initial={shouldAnimateIn ? { width: '0%' } : false}
                    animate={{ width: `${project.progress}%` }}
                    transition={shouldAnimateIn
                      ? { duration: 0.9, ease: EASE, delay: 0.3 + index * 0.06 }
                      : { duration: 0.3, ease: EASE }}
                  />
                </div>
              </div>

              {/* meta grid */}
              <div className="pj-card__meta">
                <div>
                  <span className="pj-meta-label">{i18n.page.cardOwner}</span>
                  <span className="pj-meta-val">{ownerName}</span>
                </div>
                <div>
                  <span className="pj-meta-label">{i18n.page.cardTimeline}</span>
                  <span className="pj-meta-val">{timeline}</span>
                </div>
                <div>
                  <span className="pj-meta-label">{i18n.page.cardNextAction}</span>
                  <span className="pj-meta-val">{project.nextAction || i18n.page.cardNextActionDefault}</span>
                </div>
              </div>

              {/* hover-reveal CTA */}
              <div className="pj-card__footer">
                <span>{i18n.page.cardOpenWorkspace}</span>
                <ArrowRight size={14} className="pj-card__arrow" />
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* ── Dialogs ─────────────────────────────────────────────── */}
      <ProjectFormDialog
        open={dialogOpen}
        project={editingProject}
        people={people.filter((p) => !editingProject || p.projectId === editingProject.id)}
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
