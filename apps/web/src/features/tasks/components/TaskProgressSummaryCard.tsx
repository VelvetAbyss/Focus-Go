import { Check, Clipboard, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProjectItem } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import Card from '../../../shared/ui/Card'
import type { TaskItem } from '../tasks.types'
import {
  buildTaskProgressSummary,
  type TaskProgressDetailMode,
  type TaskProgressPeriod,
  type TaskProgressSummary,
} from '../domain/taskProgressSummary'

type TaskProgressSummaryCardProps = {
  tasks: readonly TaskItem[]
  projects: readonly ProjectItem[]
  className?: string
  compact?: boolean
  now?: number
}

const Delta = ({ value }: { value: number }) => {
  if (value === 0) return <span className="ml-1.5 text-[11px] font-medium text-[color:var(--text-secondary)]/55">—</span>
  const positive = value > 0
  return (
    <span
      className={[
        'ml-1.5 inline-flex items-baseline gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums',
        positive ? 'bg-[#5A7A62]/12 text-[#3E5A48]' : 'bg-[color:var(--text-secondary)]/10 text-[color:var(--text-secondary)]/80',
      ].join(' ')}
    >
      <span aria-hidden>{positive ? '↑' : '↓'}</span>
      {Math.abs(value)}
    </span>
  )
}

const Stat = ({
  label,
  value,
  delta,
}: {
  label: string
  value: number
  delta?: number
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]/70">
      {label}
    </span>
    <div className="flex items-baseline">
      <span className="text-[22px] font-bold leading-none tabular-nums tracking-tight text-[color:var(--text-primary)]">
        {value}
      </span>
      {delta !== undefined ? <Delta value={delta} /> : null}
    </div>
  </div>
)

const SegmentControl = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  ariaLabel?: string
}) => (
  <div role="tablist" aria-label={ariaLabel} className="header-pill is-compact">
    {options.map((option) => {
      const selected = value === option.value
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={selected}
          className={`header-pill__btn${selected ? ' is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      )
    })}
  </div>
)

type Translator = ReturnType<typeof useI18n>['t']

const ProjectRow = ({
  project,
  mode,
  compact,
  t,
  language,
}: {
  project: TaskProgressSummary['projects'][number]
  mode: TaskProgressDetailMode
  compact?: boolean
  t: Translator
  language: 'en' | 'zh'
}) => {
  const visibleTasks = compact ? project.tasks.slice(0, 2) : project.tasks
  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const dateLabel = new Date(project.latestCompletedAt).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })
  const displayTitle = project.projectId ? project.projectTitle : t('taskRecap.unassigned')

  return (
    <article className="py-3">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: project.projectColor }}
            aria-hidden
          />
          <h4 className="truncate text-[13px] font-semibold leading-tight text-[color:var(--text-primary)]">
            {displayTitle}
          </h4>
        </div>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.1em] tabular-nums text-[color:var(--text-secondary)]/65">
          {dateLabel}
        </span>
      </header>

      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[color:var(--text-secondary)]/80">
        <span className="tabular-nums">
          <span className="font-semibold text-[color:var(--text-primary)]/85">{project.completedTaskCount}</span>{' '}
          {t('taskRecap.row.tasks')}
        </span>
        <span className="text-[color:var(--text-secondary)]/35">·</span>
        <span className="tabular-nums">
          <span className="font-semibold text-[color:var(--text-primary)]/85">{project.completedSubtaskCount}</span>{' '}
          {t('taskRecap.row.subtasks')}
        </span>
        <span className="text-[color:var(--text-secondary)]/35">·</span>
        <span className="tabular-nums font-semibold text-[color:var(--text-primary)]/85">{project.progress}%</span>
      </div>

      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--text-primary)]/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{
            width: `${Math.min(100, Math.max(0, project.progress))}%`,
            background: project.projectColor,
          }}
        />
      </div>

      {visibleTasks.length > 0 ? (
        <ul className="mt-2.5 grid gap-1.5">
          {visibleTasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2">
              <Check className="mt-[3px] size-3 shrink-0 stroke-[2.5] text-[#5A7A62]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] leading-snug text-[color:var(--text-primary)]/90">
                  {task.title}
                </p>
                {mode === 'detailed' ? (
                  <div className="mt-1 grid gap-1">
                    {task.subtasks.length === 0 ? (
                      <p className="text-[11px] text-[color:var(--text-secondary)]/55">
                        {t('taskRecap.row.noSubtaskLog')}
                      </p>
                    ) : (
                      task.subtasks.map((subtask) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-1.5 text-[11px] text-[color:var(--text-secondary)]/80"
                        >
                          <span
                            className="size-1 rounded-full bg-[color:var(--text-secondary)]/40"
                            aria-hidden
                          />
                          <span className="truncate">{subtask.title}</span>
                          {!subtask.precise ? (
                            <span className="shrink-0 text-[10px] text-[color:var(--text-secondary)]/50">
                              {t('taskRecap.row.currentState')}
                            </span>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {compact && project.tasks.length > visibleTasks.length ? (
        <p className="mt-1.5 text-[11px] text-[color:var(--text-secondary)]/65">
          {t('taskRecap.row.more', { count: project.tasks.length - visibleTasks.length })}
        </p>
      ) : null}
    </article>
  )
}

export const TaskProgressSummaryCard = ({ tasks, projects, className, compact, now }: TaskProgressSummaryCardProps) => {
  const { t, language } = useI18n()
  const [period, setPeriod] = useState<TaskProgressPeriod>('week')
  const [mode, setMode] = useState<TaskProgressDetailMode>('compact')
  const [copied, setCopied] = useState(false)
  const summary = useMemo(
    () => buildTaskProgressSummary({ tasks, projects, now, period, mode }),
    [mode, now, period, projects, tasks],
  )
  const visibleProjects = compact ? summary.projects.slice(0, 3) : summary.projects

  const periodOptions = useMemo(
    () => [
      { value: 'week' as const, label: t('taskRecap.period.week') },
      { value: 'month' as const, label: t('taskRecap.period.month') },
    ],
    [t],
  )
  const modeOptions = useMemo(
    () => [
      { value: 'compact' as const, label: t('taskRecap.mode.compact') },
      { value: 'detailed' as const, label: t('taskRecap.mode.detailed') },
    ],
    [t],
  )

  const localizedSummaryLine = t(period === 'week' ? 'taskRecap.summary.week' : 'taskRecap.summary.month', {
    projects: summary.totals.projectCount,
    tasks: summary.totals.completedTaskCount,
    subtasks: summary.totals.completedSubtaskCount,
  })

  const copyReport = async () => {
    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(summary.reportText)
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea')
        textarea.value = summary.reportText
        textarea.setAttribute('readonly', 'true')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card
      eyebrow={t('taskRecap.eyebrow')}
      title={t(period === 'week' ? 'taskRecap.title.week' : 'taskRecap.title.month')}
      className={className}
      data-testid="task-progress-summary-card"
      actions={
        <button
          type="button"
          className={[
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold transition',
            copied
              ? 'bg-[#5A7A62]/12 text-[#3E5A48]'
              : 'border border-[color:var(--border)] bg-white text-[color:var(--text-secondary)] hover:border-[color:var(--text-primary)]/40 hover:text-[color:var(--text-primary)]',
          ].join(' ')}
          aria-label={t('taskRecap.copyAria')}
          title={t('taskRecap.copyAria')}
          onClick={copyReport}
        >
          {copied ? <Check className="size-3" aria-hidden /> : <Clipboard className="size-3" aria-hidden />}
          <span>{copied ? t('taskRecap.copied') : t('taskRecap.copy')}</span>
        </button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <SegmentControl
            value={period}
            options={periodOptions}
            onChange={setPeriod}
            ariaLabel={t('taskRecap.aria.period')}
          />
          <SegmentControl
            value={mode}
            options={modeOptions}
            onChange={setMode}
            ariaLabel={t('taskRecap.aria.mode')}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <p className="text-[13px] leading-[1.6] text-[color:var(--text-secondary)]">
            {localizedSummaryLine}
          </p>

          <div className="mt-3 grid grid-cols-3 divide-x divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] bg-[color:var(--text-primary)]/[0.02]">
            <div className="px-3 py-2.5">
              <Stat label={t('taskRecap.stat.projects')} value={summary.totals.projectCount} />
            </div>
            <div className="px-3 py-2.5">
              <Stat
                label={t('taskRecap.stat.tasks')}
                value={summary.totals.completedTaskCount}
                delta={summary.delta.completedTaskCount}
              />
            </div>
            <div className="px-3 py-2.5">
              <Stat
                label={t('taskRecap.stat.subtasks')}
                value={summary.totals.completedSubtaskCount}
                delta={summary.delta.completedSubtaskCount}
              />
            </div>
          </div>

          {copied ? (
            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-md bg-[#5A7A62]/10 px-3 py-1.5 text-[11px] font-semibold text-[#3E5A48]">
              <Check className="size-3" aria-hidden />
              <span>{t('taskRecap.copyToast')}</span>
            </div>
          ) : null}

          <div className="mt-4 flex items-baseline justify-between">
            <h5 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)]/70">
              {t('taskRecap.byProject')}
            </h5>
            <span className="text-[10px] tabular-nums text-[color:var(--text-secondary)]/55">
              {visibleProjects.length} / {summary.projects.length || 0}
            </span>
          </div>

          {visibleProjects.length === 0 ? (
            <div className="mt-2 flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border)] px-4 text-center">
              <ListChecks className="mb-2 size-5 text-[color:var(--text-secondary)]/45" aria-hidden />
              <p className="text-[12px] font-semibold text-[color:var(--text-primary)]/75">
                {t('taskRecap.empty.title')}
              </p>
              <p className="mt-0.5 text-[11px] text-[color:var(--text-secondary)]/65">
                {t('taskRecap.empty.subtitle')}
              </p>
            </div>
          ) : (
            <div className="mt-1 divide-y divide-[color:var(--border)]">
              {visibleProjects.map((project) => (
                <ProjectRow
                  key={project.projectId ?? '__unassigned'}
                  project={project}
                  mode={mode}
                  compact={compact}
                  t={t}
                  language={language}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}

export default TaskProgressSummaryCard
