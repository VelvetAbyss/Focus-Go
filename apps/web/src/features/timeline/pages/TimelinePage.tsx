import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  CreditCard,
  Headphones,
  ListTodo,
  Notebook,
  NotebookPen,
  PanelsTopLeft,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  Search,
  Timer,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { EntityRefDomain, ProjectItem, TimelineItem, TimelineKind } from '../../../data/models/types'
import { timelineRepo } from '../../../data/repositories/timelineRepo'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { projectsRepo } from '../../../data/repositories/projectsRepo'
import { SYNC_DATA_UPDATED_EVENT } from '../../../data/sync/constants'
import type { TaskItem } from '../../tasks/tasks.types'
import TaskProgressSummaryCard from '../../tasks/components/TaskProgressSummaryCard'
import './timeline.css'

type KindFilter = 'all' | TimelineKind
type DomainFilter = 'all' | EntityRefDomain

const KIND_OPTIONS: Array<{ value: KindFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'task', label: 'Tasks' },
  { value: 'focus', label: 'Focus' },
  { value: 'note', label: 'Notes' },
  { value: 'project', label: 'Projects' },
  { value: 'diary', label: 'Diary' },
  { value: 'podcast', label: 'Podcasts' },
]

const DOMAIN_OPTIONS: Array<{ value: DomainFilter; label: string }> = [
  { value: 'all', label: 'Everywhere' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'content', label: 'Content' },
  { value: 'life', label: 'Life' },
  { value: 'commercial', label: 'Commercial' },
]

const ICONS: Record<TimelineKind, LucideIcon> = {
  task: ListTodo,
  focus: Timer,
  note: Notebook,
  project: PanelsTopLeft,
  diary: NotebookPen,
  podcast: Headphones,
  news: Notebook,
  payment: CreditCard,
  sync: RefreshCw,
}

const startOfDay = (time: number) => {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const groupLabel = (time: number) => {
  const today = startOfDay(Date.now())
  const day = startOfDay(time)
  const diff = today - day
  if (diff === 0) return 'Today'
  if (diff === 86_400_000) return 'Yesterday'
  if (diff < 7 * 86_400_000) return 'This Week'
  return new Date(time).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const formatTime = (time: number) =>
  new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

const buildGroups = (items: TimelineItem[]) => {
  const groups = new Map<string, TimelineItem[]>()
  for (const item of items) {
    const label = groupLabel(item.occurredAt)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups.entries()]
}

const TimelinePage = () => {
  const [items, setItems] = useState<TimelineItem[]>([])
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [kind, setKind] = useState<KindFilter>('all')
  const [domain, setDomain] = useState<DomainFilter>('all')
  const [query, setQuery] = useState('')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [includeQuiet, setIncludeQuiet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [repairing, setRepairing] = useState(false)
  const [todayAnchor, setTodayAnchor] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setTodayAnchor(Date.now())
    const [result, nextTasks, nextProjects] = await Promise.all([
      timelineRepo.list({
        kind: kind === 'all' ? undefined : kind,
        domain: domain === 'all' ? undefined : domain,
        search: query,
        pinnedOnly,
        visibility: includeQuiet ? ['default', 'quiet'] : ['default'],
        limit: 160,
      }),
      tasksRepo.list(),
      projectsRepo.list(),
    ])
    setItems(result.items)
    setTasks(nextTasks)
    setProjects(nextProjects)
    setLoading(false)
  }, [domain, includeQuiet, kind, pinnedOnly, query])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, refresh)
    return () => window.removeEventListener(SYNC_DATA_UPDATED_EVENT, refresh)
  }, [load])

  const stats = useMemo(() => {
    const today = startOfDay(todayAnchor)
    return {
      completedTasks: items.filter((item) => item.kind === 'task' && item.title.toLowerCase().includes('completed') && item.occurredAt >= today).length,
      focusMinutes: items
        .filter((item) => item.kind === 'focus' && item.occurredAt >= today)
        .reduce((total, item) => total + Number(item.summary?.match(/^\d+/)?.[0] ?? 0), 0),
      captures: items.filter((item) => (item.kind === 'note' || item.kind === 'diary') && item.occurredAt >= today).length,
    }
  }, [items, todayAnchor])

  const groups = useMemo(() => buildGroups(items), [items])

  const rebuild = async () => {
    setRepairing(true)
    await timelineRepo.rebuild()
    await timelineRepo.backfill()
    await load()
    setRepairing(false)
  }

  const togglePin = async (item: TimelineItem) => {
    await timelineRepo.pin(item.id, !item.pinned)
    await load()
  }

  const hide = async (item: TimelineItem) => {
    await timelineRepo.hide(item.id)
    await load()
  }

  return (
    <div className="timeline-page" data-testid="timeline-page">
      <header className="timeline-page__header">
        <div>
          <p className="timeline-page__eyebrow">Activity</p>
          <h1>Timeline</h1>
        </div>
        <button className="timeline-page__repair" type="button" onClick={rebuild} disabled={repairing}>
          <RotateCcw size={16} aria-hidden="true" />
          <span>{repairing ? 'Rebuilding' : 'Rebuild'}</span>
        </button>
      </header>

      <section className="timeline-page__toolbar" aria-label="Timeline filters">
        <label className="timeline-page__search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, summary, source" />
        </label>
        <select value={domain} onChange={(event) => setDomain(event.target.value as DomainFilter)} aria-label="Domain">
          {DOMAIN_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} aria-label="Kind">
          {KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button className={pinnedOnly ? 'is-active' : ''} type="button" onClick={() => setPinnedOnly((value) => !value)} aria-pressed={pinnedOnly}>
          <Pin size={15} aria-hidden="true" />
          <span>Pinned</span>
        </button>
        <button className={includeQuiet ? 'is-active' : ''} type="button" onClick={() => setIncludeQuiet((value) => !value)} aria-pressed={includeQuiet}>
          <Archive size={15} aria-hidden="true" />
          <span>Quiet</span>
        </button>
      </section>

      <aside className="timeline-page__stats" aria-label="Today snapshot">
        <div><strong>{stats.completedTasks}</strong><span>tasks done</span></div>
        <div><strong>{stats.focusMinutes}</strong><span>focus min</span></div>
        <div><strong>{stats.captures}</strong><span>notes + diary</span></div>
      </aside>

      <section className="timeline-page__progress-summary" aria-label="Task progress summary">
        <TaskProgressSummaryCard tasks={tasks} projects={projects} compact />
      </section>

      <main className="timeline-feed" aria-busy={loading}>
        {loading ? <div className="timeline-empty">Loading activity…</div> : null}
        {!loading && groups.length === 0 ? (
          <div className="timeline-empty">
            <h2>No activity yet</h2>
            <p>Create a task, finish a focus session, or write a diary entry. This page will become your workday ledger.</p>
            <button type="button" onClick={rebuild} disabled={repairing}>
              <RefreshCw size={16} aria-hidden="true" />
              <span>{repairing ? 'Checking' : 'Check existing data'}</span>
            </button>
          </div>
        ) : null}
        {groups.map(([label, groupItems]) => (
          <section className="timeline-group" key={label} aria-label={label}>
            <div className="timeline-group__label">{label}</div>
            <div className="timeline-group__items">
              {groupItems.map((item) => {
                const Icon = ICONS[item.kind]
                return (
                  <article className="timeline-item" key={item.id} data-kind={item.kind}>
                    <div className="timeline-item__mark" style={{ '--timeline-accent': item.accent ?? '#3A3733' } as CSSProperties}>
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="timeline-item__body">
                      <div className="timeline-item__title-row">
                        <h2>{item.title}</h2>
                        <time>{formatTime(item.occurredAt)}</time>
                      </div>
                      {item.summary ? <p>{item.summary}</p> : null}
                      <div className="timeline-item__meta">
                        <span>{item.domain}</span>
                        <span>{item.kind}</span>
                        {item.related.length ? <span>{item.related.length} linked</span> : null}
                      </div>
                    </div>
                    <div className="timeline-item__actions">
                      <button type="button" onClick={() => void togglePin(item)} aria-label={item.pinned ? 'Unpin item' : 'Pin item'}>
                        {item.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
                      </button>
                      <button type="button" onClick={() => void hide(item)} aria-label="Hide item">
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                      {item.route ? <Link to={item.route}>Open</Link> : null}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default TimelinePage
