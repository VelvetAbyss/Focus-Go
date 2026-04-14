import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  ArrowLeft, CheckCircle2, ClipboardList, FileText,
  Mail, Pencil, Phone, Plus, Search, ShieldAlert,
  Trash2, Users, Zap, User, CalendarDays,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
type TimelineMode = 'week' | 'month' | 'year'

const TABS: Array<{ key: ProjectTab; label: string; Icon: React.FC<{ size?: number; strokeWidth?: number }> }> = [
  { key: 'overview', label: 'Overview', Icon: Zap },
  { key: 'tasks', label: 'Tasks', Icon: ClipboardList },
  { key: 'timeline', label: 'Timeline', Icon: CalendarDays },
  { key: 'people', label: 'People', Icon: Users },
  { key: 'notes', label: 'Notes', Icon: FileText },
]

const HEALTH_CONFIG: Record<ProjectHealth, { label: string; cls: string }> = {
  'on-track': { label: 'On Track', cls: 'pd-badge pd-badge--green' },
  'at-risk': { label: 'At Risk', cls: 'pd-badge pd-badge--amber' },
  blocked: { label: 'Blocked', cls: 'pd-badge pd-badge--red' },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  todo: { label: 'Todo', cls: 'pd-task-chip pd-task-chip--todo' },
  doing: { label: 'In Progress', cls: 'pd-task-chip pd-task-chip--doing' },
  done: { label: 'Done', cls: 'pd-task-chip pd-task-chip--done' },
}

const ROLE_COLORS: Record<string, string> = {
  owner: '#D4882B',
  collaborator: '#1E5BFF',
  reviewer: '#0D7A54',
  external: '#6B5FF5',
}

const sortByDate = (tasks: TaskItem[]) =>
  [...tasks].sort((a, b) =>
    (a.startDate ?? a.dueDate ?? '9999').localeCompare(b.startDate ?? b.dueDate ?? '9999'),
  )

const DAY_MS = 86400000

const toDateString = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (dateString: string, days: number) => {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  return toDateString(date)
}

const formatTimelineTick = (dateString: string, mode: TimelineMode) => {
  if (mode === 'year') return dateString.slice(0, 7)
  return dateString.slice(5).replace('-', '/')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function useCountUp(target: number, delay = 0): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let raf: number
    const startTime = performance.now() + delay
    const duration = 900
    const tick = (now: number) => {
      if (now < startTime) { raf = requestAnimationFrame(tick); return }
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, delay])
  return count
}

// ── Progress ring ────────────────────────────────────────────
function ProgressRing({ progress, size = 96 }: { progress: number; size?: number }) {
  const strokeWidth = 6
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - Math.max(0, Math.min(100, progress)) / 100)
  return (
    <svg width={size} height={size} className="pd-ring" aria-label={`${progress}% complete`}>
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
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" className="pd-ring__text">
        {progress}%
      </text>
    </svg>
  )
}

// ── Animation variants ────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
}
const slideUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
}
const tabContent = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18 } },
}

// ── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, delay, color }: { label: string; value: number; delay?: number; color?: string }) {
  const count = useCountUp(value, delay ?? 0)
  return (
    <motion.article variants={slideUp} className="pd-stat">
      <p className="pd-stat__label">{label}</p>
      <strong className="pd-stat__value" style={color ? { color } : undefined}>
        {count}
      </strong>
    </motion.article>
  )
}

// ── Activity icon helper ─────────────────────────────────────
function activityIcon(id: string) {
  if (id.startsWith('task:')) return <CheckCircle2 size={13} />
  if (id.startsWith('person:')) return <User size={13} />
  return <FileText size={13} />
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

  const [project, setProject] = useState<ProjectItem | null>(null)
  const [people, setPeople] = useState<ProjectPerson[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [notes, setNotes] = useState<Array<{ note: NoteItem }>>([])
  const [loading, setLoading] = useState(true)

  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [personDialogOpen, setPersonDialogOpen] = useState(false)
  const [editingPerson, setEditingPerson] = useState<ProjectPerson | null>(null)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null)
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all')
  const [taskOwnerFilter, setTaskOwnerFilter] = useState<string>('all')
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('month')
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
    setTasks(nextTasks.filter((t) => t.projectId === projectId))
    setNotes(nextNotes)
    setLoading(false)
  }

  useEffect(() => { void load() }, [projectId])

  const ownerMap = useMemo(() => new Map(people.map((p) => [p.id, p.name] as const)), [people])

  const visibleTasks = useMemo(() =>
    sortByDate(tasks).filter((t) => {
      if (taskStatusFilter !== 'all' && t.status !== taskStatusFilter) return false
      if (taskOwnerFilter !== 'all' && (t.ownerId ?? '') !== taskOwnerFilter) return false
      return true
    }), [taskOwnerFilter, taskStatusFilter, tasks])

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
        title: t.status === 'done' ? `${t.title} completed` : `Task updated: ${t.title}`,
        createdAt: t.updatedAt,
      })),
      ...people.map((p) => ({
        id: `person:${p.id}`,
        title: `Team member: ${p.name}`,
        createdAt: p.updatedAt,
      })),
      ...notes.map(({ note }) => ({
        id: `note:${note.id}`,
        title: `Note linked: ${note.title}`,
        createdAt: note.updatedAt,
      })),
    ]
    return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  }, [notes, people, tasks])

  const visibleNotes = useMemo(
    () => notes.filter(({ note }) => note.title.toLowerCase().includes(notesQuery.toLowerCase())),
    [notes, notesQuery],
  )

  // Timeline range calculation
  const timelineBaseRange = useMemo(() => {
    const sorted = sortByDate(tasks)
    const starts = sorted.map((t) => t.startDate ?? t.dueDate).filter(Boolean) as string[]
    const ends = sorted.map((t) => t.dueDate ?? t.startDate).filter(Boolean) as string[]
    if (!starts.length) return null
    return { min: starts[0], max: ends[ends.length - 1] ?? starts[starts.length - 1] }
  }, [tasks])

  const timelineRange = useMemo(() => {
    if (!timelineBaseRange) return null
    const spanDays = timelineMode === 'week' ? 6 : timelineMode === 'month' ? 29 : 364
    return {
      min: timelineBaseRange.min,
      max: addDays(timelineBaseRange.min, spanDays),
    }
  }, [timelineBaseRange, timelineMode])

  const timelineTicks = useMemo(() => {
    if (!timelineRange) return []
    const totalDays = Math.max(1, Math.round((new Date(timelineRange.max).getTime() - new Date(timelineRange.min).getTime()) / DAY_MS))
    const stepDays = timelineMode === 'week' ? 1 : timelineMode === 'month' ? 5 : 30
    const ticks: Array<{ key: string; left: string; label: string }> = []
    for (let offset = 0; offset <= totalDays; offset += stepDays) {
      const value = addDays(timelineRange.min, offset)
      ticks.push({
        key: value,
        left: `${((offset / totalDays) * 100).toFixed(2)}%`,
        label: formatTimelineTick(value, timelineMode),
      })
    }
    if (ticks[ticks.length - 1]?.key !== timelineRange.max) {
      ticks.push({
        key: timelineRange.max,
        left: '100%',
        label: formatTimelineTick(timelineRange.max, timelineMode),
      })
    }
    return ticks
  }, [timelineMode, timelineRange])

  function taskBarProps(task: TaskItem): { left: string; width: string; hidden: boolean } {
    if (!timelineRange) return { left: '0%', width: '60%', hidden: false }
    const rangeStart = new Date(timelineRange.min).getTime()
    const rangeEnd = new Date(timelineRange.max).getTime()
    const total = rangeEnd - rangeStart || 1
    const tStart = new Date(task.startDate ?? task.dueDate ?? timelineRange.min).getTime()
    const tEnd = new Date(task.dueDate ?? task.startDate ?? timelineRange.max).getTime()
    const visibleStart = Math.max(tStart, rangeStart)
    const visibleEnd = Math.min(Math.max(tEnd, tStart + DAY_MS), rangeEnd)
    if (visibleEnd <= rangeStart || visibleStart >= rangeEnd) {
      return { left: '0%', width: '0%', hidden: true }
    }
    const left = Math.max(0, (visibleStart - rangeStart) / total) * 100
    const width = Math.max(timelineMode === 'year' ? 0.9 : timelineMode === 'month' ? 2 : 4, ((visibleEnd - visibleStart) / total) * 100)
    return { left: `${left.toFixed(2)}%`, width: `${width.toFixed(2)}%`, hidden: false }
  }

  if (loading) {
    return (
      <section className="pd-page">
        <div className="pd-loading">
          <motion.div className="pd-loading__pulse" animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <p>Loading project…</p>
        </div>
      </section>
    )
  }

  if (!project) {
    return (
      <section className="pd-page">
        <div className="project-empty-state"><h2>Project not found</h2></div>
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
            <span>Projects</span>
          </Link>
          <div className="pd-hero__actions">
            <button type="button" className="pd-icon-btn" title="Edit project" onClick={() => setProjectDialogOpen(true)}>
              <Pencil size={15} strokeWidth={2} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="pd-icon-btn pd-icon-btn--danger"
              title="Archive project"
              onClick={() => void projectsRepo.archive(project.id).then(load)}
            >
              <Trash2 size={15} strokeWidth={2} />
              <span>Archive</span>
            </button>
            <button type="button" className="pd-btn pd-btn--primary" onClick={() => setTaskDialogOpen(true)}>
              <Plus size={15} strokeWidth={2.2} />
              Add Task
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
              {project.goal || project.description || 'No project description yet.'}
            </motion.p>

            <motion.div variants={slideUp} className="pd-hero__meta">
              <span className="pd-meta-chip">
                <User size={12} />
                {project.ownerId ? (ownerMap.get(project.ownerId) ?? 'Unassigned') : 'Unassigned'}
              </span>
              {(project.startDate || project.dueDate) ? (
                <span className="pd-meta-chip">
                  <CalendarDays size={12} />
                  {project.startDate ?? '—'} → {project.dueDate ?? '—'}
                </span>
              ) : null}
              <span className="pd-meta-chip pd-meta-chip--status">
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </span>
            </motion.div>
          </div>

          {/* Progress ring + quick stats */}
          <motion.div variants={slideUp} className="pd-hero__ring-section">
            <ProgressRing progress={project.progress} size={100} />
            <div className="pd-hero__quickstats">
              <div className="pd-qstat">
                <strong>{tasks.length}</strong>
                <span>Total</span>
              </div>
              <div className="pd-qstat pd-qstat--green">
                <strong>{completedCount}</strong>
                <span>Done</span>
              </div>
              <div className="pd-qstat pd-qstat--blue">
                <strong>{activeCount}</strong>
                <span>Active</span>
              </div>
              {overdueCount > 0 ? (
                <div className="pd-qstat pd-qstat--red">
                  <strong>{overdueCount}</strong>
                  <span>Overdue</span>
                </div>
              ) : null}
            </div>
          </motion.div>
        </motion.div>

        {/* Tabs */}
        <div className="pd-tabs" role="tablist" aria-label="Project sections">
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
              {/* Stats row */}
              <motion.div className="pd-stats-row" variants={stagger} initial="hidden" animate="show">
                <StatCard label="TOTAL TASKS" value={tasks.length} delay={0} />
                <StatCard label="COMPLETED" value={completedCount} delay={60} color="#0D7A54" />
                <StatCard label="IN PROGRESS" value={activeCount} delay={120} color="#1E5BFF" />
                {overdueCount > 0 ? (
                  <StatCard label="OVERDUE" value={overdueCount} delay={180} color="#B83333" />
                ) : null}
              </motion.div>

              {/* Panel grid */}
              <motion.div
                className="pd-panel-grid"
                variants={stagger}
                initial="hidden"
                animate="show"
              >
                <motion.article variants={slideUp} className="pd-panel">
                  <div className="pd-panel__header">
                    <Zap size={16} className="pd-panel__icon pd-panel__icon--amber" />
                    <h3>Next Action</h3>
                  </div>
                  <p className="pd-panel__body">
                    {project.nextAction || 'Define the next meaningful step to move this project forward.'}
                  </p>
                  <button type="button" className="pd-panel__cta" onClick={() => setProjectDialogOpen(true)}>
                    Update →
                  </button>
                </motion.article>

                <motion.article variants={slideUp} className="pd-panel">
                  <div className="pd-panel__header">
                    <ShieldAlert size={16} className="pd-panel__icon pd-panel__icon--red" />
                    <h3>Risks & Blockers</h3>
                  </div>
                  <p className="pd-panel__body">
                    {project.riskSummary || (overdueCount > 0
                      ? `${overdueCount} task(s) are overdue and need attention.`
                      : 'No critical risks recorded. Looking good!')}
                  </p>
                  <button type="button" className="pd-panel__cta" onClick={() => setProjectDialogOpen(true)}>
                    Update →
                  </button>
                </motion.article>
              </motion.div>

              {/* Activity feed */}
              <motion.article
                className="pd-activity"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <h3 className="pd-activity__heading">Recent Activity</h3>
                {activity.length === 0 ? (
                  <p className="pd-muted">No activity recorded yet.</p>
                ) : (
                  <div className="pd-activity__list">
                    {activity.map((item, i) => (
                      <motion.div
                        key={item.id}
                        className="pd-activity__item"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.04, duration: 0.3 }}
                      >
                        <span
                          className="pd-activity__icon"
                          style={{ background: activityColor(item.id) + '18', color: activityColor(item.id) }}
                        >
                          {activityIcon(item.id)}
                        </span>
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
              <div className="pd-section-header">
                <h2 className="pd-section-title">Tasks <span className="pd-count">{visibleTasks.length}</span></h2>
                <div className="pd-filters">
                  <select
                    className="pd-select"
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value as typeof taskStatusFilter)}
                  >
                    <option value="all">All Status</option>
                    <option value="todo">Todo</option>
                    <option value="doing">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <select
                    className="pd-select"
                    value={taskOwnerFilter}
                    onChange={(e) => setTaskOwnerFilter(e.target.value)}
                  >
                    <option value="all">All Owners</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className="pd-btn pd-btn--ghost"
                    onClick={() => {
                      setEditingTask(null)
                      setTaskDialogOpen(true)
                    }}
                  >
                    <Plus size={14} /> Add Task
                  </button>
                </div>
              </div>

              <motion.div className="pd-task-list" variants={stagger} initial="hidden" animate="show">
                {visibleTasks.map((task) => {
                  const today = new Date().toISOString().slice(0, 10)
                  const isOverdue = task.status !== 'done' && task.dueDate && task.dueDate < today
                  const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
                  return (
                    <motion.article
                      key={task.id}
                      variants={slideUp}
                      className={`pd-task${isOverdue ? ' pd-task--overdue' : ''} pd-task--${task.status}`}
                      whileHover={{ y: -1, transition: { duration: 0.15 } }}
                      onClick={() => {
                        setEditingTask(task)
                        setTaskDialogOpen(true)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setEditingTask(task)
                          setTaskDialogOpen(true)
                        }
                      }}
                    >
                      <div className="pd-task__left">
                        <div className="pd-task__status-dot pd-task__status-dot--${task.status}" />
                        <div>
                          <h3 className="pd-task__title">{task.title}</h3>
                          {task.description ? <p className="pd-task__desc">{task.description}</p> : null}
                          <div className="pd-task__meta">
                            <span>
                              <User size={11} />
                              {task.ownerId ? (ownerMap.get(task.ownerId) ?? 'Unassigned') : 'Unassigned'}
                            </span>
                            {task.dueDate ? (
                              <span className={isOverdue ? 'pd-overdue-text' : ''}>
                                <CalendarDays size={11} />
                                {isOverdue ? '⚠ ' : ''}{task.dueDate}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <span className={sCfg.cls}>{sCfg.label}</span>
                    </motion.article>
                  )
                })}
                {visibleTasks.length === 0 ? (
                  <div className="pd-empty-inline">No tasks match the current filters.</div>
                ) : null}
              </motion.div>
            </motion.div>
          ) : null}

          {/* ── TIMELINE ──────────────────────────────────────── */}
          {tab === 'timeline' ? (
            <motion.div key="timeline" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">Timeline</h2>
                <div className="pd-toggle">
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'week' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('week')}
                  >Week</button>
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'month' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('month')}
                  >Month</button>
                  <button
                    type="button"
                    className={`pd-toggle__btn${timelineMode === 'year' ? ' pd-toggle__btn--active' : ''}`}
                    onClick={() => setTimelineMode('year')}
                  >Year</button>
                </div>
              </div>

              {timelineRange ? (
                <div className="pd-timeline-axis">
                  <div className="pd-timeline-axis__range">
                    <span className="pd-timeline-range">{timelineRange.min} → {timelineRange.max}</span>
                  </div>
                  <div className="pd-timeline-axis__ruler">
                    <div className="pd-timeline-axis__line" />
                    {timelineTicks.map((tick) => (
                      <div key={tick.key} className="pd-timeline-axis__tick" style={{ left: tick.left }}>
                        <span className="pd-timeline-axis__mark" />
                        <span className="pd-timeline-axis__label">{tick.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pd-timeline">
                {sortByDate(tasks).map((task, i) => {
                  const barProps = timelineRange ? taskBarProps(task) : { left: '0%', width: timelineMode === 'week' ? '50%' : timelineMode === 'month' ? '24%' : '8%', hidden: false }
                  const sCfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.todo
                  return (
                    <motion.div
                      key={task.id}
                      className={`pd-timeline__row pd-timeline__row--${task.status}`}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 + i * 0.06, duration: 0.35 }}
                    >
                      <div className="pd-timeline__meta">
                        <span className="pd-timeline__date">{task.startDate ?? task.dueDate ?? `T+${i + 1}`}</span>
                        <span className="pd-timeline__status-wrap">
                          <span className={sCfg.cls} style={{ fontSize: '10px', padding: '2px 7px' }}>{sCfg.label}</span>
                        </span>
                      </div>
                      <div className="pd-timeline__track">
                        <div className="pd-timeline__lane" />
                        {!barProps.hidden ? (
                          <motion.div
                            className={`pd-timeline__bar pd-timeline__bar--${task.status}`}
                            style={{ left: barProps.left }}
                            initial={{ width: '0%', opacity: 0 }}
                            animate={{ width: barProps.width, opacity: 1 }}
                            transition={{ delay: 0.15 + i * 0.06, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <strong>{task.title}</strong>
                            {task.ownerId ? <span className="pd-timeline__owner">{ownerMap.get(task.ownerId) ?? ''}</span> : null}
                          </motion.div>
                        ) : null}
                      </div>
                    </motion.div>
                  )
                })}
                {tasks.length === 0 ? (
                  <div className="pd-empty-inline">No tasks scheduled yet.</div>
                ) : null}
              </div>
            </motion.div>
          ) : null}

          {/* ── PEOPLE ────────────────────────────────────────── */}
          {tab === 'people' ? (
            <motion.div key="people" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">Team <span className="pd-count">{people.length}</span></h2>
                <button
                  type="button"
                  className="pd-btn pd-btn--primary"
                  onClick={() => { setEditingPerson(null); setPersonDialogOpen(true) }}
                >
                  <Plus size={14} /> Add Person
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
                        <span>tasks</span>
                      </div>
                      <div className="pd-person__contact">
                        {person.email ? (
                          <span><Mail size={12} />{person.email}</span>
                        ) : null}
                        {person.phone ? (
                          <span><Phone size={12} />{person.phone}</span>
                        ) : null}
                        {!person.email && !person.phone ? (
                          <span className="pd-muted">No contact info</span>
                        ) : null}
                      </div>
                    </motion.article>
                  )
                })}
                {people.length === 0 ? (
                  <div className="pd-empty-inline">No team members yet. Add people to assign tasks.</div>
                ) : null}
              </motion.div>
            </motion.div>
          ) : null}

          {/* ── NOTES ─────────────────────────────────────────── */}
          {tab === 'notes' ? (
            <motion.div key="notes" variants={tabContent} initial="hidden" animate="show" exit="exit">
              <div className="pd-section-header">
                <h2 className="pd-section-title">Notes <span className="pd-count">{visibleNotes.length}</span></h2>
                <div className="pd-search">
                  <Search size={14} strokeWidth={2} />
                  <Input
                    value={notesQuery}
                    onChange={(e) => setNotesQuery(e.target.value)}
                    className="pd-search__input"
                    placeholder="Search notes…"
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
                        Open
                      </button>
                      <button
                        type="button"
                        className="pd-btn pd-btn--danger-ghost"
                        onClick={() => void projectNoteLinksRepo.remove(project.id, note.id).then(load)}
                      >
                        Unlink
                      </button>
                    </div>
                  </motion.article>
                ))}
                {visibleNotes.length === 0 ? (
                  <div className="pd-empty-inline">
                    No linked notes yet. Tag a note with <code>project:{project.id}</code> to link it here.
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
        task={editingTask}
        people={people}
        onClose={() => {
          setTaskDialogOpen(false)
          setEditingTask(null)
        }}
        onSubmit={async (payload) => {
          if (editingTask) {
            await tasksRepo.update({
              ...editingTask,
              title: payload.title,
              description: payload.description,
              status: payload.status,
              priority: payload.priority,
              ownerId: payload.ownerId,
              startDate: payload.startDate,
              dueDate: payload.dueDate,
            })
          } else {
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
          }
          setTaskDialogOpen(false)
          setEditingTask(null)
          await load()
        }}
      />
    </section>
  )
}

export default ProjectDetailPage
