import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Archive, ArrowLeft, ChevronDown, ClipboardList, FileText,
  Mail, Pencil, Phone, Plus, Search,
  Trash2, Users, Zap, CalendarDays, User,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { EditableText } from '@/components/ui/EditableText'
import Dialog from '../../../shared/ui/Dialog'
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { projectPeopleRepo } from '../../../data/repositories/projectPeopleRepo'
import { projectNoteLinksRepo } from '../../../data/repositories/projectNoteLinksRepo'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import type { NoteItem, ProjectHealth, ProjectItem, ProjectPerson, ProjectStatus, TaskItem } from '../../../data/models/types'
import { ROUTES } from '../../../app/routes/routes'
import { PersonFormDialog, ProjectFormDialog } from '../components/ProjectDialogs'
import ProjectGantt from '../components/ProjectGantt'
import { useProjectsI18n } from '../projectsI18n'
import TaskDrawer from '../../tasks/TaskDrawer'
import TasksBoard from '../../tasks/TasksBoard'
import { emitTasksChanged, subscribeTasksChanged } from '../../tasks/taskSync'
import { EASE_OUT } from '../../../shared/motion/tokens'
import { ROLE } from '../../../shared/design/tokens'
import '../projects.css'

type ProjectTab = 'overview' | 'tasks' | 'timeline' | 'people' | 'notes'
const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['planning', 'active', 'blocked', 'done', 'archived']

const STATUS_LABEL_KEYS: Record<ProjectStatus, 'statusPlanning' | 'statusActive' | 'statusBlocked' | 'statusDone' | 'statusArchived'> = {
  planning: 'statusPlanning',
  active: 'statusActive',
  blocked: 'statusBlocked',
  done: 'statusDone',
  archived: 'statusArchived',
}
type TimelineMode = 'week' | 'month' | 'year'

const ROLE_COLORS: Record<string, string> = {
  owner: ROLE.owner,
  collaborator: ROLE.collaborator,
  reviewer: ROLE.reviewer,
  external: ROLE.external,
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ── Progress ring ────────────────────────────────────────────
function ProgressRing({ progress, size = 96, label }: { progress: number; size?: number; label: string }) {
  const strokeWidth = 6
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.max(0, Math.min(100, progress)) / 100)
  return (
    <svg width={size} height={size} className="pd-ring" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} className="pd-ring__track" strokeWidth={strokeWidth} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="pd-ring__fill"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: EASE_OUT, delay: 0.4 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="pd-ring__text">
        {progress}%
      </text>
    </svg>
  )
}

// ── Animation variants ────────────────────────────────────────
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
}
const slideUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
}
const tabContent = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
}

function activityColor(id: string): string {
  if (id.startsWith('task:')) return '#0D7A54'
  if (id.startsWith('person:')) return '#D4882B'
  return '#6B5FF5'
}

// ── Main component ────────────────────────────────────────────
const ProjectDetailPage = () => {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as ProjectTab | null) ?? 'overview'
  const i18n = useProjectsI18n()

  const [project, setProject] = useState<ProjectItem | null>(null)
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [notes, setNotes] = useState<Array<{ note: NoteItem }>>([])
  const [loading, setLoading] = useState(true)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<ProjectPerson | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [drawerTask, setDrawerTask] = useState<TaskItem | null>(null)
  const [allProjects, setAllProjects] = useState<ProjectItem[]>([])
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('month')
  const [notesQuery, setNotesQuery] = useState('')

  const TABS: Array<{ key: ProjectTab; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }> }> = useMemo(() => [
    { key: 'overview', label: i18n.tabs.overview, Icon: Zap },
    { key: 'tasks', label: i18n.tabs.tasks, Icon: ClipboardList },
    { key: 'timeline', label: i18n.tabs.timeline, Icon: CalendarDays },
    { key: 'people', label: i18n.tabs.people, Icon: Users },
    { key: 'notes', label: i18n.tabs.notes, Icon: FileText },
  ], [i18n])

  const HEALTH_CONFIG: Record<ProjectHealth, { label: string; cls: string }> = useMemo(() => ({
    'on-track': { label: i18n.health.onTrack, cls: 'pd-badge pd-badge--green' },
    'at-risk': { label: i18n.health.atRisk, cls: 'pd-badge pd-badge--amber' },
    blocked: { label: i18n.health.blocked, cls: 'pd-badge pd-badge--red' },
  }), [i18n])

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
    setTasks(nextTasks.filter((t) => t.projectId === projectId))
    setNotes(nextNotes)
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  useEffect(() => {
    void projectsRepo.list().then(setAllProjects)
  }, [projectId])

  useEffect(() => {
    return subscribeTasksChanged(() => {
      void load()
      void projectsRepo.list().then(setAllProjects)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const openNewTask = async () => {
    if (!projectId) return
    const created = await tasksRepo.add({
      title: i18n.dialog.taskTitlePlaceholder ?? 'New task',
      status: 'todo',
      priority: null,
      projectId,
      tags: [],
      subtasks: [],
      collaboratorIds: [],
      dependencyTaskIds: [],
      blockedByTaskIds: [],
      isBlocked: false,
    })
    emitTasksChanged('project-detail:create-task')
    setTasks((prev) => [...prev, created])
    setDrawerTask(created)
  }

  const handleTaskUpdated = (updated: TaskItem) => {
    setTasks((prev) => {
      const exists = prev.some((task) => task.id === updated.id)
      if (updated.projectId !== projectId) {
        return prev.filter((task) => task.id !== updated.id)
      }
      if (!exists) return [...prev, updated]
      return prev.map((task) => (task.id === updated.id ? updated : task))
    })
    setDrawerTask((prev) => (prev?.id === updated.id ? updated : prev))
  }

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id))
    setDrawerTask((prev) => (prev?.id === id ? null : prev))
  }

  const ownerMap = useMemo(() => new Map(people.map((p) => [p.id, p.name] as const)), [people])

  const overdueCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length
  }, [tasks])

  const activeCount = useMemo(() => tasks.filter((t) => t.status === 'doing').length, [tasks])
  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'done').length, [tasks])

  const activity = useMemo(() => {
    const items = [
      ...tasks.map((t) => ({
        id: `task:${t.id}`,
        title: t.status === 'done'
          ? i18n.t(i18n.detail.activityTaskCompleted, { title: t.title })
          : i18n.t(i18n.detail.activityTaskUpdated, { title: t.title }),
        createdAt: t.updatedAt,
      })),
      ...people.map((p) => ({
        id: `person:${p.id}`,
        title: i18n.t(i18n.detail.activityTeamMember, { name: p.name }),
        createdAt: p.updatedAt,
      })),
      ...notes.map(({ note }) => ({
        id: `note:${note.id}`,
        title: i18n.t(i18n.detail.activityNoteLinked, { title: note.title }),
        createdAt: note.updatedAt,
      })),
    ]
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  }, [notes, people, tasks, i18n])

  const visibleNotes = useMemo(
    () => notes.filter(({ note }) => note.title.toLowerCase().includes(notesQuery.toLowerCase())),
    [notes, notesQuery],
  )

  if (loading) {
    return (
      <section className="pd-page">
        <div className="pd-loading">
          <motion.div className="pd-loading__pulse" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <p>{i18n.detail.loading}</p>
        </div>
      </section>
    )
  }

  if (!project) {
    return (
      <section className="pd-page">
        <div className="project-empty-state"><h2>{i18n.detail.notFound}</h2></div>
      </section>
    )
  }

  const hCfg = HEALTH_CONFIG[project.health]

  return (
    <section className="pd-page">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.header
        className="pd-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {/* Top nav */}
        <div className="pd-hero__topbar">
          <Link to={ROUTES.PROJECTS} className="pd-back">
            <ArrowLeft size={15} strokeWidth={2.2} />
            <span>{i18n.detail.back}</span>
          </Link>
          <div className="pd-hero__actions">
            <button type="button" className="pd-icon-btn" title={i18n.detail.editTitle} onClick={() => setProjectDialogOpen(true)}>
              <Pencil size={15} strokeWidth={2} />
              <span>{i18n.detail.edit}</span>
            </button>
            <button
              type="button"
              className="pd-icon-btn"
              title={i18n.detail.archiveTitle}
              onClick={() => void projectsRepo.archive(project.id).then(load)}
            >
              <Archive size={15} strokeWidth={2} />
              <span>{i18n.detail.archive}</span>
            </button>
            <button
              type="button"
              className="pd-icon-btn pd-icon-btn--danger"
              title={i18n.detail.deleteTitle}
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 size={15} strokeWidth={2} />
              <span>{i18n.detail.delete}</span>
            </button>
            <button type="button" className="pd-btn pd-btn--primary" onClick={() => void openNewTask()}>
              <Plus size={15} strokeWidth={2.2} />
              {i18n.detail.addTask}
            </button>
          </div>
        </div>

        {/* Main hero content */}
        <motion.div
          className="pd-hero__content"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <div className="pd-hero__info">
            <motion.div variants={slideUp} className="pd-hero__title-row">
              <h1 className="pd-hero__title">{project.title}</h1>
              <span className={hCfg.cls}>{hCfg.label}</span>
              {project.priority ? (
                <span className={`pd-priority pd-priority--${project.priority}`}>
                  {project.priority.toUpperCase()}
                </span>
              ) : null}
            </motion.div>

            <motion.p variants={slideUp} className="pd-hero__desc">
              {project.goal || project.description || i18n.detail.noDescription}
            </motion.p>

            <motion.div variants={slideUp} className="pd-hero__meta">
              {/* Owner picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="pd-meta-chip pd-meta-chip--btn">
                    <User size={12} />
                    {project.ownerId ? (ownerMap.get(project.ownerId) ?? i18n.detail.unassigned) : i18n.detail.unassigned}
                    <ChevronDown size={10} className="pd-meta-chip__chevron" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1.5" align="start">
                  <button
                    type="button"
                    className={`pd-meta-picker-option${!project.ownerId ? ' is-active' : ''}`}
                    onClick={() => void projectsRepo.update(project.id, { ownerId: undefined }).then(load)}
                  >
                    {i18n.detail.unassigned}
                  </button>
                  {people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`pd-meta-picker-option${project.ownerId === person.id ? ' is-active' : ''}`}
                      onClick={() => void projectsRepo.update(project.id, { ownerId: person.id }).then(load)}
                    >
                      {person.name}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Date range — click opens edit dialog */}
              <button
                type="button"
                className="pd-meta-chip pd-meta-chip--btn"
                onClick={() => setProjectDialogOpen(true)}
              >
                <CalendarDays size={12} />
                {(project.startDate || project.dueDate)
                  ? `${project.startDate ?? '—'} → ${project.dueDate ?? '—'}`
                  : i18n.detail.noDescription === '暂无项目描述。' ? '设置日期' : 'Set dates'}
                <ChevronDown size={10} className="pd-meta-chip__chevron" />
              </button>

              {/* Status picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="pd-meta-chip pd-meta-chip--status pd-meta-chip--btn">
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    <ChevronDown size={10} className="pd-meta-chip__chevron" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="start">
                  {PROJECT_STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`pd-meta-picker-option pd-meta-picker-option--status-${s}${project.status === s ? ' is-active' : ''}`}
                      onClick={() => void projectsRepo.update(project.id, { status: s }).then(load)}
                    >
                      {i18n.dialog[STATUS_LABEL_KEYS[s]]}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </motion.div>
          </div>

          {/* Progress ring + quick stats */}
          <motion.div variants={slideUp} className="pd-hero__ring-section">
            <ProgressRing
              progress={project.progress}
              size={100}
              label={i18n.t(i18n.detail.progressComplete, { progress: project.progress })}
            />
            <div className="pd-hero__quickstats">
              <div className="pd-qstat">
                <strong>{tasks.length}</strong>
                <span>{i18n.detail.statTotal}</span>
              </div>
              <div className="pd-qstat pd-qstat--green">
                <strong>{completedCount}</strong>
                <span>{i18n.detail.statDone}</span>
              </div>
              <div className="pd-qstat pd-qstat--blue">
                <strong>{activeCount}</strong>
                <span>{i18n.detail.statActive}</span>
              </div>
              {overdueCount > 0 ? (
                <div className="pd-qstat pd-qstat--red">
                  <strong>{overdueCount}</strong>
                  <span>{i18n.detail.statOverdue}</span>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="pd-tabs" role="tablist" aria-label={i18n.detail.projectSections}>
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`pd-tab${tab === key ? ' pd-tab--active' : ''}`}
              onClick={() => setParams({ tab: key })}
            >
              <Icon size={14} strokeWidth={2} />
              {label}
              {tab === key ? (
                <motion.span
                  layoutId="pd-tab-indicator"
                  className="pd-tab__indicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              ) : null}
            </button>
          ))}
        </div>
      </motion.header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="pd-body">
        <AnimatePresence mode="wait" initial={false}>
          {/* ── OVERVIEW ──────────────────────────────────────── */}
          {tab === 'overview' ? (
            <motion.div key="overview" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <motion.div className="pd-inline-stats" variants={slideUp} initial="hidden" animate="show">
                <span>{tasks.length} {i18n.detail.statTotalTasks}</span>
                <span>{completedCount} {i18n.detail.statCompleted}</span>
                <span>{activeCount} {i18n.detail.statInProgress}</span>
                {overdueCount > 0 ? (
                  <span className="pd-inline-stats__danger">{overdueCount} {i18n.detail.statOverdueLabel}</span>
                ) : null}
              </motion.div>

              <motion.article
                variants={slideUp}
                initial="hidden"
                animate="show"
                className="pd-focus-card"
              >
                <div className="pd-focus-card__main">
                  <p className="pd-focus-card__eyebrow">{i18n.detail.nextAction}</p>
                  <h2>
                    <EditableText
                      value={project.nextAction ?? ''}
                      placeholder={i18n.detail.nextActionDefault}
                      ariaLabel={i18n.detail.nextAction}
                      onCommit={async (next) => {
                        await projectsRepo.update(project.id, { nextAction: next })
                        const refreshed = await projectsRepo.getById(project.id)
                        if (refreshed) setProject(refreshed)
                      }}
                    />
                  </h2>
                  <p>
                    <EditableText
                      value={project.riskSummary ?? ''}
                      placeholder={overdueCount > 0
                        ? i18n.t(i18n.detail.overdueWarning, { count: overdueCount })
                        : i18n.detail.noRisks}
                      multiline
                      ariaLabel={i18n.detail.noRisks}
                      onCommit={async (next) => {
                        await projectsRepo.update(project.id, { riskSummary: next })
                        const refreshed = await projectsRepo.getById(project.id)
                        if (refreshed) setProject(refreshed)
                      }}
                    />
                  </p>
                </div>
                <ProgressRing progress={project.progress} size={104} label="Project progress" />
              </motion.article>

              {/* Activity feed */}
              <motion.article
                className="pd-activity"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <h3 className="pd-activity__heading">{i18n.detail.recentActivity}</h3>
                {activity.length === 0 ? (
                  <p className="pd-muted">{i18n.detail.noActivity}</p>
                ) : (
                  <div className="pd-activity__list">
                    {activity.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        className="pd-activity__item"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + idx * 0.04, duration: 0.3 }}
                      >
                        <span className="pd-activity__bar" style={{ background: activityColor(item.id) }} aria-hidden />
                        <div className="pd-activity__text">
                          <p>{item.title}</p>
                          <time>{new Date(item.createdAt).toLocaleString()}</time>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.article>
            </motion.div>
          ) : null}

          {/* ── TASKS ─────────────────────────────────────────── */}
          {tab === 'tasks' ? (
            <motion.div key="tasks" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <TasksBoard asCard={false} topView="board" scope={{ kind: 'project', projectId: project.id }} />
            </motion.div>
          ) : null}

          {/* ── TIMELINE ──────────────────────────────────────── */}
          {tab === 'timeline' ? (
            <motion.div key="timeline" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">{i18n.detail.timeline}</h2>
                <div className="pd-toggle">
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'week' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('week')}
                  >{i18n.detail.week}</button>
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'month' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('month')}
                  >{i18n.detail.month}</button>
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'year' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('year')}
                  >{i18n.detail.year}</button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <div className="pd-empty-inline">{i18n.detail.noTasksScheduled}</div>
              ) : (
                <ProjectGantt
                  tasks={tasks}
                  projectColor={project.color}
                  viewMode={timelineMode}
                  onTaskClick={(task) => setDrawerTask(task)}
                />
              )}
            </motion.div>
          ) : null}

          {/* ── PEOPLE ────────────────────────────────────────── */}
          {tab === 'people' ? (
            <motion.div key="people" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">{i18n.detail.team} <span className="pd-count">{people.length}</span></h2>
                <button
                  type="button"
                  className="pd-btn pd-btn--primary"
                  onClick={() => { setEditingPerson(null); setPersonDialogOpen(true) }}
                >
                  <Plus size={14} /> {i18n.detail.addPerson}
                </button>
              </div>

              <motion.div className="pd-people-grid" variants={stagger} initial="hidden" animate="show">
                {people.map((person) => {
                  const linkedCount = tasks.filter(
                    (t) => t.ownerId === person.id || t.collaboratorIds?.includes(person.id),
                  ).length
                  const roleColor = ROLE_COLORS[person.roleType] ?? '#3A3733'
                  return (
                    <motion.article
                      key={person.id}
                      variants={slideUp}
                      className="pd-person"
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      onClick={() => { setEditingPerson(person); setPersonDialogOpen(true) }}
                    >
                      <div className="pd-person__avatar" style={{ background: roleColor + '1A', color: roleColor }}>
                        {getInitials(person.name)}
                      </div>
                      <div className="pd-person__info">
                        <h3>{person.name}</h3>
                        <span className="pd-person__role" style={{ color: roleColor }}>
                          {person.roleType.charAt(0).toUpperCase() + person.roleType.slice(1)}
                        </span>
                      </div>
                      <div className="pd-person__tasks">
                        <strong>{linkedCount}</strong>
                        <span>{i18n.detail.tasks}</span>
                      </div>
                      <div className="pd-person__contact">
                        {person.email ? (
                          <span><Mail size={12} />{person.email}</span>
                        ) : null}
                        {person.phone ? (
                          <span><Phone size={12} />{person.phone}</span>
                        ) : null}
                        {!person.email && !person.phone ? (
                          <span className="pd-muted">{i18n.detail.noContactInfo}</span>
                        ) : null}
                      </div>
                    </motion.article>
                  )
                })}
                {people.length === 0 ? (
                  <div className="pd-empty-inline">{i18n.detail.noTeamMembers}</div>
                ) : null}
              </motion.div>
            </motion.div>
          ) : null}

          {/* ── NOTES ─────────────────────────────────────────── */}
          {tab === 'notes' ? (
            <motion.div key="notes" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">{i18n.detail.notes} <span className="pd-count">{visibleNotes.length}</span></h2>
                <div className="pd-search">
                  <Search size={14} strokeWidth={2} />
                  <Input
                    value={notesQuery}
                    onChange={(e) => setNotesQuery(e.target.value)}
                    className="pd-search__input"
                    placeholder={i18n.detail.searchNotes}
                  />
                </div>
              </div>

              <motion.div className="pd-note-list" variants={stagger} initial="hidden" animate="show">
                {visibleNotes.map(({ note }) => (
                  <motion.article key={note.id} variants={slideUp} className="pd-note" whileHover={{ y: -1, transition: { duration: 0.15 } }}>
                    <div className="pd-note__body">
                      <h3>{note.title}</h3>
                      {note.excerpt ? <p>{note.excerpt}</p> : null}
                      <time>{new Date(note.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                    </div>
                    <div className="pd-note__actions">
                      <button type="button" className="pd-btn pd-btn--ghost" onClick={() => navigate(ROUTES.NOTE)}>
                        {i18n.detail.open}
                      </button>
                      <button
                        type="button"
                        className="pd-btn pd-btn--danger-ghost"
                        onClick={() => void projectNoteLinksRepo.remove(project.id, note.id).then(load)}
                      >
                        {i18n.detail.unlink}
                      </button>
                    </div>
                  </motion.article>
                ))}
                {visibleNotes.length === 0 ? (
                  <div className="pd-empty-inline">
                    {i18n.t(i18n.detail.noLinkedNotes, { id: project.id })}
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────── */}
      <ProjectFormDialog
        open={projectDialogOpen}
        project={project}
        people={people}
        onClose={async () => {
          setProjectDialogOpen(false)
          await load()
        }}
        onAutoSave={async (payload) => {
          await projectsRepo.update(project.id, payload)
        }}
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

      <TaskDrawer
        open={Boolean(drawerTask)}
        task={drawerTask}
        projects={allProjects}
        onClose={() => setDrawerTask(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
      <Dialog open={deleteDialogOpen} title={i18n.detail.deleteTitle} onClose={() => setDeleteDialogOpen(false)}>
        <div className="dialog__body">
          <p>{i18n.t(i18n.detail.deleteConfirm, { title: project.title })}</p>
          <div className="dialog__actions">
            <button type="button" className="pd-btn pd-btn--ghost" onClick={() => setDeleteDialogOpen(false)}>
              {i18n.detail.cancel}
            </button>
            <button
              type="button"
              className="pd-btn pd-btn--danger-ghost"
              onClick={async () => {
                await projectsRepo.remove(project.id)
                setDeleteDialogOpen(false)
                navigate(ROUTES.PROJECTS)
              }}
            >
              {i18n.detail.delete}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  )
}

export default ProjectDetailPage
