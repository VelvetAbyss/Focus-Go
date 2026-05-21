import { Check, Clipboard, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProjectItem } from '../../../data/models/types'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { TaskItem } from '../tasks.types'
import {
  buildTaskProgressSummary,
  type TaskProgressDetailMode,
  type TaskProgressPeriod,
  type TaskProgressSummary,
} from '../domain/taskProgressSummary'
import './TaskProgressSummaryCard.css'

type TaskProgressSummaryCardProps = {
  tasks: readonly TaskItem[]
  projects: readonly ProjectItem[]
  className?: string
  compact?: boolean
  now?: number
}

type TrendDirection = 'up' | 'down' | 'flat'

const directionFromDelta = (delta?: number): TrendDirection => {
  if (delta === undefined || delta === 0) return 'flat'
  return delta > 0 ? 'up' : 'down'
}

const formatTwoDigit = (value: number) => (value < 10 ? `0${value}` : `${value}`)

const formatDelta = (value?: number) => {
  if (value === undefined || value === 0) return '—'
  const arrow = value > 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(value)}`
}

const TrendBars = ({ values }: { values: readonly number[] }) => {
  const max = Math.max(1, ...values)
  return (
    <span className="recap-card__bars" aria-hidden>
      {values.map((value, index) => {
        const ratio = max === 0 ? 0 : value / max
        const height = Math.max(8, Math.round(ratio * 100)) // floor at 8% so empty days are visible
        return <i key={index} style={{ height: `${height}%` }} />
      })}
    </span>
  )
}

const Stat = ({
  label,
  value,
  delta,
  trendValues,
  direction,
}: {
  label: string
  value: number
  delta?: number
  trendValues?: readonly number[]
  direction: TrendDirection
}) => (
  <div className={`recap-card__stat recap-card__stat--${direction}`}>
    <div className="recap-card__stat-label">{label}</div>
    <div className="recap-card__stat-num">{formatTwoDigit(value)}</div>
    <div className="recap-card__stat-trend">
      {trendValues ? (
        <TrendBars values={trendValues} />
      ) : (
        <span className="recap-card__bars" aria-hidden>
          {Array.from({ length: 7 }).map((_, index) => (
            <i key={index} style={{ height: '40%', opacity: 0.4 }} />
          ))}
        </span>
      )}
      <span className="recap-card__delta">{formatDelta(delta)}</span>
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
  const clampedPct = Math.min(100, Math.max(0, project.progress))

  return (
    <article className="recap-card__row">
      <header className="recap-card__row-head">
        <span
          className="recap-card__row-tag"
          style={{ background: project.projectColor }}
          aria-hidden
        />
        <h4 className="recap-card__row-name" title={displayTitle}>
          {displayTitle}
        </h4>
        <span className="recap-card__row-date">{dateLabel}</span>
      </header>

      <div className="recap-card__row-meta">
        <span>
          <b>{project.completedTaskCount}</b> {t('taskRecap.row.tasks')}
        </span>
        <span className="sep" />
        <span>
          <b>{project.completedSubtaskCount}</b> {t('taskRecap.row.subtasks')}
        </span>
        <span className="recap-card__row-pct">
          <span className="recap-card__pctbar">
            <i style={{ width: `${clampedPct}%` }} />
          </span>
          <b>{project.progress}%</b>
        </span>
      </div>

      {visibleTasks.length > 0 ? (
        <ul className="recap-card__row-tasks">
          {visibleTasks.map((task) => (
            <li key={task.id} className="recap-card__row-task">
              <Check className="recap-card__row-task-check" strokeWidth={2.5} aria-hidden />
              <div className="recap-card__row-task-body">
                <p className="recap-card__row-task-title">{task.title}</p>
                {mode === 'detailed' ? (
                  <div className="recap-card__row-subtasks">
                    {task.subtasks.length === 0 ? (
                      <p className="recap-card__row-subtask-tag">
                        {t('taskRecap.row.noSubtaskLog')}
                      </p>
                    ) : (
                      task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="recap-card__row-subtask">
                          <span className="recap-card__row-subtask-dot" aria-hidden />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subtask.title}
                          </span>
                          {!subtask.precise ? (
                            <span className="recap-card__row-subtask-tag">
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
        <p className="recap-card__row-more">
          {t('taskRecap.row.more', { count: project.tasks.length - visibleTasks.length })}
        </p>
      ) : null}
    </article>
  )
}

const getIsoWeek = (date: Date) => {
  const target = new Date(date.valueOf())
  const dayNumber = (date.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNumber + 3)
  const firstThursday = target.valueOf()
  target.setMonth(0, 1)
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / (7 * 24 * 60 * 60 * 1000))
}

const formatIssueLabel = (date: Date, period: TaskProgressPeriod, language: 'en' | 'zh') => {
  if (period === 'week') {
    const wk = formatTwoDigit(getIsoWeek(date))
    const yr = `${date.getFullYear()}`.slice(-2)
    return language === 'zh' ? `第 ${wk} 周 · ’${yr}` : `WK ${wk} · ’${yr}`
  }
  const monthLabel = date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: language === 'zh' ? 'long' : 'short',
  })
  return monthLabel
}

const formatFiledTime = (timestamp: number) => {
  const d = new Date(timestamp)
  const hh = formatTwoDigit(d.getHours())
  const mm = formatTwoDigit(d.getMinutes())
  return `${hh}:${mm}`
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

  const headlineText = t(period === 'week' ? 'taskRecap.title.week' : 'taskRecap.title.month')
  // The last token of the headline (e.g. "week" / "本周") is italicized in rust.
  // Simple split heuristic: emphasize the trailing word; fall back to whole headline.
  const headlineParts = (() => {
    const trimmed = headlineText.trim()
    const lastSpace = trimmed.lastIndexOf(' ')
    if (lastSpace > 0) {
      return { lead: trimmed.slice(0, lastSpace), accent: trimmed.slice(lastSpace + 1) }
    }
    // Chinese fallback: emphasize last 2 chars
    if (trimmed.length > 2) {
      return { lead: trimmed.slice(0, trimmed.length - 2), accent: trimmed.slice(-2) }
    }
    return { lead: '', accent: trimmed }
  })()

  const tasksDirection = directionFromDelta(summary.delta.completedTaskCount)
  const subtasksDirection = directionFromDelta(summary.delta.completedSubtaskCount)

  const issueDate = new Date(summary.range.startAt)
  const filedTs = Math.min(now ?? Date.now(), summary.range.endAt - 1)

  return (
    <section
      className={`card recap-card ${className ?? ''}`}
      data-testid="task-progress-summary-card"
    >
      <div className="recap-card__body">
        <header className="recap-card__masthead">
          <div>
            <span className="recap-card__kicker">
              <span className="recap-card__kicker-dot" aria-hidden />
              {t('taskRecap.eyebrow')}
              <span className="recap-card__kicker-wk">
                — {formatIssueLabel(issueDate, period, language)}
              </span>
            </span>
            <h1 className="recap-card__headline">
              {headlineParts.lead}
              {headlineParts.lead ? ' ' : ''}
              <em>{headlineParts.accent}</em>
            </h1>
          </div>
          <button
            type="button"
            className={`recap-card__copy${copied ? ' is-copied' : ''}`}
            aria-label={t('taskRecap.copyAria')}
            title={t('taskRecap.copyAria')}
            onClick={copyReport}
          >
            {copied ? <Check aria-hidden /> : <Clipboard aria-hidden />}
            <span>{copied ? t('taskRecap.copied') : t('taskRecap.copy')}</span>
          </button>
        </header>

        <div className="recap-card__controls">
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

        <div className="recap-card__rule" role="presentation" />

        <div className="recap-card__scroll">
          <div className="recap-card__stats" aria-label={t('taskRecap.eyebrow')}>
            <Stat
              label={t('taskRecap.stat.projects')}
              value={summary.totals.projectCount}
              direction="flat"
            />
            <Stat
              label={t('taskRecap.stat.tasks')}
              value={summary.totals.completedTaskCount}
              delta={summary.delta.completedTaskCount}
              trendValues={summary.trend.tasks}
              direction={tasksDirection}
            />
            <Stat
              label={t('taskRecap.stat.subtasks')}
              value={summary.totals.completedSubtaskCount}
              delta={summary.delta.completedSubtaskCount}
              trendValues={summary.trend.subtasks}
              direction={subtasksDirection}
            />
          </div>

          {copied ? (
            <div className="recap-card__toast">
              <Check size={12} aria-hidden />
              <span>{t('taskRecap.copyToast')}</span>
            </div>
          ) : null}

          <div className="recap-card__by-project">
            <div className="recap-card__bp-head">
              <span className="recap-card__bp-eyebrow">{t('taskRecap.byProject')}</span>
              <span className="recap-card__bp-count">
                {formatTwoDigit(visibleProjects.length)} / {formatTwoDigit(summary.projects.length || 0)}
              </span>
            </div>

            {visibleProjects.length === 0 ? (
              <div className="recap-card__empty">
                <ListChecks className="recap-card__empty-icon" size={20} aria-hidden />
                <p className="recap-card__empty-title">{t('taskRecap.empty.title')}</p>
                <p className="recap-card__empty-sub">{t('taskRecap.empty.subtitle')}</p>
              </div>
            ) : (
              <div>
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

        <footer className="recap-card__footer">
          <span>
            {language === 'zh' ? '期号' : 'Issue'} {formatIssueLabel(issueDate, period, language)}
          </span>
          <span className="recap-card__stamp">
            {language === 'zh' ? '存档' : 'Filed'} {formatFiledTime(filedTs)}
          </span>
        </footer>
      </div>
    </section>
  )
}

export default TaskProgressSummaryCard
