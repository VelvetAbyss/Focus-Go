import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ChevronDown,
  ChevronRight,
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
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TranslationKey } from '../../../shared/i18n/types'
import './timeline.css'

type KindFilter = 'all' | TimelineKind
type DomainFilter = 'all' | EntityRefDomain

const KIND_OPTIONS: KindFilter[] = ['all', 'task', 'focus', 'note', 'project', 'diary', 'podcast']

const DOMAIN_OPTIONS: DomainFilter[] = ['all', 'productivity', 'content', 'life', 'commercial']

// Titles are stored in English by the projection; render them from the
// source event type so the feed follows the app language.
const EVENT_TITLE_KEYS: Partial<Record<string, TranslationKey>> = {
  'task.created': 'timeline.event.task.created',
  'task.completed': 'timeline.event.task.completed',
  'focus.started': 'timeline.event.focus.started',
  'focus.completed': 'timeline.event.focus.completed',
  'note.created': 'timeline.event.note.created',
  'note.updated': 'timeline.event.note.updated',
  'project.created': 'timeline.event.project.created',
  'project.archived': 'timeline.event.project.archived',
  'diary.created': 'timeline.event.diary.created',
  'podcast.saved': 'timeline.event.podcast.saved',
  'news.saved': 'timeline.event.news.saved',
  'payment.success': 'timeline.event.payment.success',
  'sync.finished': 'timeline.event.sync.finished',
}

type Translate = ReturnType<typeof useI18n>['t']

const kindLabel = (kind: KindFilter, t: Translate) => t(`timeline.kind.${kind}` as TranslationKey)
const domainLabel = (domain: DomainFilter, t: Translate) => t(`timeline.domain.${domain}` as TranslationKey)

const itemTitle = (item: TimelineItem, t: Translate) => {
  const key = EVENT_TITLE_KEYS[item.source?.eventType ?? '']
  return key ? t(key) : item.title
}

// Stored note summaries carry internals: the collection id ("all-notes"), project link
// tags ("project:<uuid>") and an English "Untitled" placeholder. None of it reads as
// content, so it is dropped at display time (older items were stored that way).
const INTERNAL_SUMMARY_PART = /^(?:all-notes|Untitled|project:[\w-]+)$/

// Focus summaries are stored as "25 min · goal".
const itemSummary = (item: TimelineItem, t: Translate) => {
  if (!item.summary) return item.summary
  if (item.kind === 'focus') return item.summary.replace(/^(\d+) min\b/, (_, n: string) => t('timeline.focusMinutes', { n }))
  return item.summary
    .split(' · ')
    .filter((part) => !INTERNAL_SUMMARY_PART.test(part.trim()))
    .join(' · ')
}

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

const groupLabel = (time: number, t: Translate) => {
  const today = startOfDay(Date.now())
  const day = startOfDay(time)
  const diff = today - day
  if (diff === 0) return t('timeline.group.today')
  if (diff === 86_400_000) return t('timeline.group.yesterday')
  if (diff < 7 * 86_400_000) return t('timeline.group.thisWeek')
  return new Date(time).toLocaleDateString(appIntlLocale(), { month: 'short', year: 'numeric' })
}

const formatTime = (time: number) =>
  new Date(time).toLocaleTimeString(appIntlLocale(), { hour: '2-digit', minute: '2-digit' })

// A run of the same event within half an hour ("新建笔记" ×7) reads as one row.
const BURST_WINDOW_MS = 30 * 60 * 1000
const BURST_MIN = 3

type FeedEntry =
  | { type: 'item'; item: TimelineItem }
  | { type: 'burst'; key: string; items: TimelineItem[] }

const eventKey = (item: TimelineItem) => item.source?.eventType ?? `${item.kind}:${item.title}`

const collapseBursts = (items: TimelineItem[]): FeedEntry[] => {
  const runs: TimelineItem[][] = []
  for (const item of items) {
    const run = runs[runs.length - 1]
    const last = run?.[run.length - 1]
    if (
      run && last && !item.pinned && !last.pinned &&
      eventKey(last) === eventKey(item) &&
      Math.abs(last.occurredAt - item.occurredAt) <= BURST_WINDOW_MS
    ) {
      run.push(item)
    } else {
      runs.push([item])
    }
  }
  return runs.flatMap((run): FeedEntry[] =>
    run.length >= BURST_MIN
      ? [{ type: 'burst', key: run[0].id, items: run }]
      : run.map((item) => ({ type: 'item', item })),
  )
}

const buildGroups = (items: TimelineItem[], t: Translate) => {
  const groups = new Map<string, TimelineItem[]>()
  for (const item of items) {
    const label = groupLabel(item.occurredAt, t)
    groups.set(label, [...(groups.get(label) ?? []), item])
  }
  return [...groups.entries()].map(([label, groupItems]) => [label, collapseBursts(groupItems)] as const)
}

// For these kinds the summary is the thing itself (a task or note title) and leads the row;
// for the rest (focus minutes, a diary date, a sync) the event reads better first.
const CONTENT_FIRST_KINDS = new Set<TimelineKind>(['task', 'note', 'project', 'podcast', 'news'])

const RECAP_OPEN_KEY = 'focusgo.timeline.recapOpen'

const TimelinePage = () => {
  const { t } = useI18n()
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
  const [expandedBursts, setExpandedBursts] = useState<Set<string>>(() => new Set())
  // The recap card is a full summary; folded by default so the feed starts on the first screen.
  const [recapOpen, setRecapOpen] = useState(() => {
    try {
      return window.localStorage.getItem(RECAP_OPEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const toggleRecap = () => {
    setRecapOpen((open) => {
      try {
        window.localStorage.setItem(RECAP_OPEN_KEY, open ? '0' : '1')
      } catch {
        // ignore
      }
      return !open
    })
  }
  const toggleBurst = (key: string) => {
    setExpandedBursts((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
      completedTasks: items.filter((item) => item.source?.eventType === 'task.completed' && item.occurredAt >= today).length,
      focusMinutes: items
        .filter((item) => item.kind === 'focus' && item.occurredAt >= today)
        .reduce((total, item) => total + Number(item.summary?.match(/^\d+/)?.[0] ?? 0), 0),
      captures: items.filter((item) => (item.kind === 'note' || item.kind === 'diary') && item.occurredAt >= today).length,
    }
  }, [items, todayAnchor])

  const groups = useMemo(() => buildGroups(items, t), [items, t])

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

  const renderItem = (item: TimelineItem) => {
    const Icon = ICONS[item.kind]
    const eventLabel = itemTitle(item, t)
    const summary = itemSummary(item, t)
    const contentFirst = Boolean(summary) && CONTENT_FIRST_KINDS.has(item.kind)
    const heading = contentFirst ? summary : eventLabel
    const meta = [contentFirst ? eventLabel : summary, item.related.length ? t('timeline.item.linked', { n: item.related.length }) : '']
      .filter(Boolean)
      .join(' · ')
    return (
      <article className="timeline-item" key={item.id} data-kind={item.kind} data-pinned={item.pinned ? 'true' : undefined}>
        <div className="timeline-item__mark">
          <Icon size={14} aria-hidden="true" />
        </div>
        <div className="timeline-item__body">
          <div className="timeline-item__title-row">
            <h2>{heading}</h2>
            <time>{formatTime(item.occurredAt)}</time>
          </div>
          {meta ? <p className="timeline-item__meta">{meta}</p> : null}
        </div>
        <div className="timeline-item__actions">
          <button type="button" onClick={() => void togglePin(item)} aria-label={item.pinned ? t('timeline.item.unpin') : t('timeline.item.pin')}>
            {item.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
          </button>
          <button type="button" onClick={() => void hide(item)} aria-label={t('timeline.item.hide')}>
            <Trash2 size={15} aria-hidden="true" />
          </button>
          {item.route ? <Link to={item.route}>{t('timeline.item.open')}</Link> : null}
        </div>
      </article>
    )
  }

  return (
    <div className="timeline-page" data-testid="timeline-page">
      <header className="timeline-page__header">
        <div>
          <p className="timeline-page__eyebrow">{t('timeline.eyebrow')}</p>
          <h1>{t('timeline.title')}</h1>
        </div>
      </header>

      <section className="timeline-page__toolbar" aria-label={t('timeline.filtersAria')}>
        <label className="timeline-page__search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('timeline.searchPlaceholder')} />
        </label>
        <select value={domain} onChange={(event) => setDomain(event.target.value as DomainFilter)} aria-label={t('timeline.domainAria')}>
          {DOMAIN_OPTIONS.map((option) => <option key={option} value={option}>{domainLabel(option, t)}</option>)}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value as KindFilter)} aria-label={t('timeline.kindAria')}>
          {KIND_OPTIONS.map((option) => <option key={option} value={option}>{kindLabel(option, t)}</option>)}
        </select>
        <button className={pinnedOnly ? 'is-active' : ''} type="button" onClick={() => setPinnedOnly((value) => !value)} aria-pressed={pinnedOnly}>
          <Pin size={15} aria-hidden="true" />
          <span>{t('timeline.pinned')}</span>
        </button>
        <button className={includeQuiet ? 'is-active' : ''} type="button" onClick={() => setIncludeQuiet((value) => !value)} aria-pressed={includeQuiet}>
          <Archive size={15} aria-hidden="true" />
          <span>{t('timeline.quiet')}</span>
        </button>
        {/* Maintenance, not a daily action: an icon at the end of the toolbar. */}
        <button
          className="timeline-page__repair"
          type="button"
          onClick={rebuild}
          disabled={repairing}
          aria-label={t('timeline.rebuildHint')}
          title={t('timeline.rebuildHint')}
        >
          <RotateCcw size={15} aria-hidden="true" className={repairing ? 'animate-spin' : undefined} />
        </button>
      </section>

      <aside className="timeline-page__stats" aria-label={t('timeline.statsAria')}>
        <div><strong><AppNumber value={stats.completedTasks} /></strong><span>{t('timeline.stats.tasksDone')}</span></div>
        <div><strong><AppNumber value={stats.focusMinutes} /></strong><span>{t('timeline.stats.focusMinutes')}</span></div>
        <div><strong><AppNumber value={stats.captures} /></strong><span>{t('timeline.stats.captures')}</span></div>
      </aside>

      <section className="timeline-page__progress-summary" aria-label={t('timeline.progressAria')} data-open={recapOpen ? 'true' : 'false'}>
        <button type="button" className="timeline-page__recap-toggle" aria-expanded={recapOpen} onClick={toggleRecap}>
          {recapOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
          <span>{t('timeline.recap.toggle')}</span>
          <small>{t('timeline.recap.hint')}</small>
        </button>
        {recapOpen ? (
          <div className="timeline-page__recap-body">
            <TaskProgressSummaryCard tasks={tasks} projects={projects} compact />
          </div>
        ) : null}
      </section>

      <main className="timeline-feed" aria-busy={loading}>
        {loading ? <div className="timeline-empty">{t('timeline.loading')}</div> : null}
        {!loading && groups.length === 0 ? (
          <div className="timeline-empty">
            <h2>{t('timeline.empty.title')}</h2>
            <p>{t('timeline.empty.body')}</p>
            <button type="button" onClick={rebuild} disabled={repairing}>
              <RefreshCw size={16} aria-hidden="true" />
              <span>{repairing ? t('timeline.empty.checking') : t('timeline.empty.check')}</span>
            </button>
          </div>
        ) : null}
        {groups.map(([label, entries]) => (
          <section className="timeline-group" key={label} aria-label={label}>
            <div className="timeline-group__label">{label}</div>
            <div className="timeline-group__items">
              {entries.map((entry) => {
                if (entry.type === 'item') return renderItem(entry.item)
                const first = entry.items[0]
                const Icon = ICONS[first.kind]
                const open = expandedBursts.has(entry.key)
                const names = [...new Set(entry.items.map((item) => itemSummary(item, t)).filter(Boolean))]
                return (
                  <div key={entry.key} className="timeline-burst" data-open={open ? 'true' : 'false'}>
                    <article className="timeline-item timeline-item--burst" data-kind={first.kind}>
                      <div className="timeline-item__mark">
                        <Icon size={14} aria-hidden="true" />
                      </div>
                      <div className="timeline-item__body">
                        <div className="timeline-item__title-row">
                          <h2>{t('timeline.burst.title', { event: itemTitle(first, t), n: entry.items.length })}</h2>
                          <time>{formatTime(entry.items[entry.items.length - 1].occurredAt)} – {formatTime(first.occurredAt)}</time>
                        </div>
                        {names.length ? (
                          <p className="timeline-item__meta">{names.slice(0, 3).join(' · ')}{names.length > 3 ? ' …' : ''}</p>
                        ) : null}
                      </div>
                      <div className="timeline-item__actions timeline-item__actions--always">
                        <button type="button" onClick={() => toggleBurst(entry.key)} aria-expanded={open}>
                          {open ? t('timeline.burst.collapse') : t('timeline.burst.expand')}
                        </button>
                      </div>
                    </article>
                    {open ? <div className="timeline-burst__items">{entry.items.map(renderItem)}</div> : null}
                  </div>
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

import { appIntlLocale } from '../../../shared/i18n/format'
import { AppNumber } from '../../../shared/ui/AppNumber'