import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckSquare,
  ListChecks,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import type { ProjectItem } from '../../../data/models/types'
import { buildTaskAnalytics, type AnalyticsGranularity } from './taskAnalytics'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from './taskPresentation'
import { useI18n } from '../../../shared/i18n/useI18n'
import TaskProgressSummaryCard from './TaskProgressSummaryCard'

type TasksAnalyticsViewProps = {
  tasks: TaskItem[]
  projects?: ProjectItem[]
}

const STORAGE_KEY = 'tasks_analytics_granularity'

const granularityOptions: AnalyticsGranularity[] = ['day', 'week', 'month']
const granularityLabelKeys: Record<AnalyticsGranularity, 'modules.tasks.analytics.day' | 'modules.tasks.analytics.week' | 'modules.tasks.analytics.month'> = {
  day: 'modules.tasks.analytics.day',
  week: 'modules.tasks.analytics.week',
  month: 'modules.tasks.analytics.month',
}

// Status tone-matched colors (match toolbar dots)
const STATUS_COLOR: Record<'todo' | 'doing' | 'done', string> = {
  todo: '#a8a29e',
  doing: '#14b8a6',
  done: '#10b981',
}

// Priority tone-matched colors
const PRIORITY_COLOR: Record<'high' | 'medium' | 'low' | 'none', string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#65a30d',
  none: '#a8a29e',
}

const TasksAnalyticsView = ({ tasks, projects = [] }: TasksAnalyticsViewProps) => {
  const { t } = useI18n()
  const [granularity, setGranularity] = useState<AnalyticsGranularity>(() => {
    if (typeof window === 'undefined') return 'week'
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'day' || stored === 'week' || stored === 'month' ? stored : 'week'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, granularity)
  }, [granularity])

  const analytics = useMemo(() => buildTaskAnalytics(tasks, { granularity }), [tasks, granularity])

  const maxCompletion = Math.max(...analytics.buckets.map((b) => b.completions), 0)
  const trendPeak = Math.max(maxCompletion, 1)
  const hasHistory = analytics.buckets.some((b) => b.completions > 0)
  const currentBucketIndex = analytics.buckets.length - 1

  // Streak pills — last 7 buckets, one filled per completion-bearing bucket
  const streakPills = useMemo(() => {
    const last = analytics.buckets.slice(-7)
    while (last.length < 7) last.unshift({ key: `pad-${last.length}`, label: '', startAt: 0, endAt: 0, completions: 0, created: 0, subtasksCompleted: 0, subtasksTotal: 0, overdue: 0, dueSoon: 0 })
    return last.map((b, i) => ({
      key: b.key + i,
      active: b.completions > 0,
      isCurrent: i === last.length - 1,
    }))
  }, [analytics.buckets])

  const statusRows = (['todo', 'doing', 'done'] as const).map((status) => {
    const cfg = TASK_STATUS_CONFIG[status]
    const count = analytics.summary.statusCounts[status]
    const total = analytics.summary.totalTasks || 1
    return {
      key: status,
      label: t(cfg.labelKey),
      count,
      percent: Math.round((count / total) * 100),
      color: STATUS_COLOR[status],
    }
  })

  const priorityRows = (['high', 'medium', 'low', 'none'] as const).map((priority) => {
    const cfg = TASK_PRIORITY_CONFIG[priority]
    const count = analytics.summary.priorityCounts[priority]
    const total = analytics.summary.totalTasks || 1
    return {
      key: priority,
      label: t(cfg.labelKey),
      count,
      percent: Math.round((count / total) * 100),
      color: PRIORITY_COLOR[priority],
    }
  })

  const miniCards = [
    { key: 'totalTasks', label: t('modules.tasks.analytics.totalTasks'), value: analytics.summary.totalTasks, icon: ListChecks, tone: 'neutral' },
    { key: 'completedTasks', label: t('modules.tasks.analytics.completedTasks'), value: analytics.summary.completedTasks, icon: CheckSquare, tone: 'neutral' },
    { key: 'avg', label: t('modules.tasks.analytics.average'), value: analytics.summary.averageCompletions, icon: TrendingUp, tone: 'neutral' },
    { key: 'overdue', label: t('modules.tasks.analytics.overdueTasks'), value: analytics.summary.overdueTasks, icon: AlertTriangle, tone: analytics.summary.overdueTasks > 0 ? 'alert' : 'neutral' },
  ] as const

  return (
    <section className="tasks-analytics-v2 flex h-full min-h-0 flex-col gap-4">
      {/* Toolbar — granularity tabs + context tagline */}
      <div className="flex items-center justify-between gap-3 flex-none">
        <div className="flex items-center gap-1 rounded-xl border border-[color:var(--ts-line)] bg-[color-mix(in_srgb,var(--bg-elevated)_70%,transparent)] p-1">
          {granularityOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={granularity === option}
              className={cn(
                'tasks-fg__mode-tab',
                granularity === option && 'tasks-fg__mode-tab--active',
              )}
              onClick={() => setGranularity(option)}
            >
              {t(granularityLabelKeys[option])}
            </button>
          ))}
        </div>

        <p className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--ts-ink-soft)' }}>
          {t(granularityLabelKeys[granularity])} · {analytics.buckets.length} {t('modules.tasks.analytics.totalCompletions').includes('总') ? '段' : 'buckets'} · {t('modules.tasks.analytics.completionRate')} {analytics.summary.completionRate}%
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-2 pr-1">
        {/* Hero — completion rate big number + sparkline + streak */}
        <article className="tasks-analytics-v2__card tasks-analytics-v2__card--paper">
          <div className="tasks-analytics-v2__hero">
            <div>
              <p className="tasks-analytics-v2__eyebrow">{t('modules.tasks.analytics.completionRate')}</p>
              <p className="tasks-analytics-v2__hero-rate">
                {analytics.summary.completionRate}
                <span className="tasks-analytics-v2__hero-rate-suffix">%</span>
              </p>
              <div className="tasks-analytics-v2__hero-meta">
                <span className="tasks-analytics-v2__hero-meta-item">
                  <span>{t('modules.tasks.analytics.completedTasks')}</span>
                  <span className="tasks-analytics-v2__hero-meta-num">{analytics.summary.completedTasks}</span>
                  <span>/ {analytics.summary.totalTasks}</span>
                </span>
                <span className="tasks-analytics-v2__hero-meta-item">
                  <span>{t('modules.tasks.analytics.average')}</span>
                  <span className="tasks-analytics-v2__hero-meta-num">{analytics.summary.averageCompletions}</span>
                </span>
                <span className="tasks-analytics-v2__hero-meta-item">
                  <span>{t('modules.tasks.analytics.totalCompletions')}</span>
                  <span className="tasks-analytics-v2__hero-meta-num">{analytics.summary.completions}</span>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Sparkline */}
              <div className="tasks-analytics-v2__spark" aria-hidden="true">
                {analytics.buckets.map((b, i) => {
                  const h = trendPeak > 0 ? Math.max((b.completions / trendPeak) * 100, b.completions > 0 ? 14 : 6) : 6
                  return (
                    <div
                      key={b.key}
                      className="tasks-analytics-v2__spark-bar"
                      data-empty={b.completions === 0 ? 'true' : 'false'}
                      data-current={i === currentBucketIndex ? 'true' : 'false'}
                      style={{ height: `${h}%` }}
                    />
                  )
                })}
              </div>

              {/* Streak */}
              <div className="tasks-analytics-v2__streak">
                <span className="tasks-analytics-v2__streak-num">{analytics.summary.streakDays}</span>
                <span className="tasks-analytics-v2__streak-label">{t('modules.tasks.analytics.streakDays')}</span>
                <span className="tasks-analytics-v2__streak-pills" aria-hidden="true">
                  {streakPills.map((p) => (
                    <span
                      key={p.key}
                      className="tasks-analytics-v2__streak-pill"
                      data-active={p.active ? 'true' : 'false'}
                      data-today={p.isCurrent ? 'true' : 'false'}
                    />
                  ))}
                </span>
              </div>
            </div>
          </div>
        </article>

        <div className="min-h-[420px]">
          <TaskProgressSummaryCard tasks={tasks} projects={projects} compact />
        </div>

        {/* Mini metric strip */}
        <div className="tasks-analytics-v2__mini">
          {miniCards.map(({ key, label, value, icon: Icon, tone }) => (
            <div key={key} className="tasks-analytics-v2__mini-card" data-tone={tone}>
              <span className="tasks-analytics-v2__mini-card-icon">
                <Icon className="size-3.5" strokeWidth={1.8} />
              </span>
              <span className="tasks-analytics-v2__mini-card-label">{label}</span>
              <span className="tasks-analytics-v2__mini-card-value">{value}</span>
            </div>
          ))}
        </div>

        {/* Trend chart */}
        <article className="tasks-analytics-v2__card">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <div>
              <p className="tasks-analytics-v2__eyebrow">{t('modules.tasks.analytics.trendTitle')}</p>
              <h2 className="tasks-analytics-v2__title">{t(granularityLabelKeys[granularity])}</h2>
            </div>
            <div className="flex gap-4 text-[11px]" style={{ color: 'var(--ts-ink-soft)' }}>
              <span>{t('modules.tasks.analytics.peak')}: <span style={{ color: 'var(--ts-ink)', fontWeight: 600 }}>{maxCompletion}</span></span>
            </div>
          </div>

          <div className="tasks-analytics-v2__chart">
            <div className="tasks-analytics-v2__chart-grid" aria-hidden="true">
              {[0.25, 0.5, 0.75, 1].map((r) => (
                <div key={r} className="tasks-analytics-v2__chart-grid-line" style={{ top: `${(1 - r) * 100}%` }} />
              ))}
            </div>
            {analytics.buckets.map((b, i) => {
              const h = trendPeak > 0 ? Math.max((b.completions / trendPeak) * 100, b.completions > 0 ? 8 : 2) : 2
              const isCurrent = i === currentBucketIndex
              return (
                <div
                  key={b.key}
                  className="tasks-analytics-v2__chart-bar-col"
                  data-current={isCurrent ? 'true' : 'false'}
                >
                  <div className="tasks-analytics-v2__chart-tooltip">
                    {b.label} · {b.completions} {t('modules.tasks.analytics.completions')}
                  </div>
                  <div className="tasks-analytics-v2__chart-bar-track">
                    <div
                      className="tasks-analytics-v2__chart-bar"
                      data-empty={b.completions === 0 ? 'true' : 'false'}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="tasks-analytics-v2__chart-label">{b.label}</span>
                </div>
              )
            })}
          </div>

          {!hasHistory ? (
            <div className="tasks-analytics-v2__empty">
              <p className="tasks-analytics-v2__empty-title">{t('modules.tasks.analytics.emptyTitle')}</p>
              <p className="tasks-analytics-v2__empty-desc">{t('modules.tasks.analytics.emptyDescription')}</p>
            </div>
          ) : null}
        </article>

        {/* Distribution: Status + Priority side by side */}
        <div className="grid gap-4 md:grid-cols-2">
          <article className="tasks-analytics-v2__card">
            <p className="tasks-analytics-v2__eyebrow">{t('modules.tasks.analytics.statusBreakdown')}</p>
            <h2 className="tasks-analytics-v2__title">{analytics.summary.totalTasks} {t('modules.tasks.analytics.totalTasks')}</h2>

            <div className="tasks-analytics-v2__stack mt-4" aria-hidden="true">
              {statusRows.map((r) => (
                r.percent > 0 ? (
                  <span key={r.key} className="tasks-analytics-v2__stack-seg" style={{ width: `${r.percent}%`, background: r.color }} />
                ) : null
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {statusRows.map((row) => (
                <div key={row.key} className="tasks-analytics-v2__dist-row">
                  <span className="tasks-analytics-v2__dist-label">
                    <span className="tasks-analytics-v2__dist-dot" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="tasks-analytics-v2__dist-meta">
                    <span className="tasks-analytics-v2__dist-count">{row.count}</span>
                    <span className="tasks-analytics-v2__dist-pct">{row.percent}%</span>
                  </span>
                  <span className="tasks-analytics-v2__dist-bar">
                    <span className="tasks-analytics-v2__dist-bar-fill" style={{ width: `${row.percent}%`, background: row.color }} />
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="tasks-analytics-v2__card">
            <p className="tasks-analytics-v2__eyebrow">{t('modules.tasks.analytics.priorityBreakdown')}</p>
            <h2 className="tasks-analytics-v2__title">{analytics.summary.totalTasks} {t('modules.tasks.analytics.totalTasks')}</h2>

            <div className="tasks-analytics-v2__stack mt-4" aria-hidden="true">
              {priorityRows.map((r) => (
                r.percent > 0 ? (
                  <span key={r.key} className="tasks-analytics-v2__stack-seg" style={{ width: `${r.percent}%`, background: r.color }} />
                ) : null
              ))}
            </div>

            <div className="flex flex-col gap-1">
              {priorityRows.map((row) => (
                <div key={row.key} className="tasks-analytics-v2__dist-row">
                  <span className="tasks-analytics-v2__dist-label">
                    <span className="tasks-analytics-v2__dist-dot" style={{ background: row.color }} />
                    {row.label}
                  </span>
                  <span className="tasks-analytics-v2__dist-meta">
                    <span className="tasks-analytics-v2__dist-count">{row.count}</span>
                    <span className="tasks-analytics-v2__dist-pct">{row.percent}%</span>
                  </span>
                  <span className="tasks-analytics-v2__dist-bar">
                    <span className="tasks-analytics-v2__dist-bar-fill" style={{ width: `${row.percent}%`, background: row.color }} />
                  </span>
                </div>
              ))}
            </div>
          </article>
        </div>

        {/* Subtask card */}
        <article className="tasks-analytics-v2__card tasks-analytics-v2__card--paper">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="tasks-analytics-v2__eyebrow">{t('modules.tasks.analytics.subtaskBreakdown')}</p>
              <h2 className="tasks-analytics-v2__title">{t('modules.tasks.analytics.subtaskCompletionRate')}</h2>
            </div>
            <div className="text-right">
              <p className="tasks-analytics-v2__hero-rate" style={{ fontSize: '36px' }}>
                {analytics.summary.subtaskCompletionRate}
                <span className="tasks-analytics-v2__hero-rate-suffix">%</span>
              </p>
              <p className="text-[11px] mt-1 font-variant-numeric tabular-nums" style={{ color: 'var(--ts-ink-soft)' }}>
                {analytics.summary.subtasksCompleted} / {analytics.summary.subtasksTotal}
              </p>
            </div>
          </div>
          <div className="tasks-analytics-v2__subtask-bar">
            <div className="tasks-analytics-v2__subtask-bar-fill" style={{ width: `${analytics.summary.subtaskCompletionRate}%` }} />
          </div>
        </article>
      </div>
    </section>
  )
}

export default TasksAnalyticsView
