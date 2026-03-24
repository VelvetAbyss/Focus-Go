import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckSquare,
  Flame,
  ListChecks,
  Percent,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import { buildTaskAnalytics, type AnalyticsGranularity } from './taskAnalytics'
import { TASK_PRIORITY_CONFIG, TASK_STATUS_CONFIG } from './taskPresentation'
import { useI18n } from '../../../shared/i18n/useI18n'

type TasksAnalyticsViewProps = {
  tasks: TaskItem[]
}

const STORAGE_KEY = 'tasks_analytics_granularity'

const granularityOptions: AnalyticsGranularity[] = ['day', 'week', 'month']
const granularityLabelKeys: Record<AnalyticsGranularity, 'modules.tasks.analytics.day' | 'modules.tasks.analytics.week' | 'modules.tasks.analytics.month'> = {
  day: 'modules.tasks.analytics.day',
  week: 'modules.tasks.analytics.week',
  month: 'modules.tasks.analytics.month',
}

const metricIcons = {
  totalTasks: ListChecks,
  completedTasks: CheckSquare,
  completionRate: Percent,
  subtaskCompletionRate: TrendingUp,
  overdueTasks: AlertTriangle,
  dueSoonTasks: Flame,
} as const

const formatMetricValue = (value: number, type: keyof typeof metricIcons) => {
  if (type === 'completionRate') return `${value}%`
  if (type === 'subtaskCompletionRate') return `${value}%`
  return `${value}`
}

const TasksAnalyticsView = ({ tasks }: TasksAnalyticsViewProps) => {
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
  const maxCompletion = Math.max(...analytics.buckets.map((bucket) => bucket.completions), 0)
  const hasHistory = analytics.buckets.some((bucket) => bucket.completions > 0)
  const trendPeak = Math.max(maxCompletion, 1)
  const trendAverage = analytics.summary.averageCompletions
  const trendHighlights = [
    { label: '峰值', value: maxCompletion },
    { label: '平均', value: trendAverage },
    { label: '总完成', value: analytics.summary.completions },
  ] as const

  const summaryCards = [
    { key: 'totalTasks', label: t('modules.tasks.analytics.totalTasks'), value: analytics.summary.totalTasks },
    { key: 'completedTasks', label: t('modules.tasks.analytics.completedTasks'), value: analytics.summary.completedTasks },
    { key: 'completionRate', label: t('modules.tasks.analytics.completionRate'), value: analytics.summary.completionRate },
    { key: 'subtaskCompletionRate', label: t('modules.tasks.analytics.subtaskCompletionRate'), value: analytics.summary.subtaskCompletionRate },
    { key: 'overdueTasks', label: t('modules.tasks.analytics.overdueTasks'), value: analytics.summary.overdueTasks },
    { key: 'dueSoonTasks', label: t('modules.tasks.analytics.dueSoonTasks'), value: analytics.summary.dueSoonTasks },
  ] as const

  const statusRows = (['todo', 'doing', 'done'] as const).map((status) => {
    const cfg = TASK_STATUS_CONFIG[status]
    const count = analytics.summary.statusCounts[status]
    const total = analytics.summary.totalTasks || 1
    return {
      key: status,
      label: t(`tasks.status.${status}`),
      count,
      percent: Math.round((count / total) * 100),
      dot: cfg.dot,
      badge: cfg.badge,
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
      badge: cfg.badge,
      dot: cfg.dot,
    }
  })

  return (
    <section className="tasks-analytics flex h-full min-h-0 flex-col gap-4">
      <div className="tasks-analytics__toolbar flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-full border border-[#3a3733]/8 bg-white/80 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          {granularityOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
                granularity === option ? 'bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]' : 'text-slate-500 hover:text-slate-900',
              )}
              onClick={() => setGranularity(option)}
            >
              {t(granularityLabelKeys[option])}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-[#3a3733]/8 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <BarChart3 className="size-3.5" />
          {t('modules.tasks.analytics.trendTitle')}
        </div>
      </div>

      <div className="tasks-analytics__scroller flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 pb-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {summaryCards.map((card) => {
            const Icon = metricIcons[card.key]
            return (
              <article key={card.key} className="tasks-analytics__summary-card rounded-[24px] border border-[#3a3733]/6 bg-white/88 p-4">
                <div className="mb-3 inline-flex size-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                  <Icon className="size-4" />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{formatMetricValue(card.value, card.key)}</p>
              </article>
            )
          })}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[0.95fr_1.25fr]">
          <div className="flex flex-col gap-4">
            <article className="rounded-[30px] border border-[#3a3733]/6 bg-white/88 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('modules.tasks.analytics.statusBreakdown')}</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{t('modules.tasks.analytics.activeTasks')}</h2>
                </div>
                <p className="text-xs text-slate-500">{analytics.summary.activeTasks}</p>
              </div>

              <div className="space-y-3">
                {statusRows.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', row.dot)} />
                        <span className="text-sm font-medium text-slate-700">{row.label}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <span>{row.count}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]', row.badge)}>{row.percent}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full', row.dot)} style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[#3a3733]/6 bg-white/88 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('modules.tasks.analytics.priorityBreakdown')}</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{t('modules.tasks.analytics.completedTasks')}</h2>
                </div>
                <p className="text-xs text-slate-500">{analytics.summary.completedTasks}</p>
              </div>

              <div className="space-y-3">
                {priorityRows.map((row) => (
                  <div key={row.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', row.dot)} />
                        <span className="text-sm font-medium text-slate-700">{row.label}</span>
                      </div>
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <span>{row.count}</span>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]', row.badge)}>{row.percent}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={cn('h-full rounded-full', row.dot)} style={{ width: `${row.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[30px] border border-[#3a3733]/6 bg-white/88 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('modules.tasks.analytics.subtaskBreakdown')}</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{t('modules.tasks.analytics.subtaskCompletionRate')}</h2>
                </div>
                <p className="text-xs text-slate-500">{analytics.summary.subtasksCompleted} / {analytics.summary.subtasksTotal}</p>
              </div>

              <div className="rounded-[24px] border border-dashed border-slate-200/90 bg-slate-50/70 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{analytics.summary.subtaskCompletionRate}%</p>
                    <p className="mt-1 text-xs text-slate-500">{t('modules.tasks.analytics.completions')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{t('modules.tasks.analytics.totalTasks')}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{analytics.summary.totalTasks}</p>
                  </div>
                </div>
                <div className="mt-4 h-2 rounded-full bg-white">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#3A3733_0%,#c2410c_100%)]" style={{ width: `${analytics.summary.subtaskCompletionRate}%` }} />
                </div>
              </div>
            </article>
          </div>

          <div className="tasks-analytics__trend-panel min-h-0 rounded-[30px] border border-[#3a3733]/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('modules.tasks.analytics.trendTitle')}</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{t(granularityLabelKeys[granularity])}</h2>
              </div>
              <p className="text-xs text-slate-500">{analytics.buckets.length} buckets</p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              {trendHighlights.map((item) => (
                <div key={item.label} className="rounded-[18px] border border-[#3a3733]/6 bg-white/84 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex min-h-0 flex-col gap-3">
              <div className="tasks-analytics__chart relative flex h-[240px] shrink-0 items-end gap-2 overflow-hidden rounded-[24px] border border-dashed border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.98))] px-3 pb-4 pt-6">
                <div className="pointer-events-none absolute inset-x-3 top-6 bottom-14">
                  {[0.25, 0.5, 0.75].map((ratio) => (
                    <div
                      key={ratio}
                      className="absolute left-0 right-0 border-t border-slate-200/80"
                      style={{ top: `${ratio * 100}%` }}
                    />
                  ))}
                </div>

                {analytics.buckets.map((bucket) => {
                  const height = maxCompletion > 0 ? Math.max((bucket.completions / trendPeak) * 100, bucket.completions > 0 ? 14 : 5) : 5
                  const isActive = bucket.completions > 0
                  return (
                    <div key={bucket.key} className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <div className="text-center leading-tight">
                        <span className="block text-[10px] font-semibold text-slate-500">{bucket.completions}</span>
                        <span className="block text-[9px] text-slate-400">{bucket.created} 新建</span>
                      </div>
                      <div className="relative flex h-[180px] w-full items-end justify-center">
                        <div className="w-[68%] rounded-t-[16px] bg-slate-100/80" style={{ height: '100%' }} />
                        <div
                          className={cn(
                            'absolute bottom-0 w-[68%] rounded-t-[16px] bg-[linear-gradient(180deg,#3A3733_0%,#6b7280_100%)] shadow-[0_12px_24px_rgba(58,55,51,0.18)] transition-[height,opacity] duration-300',
                            !isActive && 'opacity-30',
                          )}
                          style={{ height: `${height}%` }}
                        />
                        {isActive ? (
                          <div
                            className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(58,55,51,0.14)]"
                            style={{ bottom: `calc(${height}% - 4px)` }}
                          />
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 md:grid-cols-4 xl:grid-cols-6">
                {analytics.buckets.map((bucket) => (
                  <div key={bucket.key} className="truncate">
                    {bucket.label}
                  </div>
                ))}
              </div>

              {!hasHistory ? (
                <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center">
                  <p className="text-sm font-medium text-slate-900">{t('modules.tasks.analytics.emptyTitle')}</p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">{t('modules.tasks.analytics.emptyDescription')}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default TasksAnalyticsView
