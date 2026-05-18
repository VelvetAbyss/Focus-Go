import { CheckCircle2, Clipboard, FolderKanban, ListChecks } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ProjectItem } from '../../../data/models/types'
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

const periodOptions: Array<{ value: TaskProgressPeriod; label: string }> = [
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

const modeOptions: Array<{ value: TaskProgressDetailMode; label: string }> = [
  { value: 'compact', label: '精简' },
  { value: 'detailed', label: '详细' },
]

const formatDelta = (value: number) => {
  if (value > 0) return `+${value}`
  return String(value)
}

const formatDateTime = (value: number) =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const StatPill = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-[18px] border border-[#3A3733]/10 bg-white/62 px-3 py-2">
    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3A3733]/45">{label}</p>
    <p className="mt-1 text-lg font-semibold leading-none text-[#3A3733]">{value}</p>
  </div>
)

const SegmentControl = <T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) => (
  <div className="inline-flex rounded-full border border-[#3A3733]/10 bg-[#3A3733]/5 p-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={[
          'rounded-full px-3 py-1 text-[11px] font-semibold transition',
          value === option.value ? 'bg-[#3A3733] text-[#F5F3F0]' : 'text-[#3A3733]/58 hover:text-[#3A3733]',
        ].join(' ')}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
)

const ProjectRow = ({
  project,
  mode,
  compact,
}: {
  project: TaskProgressSummary['projects'][number]
  mode: TaskProgressDetailMode
  compact?: boolean
}) => {
  const visibleTasks = compact ? project.tasks.slice(0, 2) : project.tasks
  return (
    <article className="rounded-[18px] border border-[#3A3733]/9 bg-white/68 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: project.projectColor }} />
            <h3 className="truncate text-sm font-semibold text-[#3A3733]">{project.projectTitle}</h3>
          </div>
          <p className="mt-1 text-[11px] text-[#3A3733]/52">
            {project.completedTaskCount} tasks · {project.completedSubtaskCount} subtasks · progress {project.progress}%
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#3A3733]/6 px-2 py-1 text-[10px] font-semibold text-[#3A3733]/58">
          {formatDateTime(project.latestCompletedAt)}
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {visibleTasks.map((task) => (
          <div key={task.id} className="rounded-[14px] border border-[#3A3733]/7 bg-[#F5F3F0]/72 px-3 py-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#5A7A62]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#3A3733]">{task.title}</p>
                {mode === 'detailed' ? (
                  <div className="mt-1 grid gap-1">
                    {task.subtasks.length === 0 ? (
                      <p className="text-[11px] text-[#3A3733]/42">没有子任务记录</p>
                    ) : (
                      task.subtasks.map((subtask) => (
                        <div key={subtask.id} className="flex items-center gap-2 text-[11px] text-[#3A3733]/62">
                          <span className="size-1.5 rounded-full bg-[#3A3733]/28" />
                          <span className="truncate">{subtask.title}</span>
                          {!subtask.precise ? <span className="shrink-0 text-[#3A3733]/38">当前状态</span> : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {compact && project.tasks.length > visibleTasks.length ? (
          <p className="px-1 text-[11px] text-[#3A3733]/45">还有 {project.tasks.length - visibleTasks.length} 个任务</p>
        ) : null}
      </div>
    </article>
  )
}

export const TaskProgressSummaryCard = ({ tasks, projects, className, compact, now }: TaskProgressSummaryCardProps) => {
  const [period, setPeriod] = useState<TaskProgressPeriod>('week')
  const [mode, setMode] = useState<TaskProgressDetailMode>('compact')
  const [copied, setCopied] = useState(false)
  const summary = useMemo(
    () => buildTaskProgressSummary({ tasks, projects, now, period, mode }),
    [mode, now, period, projects, tasks],
  )
  const visibleProjects = compact ? summary.projects.slice(0, 3) : summary.projects

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
    <section
      className={[
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#3A3733]/10 bg-[#F5F3F0] text-[#3A3733] shadow-[0_18px_48px_rgba(58,55,51,0.08)]',
        className ?? '',
      ].join(' ')}
      data-testid="task-progress-summary-card"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#3A3733]/8 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#3A3733]/45">
            <FolderKanban className="size-3" />
            <span>成果总结</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#3A3733]">{period === 'week' ? '本周成果' : '本月成果'}</h2>
        </div>
        <button
          type="button"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#3A3733]/10 bg-white/64 text-[#3A3733] transition hover:bg-white"
          aria-label="复制周报月报文本"
          title="复制周报月报文本"
          onClick={copyReport}
        >
          <Clipboard className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <SegmentControl value={period} options={periodOptions} onChange={setPeriod} />
        <SegmentControl value={mode} options={modeOptions} onChange={setMode} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <p className="rounded-[18px] border border-[#3A3733]/8 bg-white/58 px-3 py-3 text-sm leading-6 text-[#3A3733]/78">
          {summary.summaryLine}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <StatPill label="项目" value={summary.totals.projectCount} />
          <StatPill label="任务" value={`${summary.totals.completedTaskCount} (${formatDelta(summary.delta.completedTaskCount)})`} />
          <StatPill label="子任务" value={`${summary.totals.completedSubtaskCount} (${formatDelta(summary.delta.completedSubtaskCount)})`} />
        </div>

        {copied ? (
          <div className="mt-3 rounded-full bg-[#5A7A62]/12 px-3 py-2 text-center text-[11px] font-semibold text-[#4E6E58]">
            已复制周报/月报文本
          </div>
        ) : null}

        <div className="mt-3 grid gap-3">
          {visibleProjects.length === 0 ? (
            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#3A3733]/12 bg-white/42 px-4 text-center">
              <ListChecks className="mb-3 size-6 text-[#3A3733]/28" />
              <p className="text-sm font-semibold text-[#3A3733]/60">本周期还没有完成记录</p>
              <p className="mt-1 text-xs text-[#3A3733]/42">完成任务后，这里会自动按项目整理进展。</p>
            </div>
          ) : (
            visibleProjects.map((project) => (
              <ProjectRow key={project.projectId ?? '__unassigned'} project={project} mode={mode} compact={compact} />
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default TaskProgressSummaryCard
