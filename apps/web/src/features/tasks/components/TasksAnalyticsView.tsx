import { useEffect, useMemo, useState } from 'react'
import { BarChart3, CalendarCheck2, Flame, Percent, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TaskItem } from '../tasks.types'
import { buildTaskAnalytics, type AnalyticsGranularity } from './taskAnalytics'
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
  completions: CalendarCheck2,
  completionRate: Percent,
  streakDays: Flame,
  averageCompletions: TrendingUp,
} as const

const formatMetricValue = (value: number, type: keyof typeof metricIcons) => {
  if (type === 'completionRate') return `${value}%`
  if (type === 'averageCompletions') return Number.isInteger(value) ? `${value}` : value.toFixed(1)
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

  const summaryCards = [
    { key: 'completions', label: t('modules.tasks.analytics.completions'), value: analytics.summary.completions },
    { key: 'completionRate', label: t('modules.tasks.analytics.completionRate'), value: analytics.summary.completionRate },
    { key: 'streakDays', label: t('modules.tasks.analytics.streakDays'), value: analytics.summary.streakDays },
    { key: 'averageCompletions', label: t('modules.tasks.analytics.averageCompletions'), value: analytics.summary.averageCompletions },
  ] as const

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = metricIcons[card.key]
          return (
            <article key={card.key} className="tasks-analytics__summary-card rounded-[24px] border border-[#3a3733]/6 bg-white/88 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                <Icon className="size-4" />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{formatMetricValue(card.value, card.key)}</p>
            </article>
          )
        })}
      </div>

      <div className="tasks-analytics__trend-panel min-h-0 flex-1 rounded-[30px] border border-[#3a3733]/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-5 shadow-[0_22px_56px_rgba(15,23,42,0.08)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{t('modules.tasks.analytics.trendTitle')}</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">{t(granularityLabelKeys[granularity])}</h2>
          </div>
          <p className="text-xs text-slate-500">{analytics.buckets.length} buckets</p>
        </div>

        <div className="flex h-full min-h-[260px] flex-col">
          <div className="tasks-analytics__chart flex flex-1 items-end gap-2 overflow-hidden rounded-[24px] border border-dashed border-slate-200/90 bg-slate-50/70 px-3 pb-3 pt-6">
            {analytics.buckets.map((bucket) => {
              const height = maxCompletion > 0 ? Math.max((bucket.completions / maxCompletion) * 100, bucket.completions > 0 ? 12 : 4) : 4
              return (
                <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-medium text-slate-400">{bucket.completions}</span>
                  <div
                    className={cn(
                      'w-full rounded-t-[14px] bg-[linear-gradient(180deg,#0f172a_0%,#475569_100%)] transition-[height,opacity] duration-300',
                      bucket.completions === 0 && 'opacity-35',
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500 md:grid-cols-4 xl:grid-cols-6">
            {analytics.buckets.map((bucket) => (
              <div key={bucket.key} className="truncate">
                {bucket.label}
              </div>
            ))}
          </div>

          {!hasHistory ? (
            <div className="mt-4 rounded-[22px] border border-dashed border-slate-200 bg-white/80 px-4 py-5 text-center">
              <p className="text-sm font-medium text-slate-900">{t('modules.tasks.analytics.emptyTitle')}</p>
              <p className="mt-1 text-xs leading-6 text-slate-500">{t('modules.tasks.analytics.emptyDescription')}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export default TasksAnalyticsView
