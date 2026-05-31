import type { ProjectItem, TaskActivityLog, TaskItem, TaskSubtask } from '../../../data/models/types'

export type TaskProgressPeriod = 'week' | 'month'
export type TaskProgressDetailMode = 'compact' | 'detailed'

export type TaskProgressRange = {
  startAt: number
  endAt: number
  label: string
}

export type TaskProgressSubtaskRecord = {
  id: string
  title: string
  completedAt?: number
  precise: boolean
}

export type TaskProgressTaskRecord = {
  id: string
  title: string
  completedAt: number
  completionEvents: number
  subtasks: TaskProgressSubtaskRecord[]
}

export type TaskProgressProjectSummary = {
  projectId?: string
  projectTitle: string
  projectColor: string
  progress: number
  completedTaskCount: number
  completionEventCount: number
  completedSubtaskCount: number
  preciseSubtaskCount: number
  fallbackSubtaskCount: number
  latestCompletedAt: number
  tasks: TaskProgressTaskRecord[]
}

export type TaskProgressTrendBuckets = {
  /** 7 evenly-partitioned buckets of completed-task counts across the range */
  tasks: number[]
  /** 7 evenly-partitioned buckets of completed-subtask counts across the range */
  subtasks: number[]
}

export type TaskProgressSummary = {
  period: TaskProgressPeriod
  mode: TaskProgressDetailMode
  range: TaskProgressRange
  previousRange: TaskProgressRange
  summaryLine: string
  reportText: string
  totals: {
    projectCount: number
    completedTaskCount: number
    completionEventCount: number
    completedSubtaskCount: number
  }
  previousTotals: {
    completedTaskCount: number
    completionEventCount: number
    completedSubtaskCount: number
  }
  delta: {
    completedTaskCount: number
    completionEventCount: number
    completedSubtaskCount: number
  }
  trend: TaskProgressTrendBuckets
  projects: TaskProgressProjectSummary[]
}

export const TASK_PROGRESS_TREND_BUCKETS = 7

type BuildTaskProgressSummaryInput = {
  tasks: readonly TaskItem[]
  projects: readonly ProjectItem[]
  now?: number
  period: TaskProgressPeriod
  mode?: TaskProgressDetailMode
}

type TaskCompletionEvent = {
  task: TaskItem
  completedAt: number
}

type SubtaskCompletionEvent = {
  task: TaskItem
  subtaskId: string
  subtaskTitle: string
  completedAt: number
}

const UNASSIGNED_PROJECT_TITLE = '未归属'
const UNASSIGNED_PROJECT_COLOR = '#8A8580'
const DAY_MS = 24 * 60 * 60 * 1000

export const isTaskDoneActivityLog = (log: Pick<TaskActivityLog, 'type' | 'message'>) => {
  if (log.type !== 'status') return false
  const message = log.message.trim()
  const normalized = message.toLowerCase()
  return normalized === 'status changed to done' || message === '状态变更为已完成'
}

export const isSubtaskDoneActivityLog = (log: TaskActivityLog) => {
  if (log.type !== 'subtask') return false
  return log.subtaskDone === true || log.message.trim() === '子任务已完成'
}

const startOfLocalDay = (value: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const startOfLocalWeek = (value: number) => {
  const dayStart = startOfLocalDay(value)
  const date = new Date(dayStart)
  const day = date.getDay()
  const mondayOffset = (day + 6) % 7
  return dayStart - mondayOffset * DAY_MS
}

const startOfLocalMonth = (value: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

const addLocalMonths = (value: number, amount: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth() + amount, 1).getTime()
}

const formatRangeLabel = (startAt: number, endAt: number, period: TaskProgressPeriod) => {
  const start = new Date(startAt)
  if (period === 'month') {
    return start.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
  }
  const inclusiveEnd = new Date(endAt - DAY_MS)
  return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${inclusiveEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

export const getTaskProgressRange = (now: number, period: TaskProgressPeriod): TaskProgressRange => {
  const startAt = period === 'week' ? startOfLocalWeek(now) : startOfLocalMonth(now)
  const endAt = period === 'week' ? startAt + 7 * DAY_MS : addLocalMonths(startAt, 1)
  return { startAt, endAt, label: formatRangeLabel(startAt, endAt, period) }
}

const getPreviousRange = (range: TaskProgressRange, period: TaskProgressPeriod): TaskProgressRange => {
  const startAt = period === 'week' ? range.startAt - 7 * DAY_MS : addLocalMonths(range.startAt, -1)
  const endAt = range.startAt
  return { startAt, endAt, label: formatRangeLabel(startAt, endAt, period) }
}

const inRange = (value: number, range: TaskProgressRange) => value >= range.startAt && value < range.endAt

const fallbackTitle = (title: string | undefined, fallback: string) => {
  const trimmed = typeof title === 'string' ? title.trim() : ''
  return trimmed || fallback
}

const getTaskCompletionEvents = (tasks: readonly TaskItem[], range: TaskProgressRange): TaskCompletionEvent[] =>
  tasks.flatMap((task) =>
    task.activityLogs
      .filter(isTaskDoneActivityLog)
      .filter((log) => inRange(log.createdAt, range))
      .map((log) => ({ task, completedAt: log.createdAt })),
  )

const getSubtaskCompletionEvents = (tasks: readonly TaskItem[], range: TaskProgressRange): SubtaskCompletionEvent[] =>
  tasks.flatMap((task) =>
    task.activityLogs
      .filter(isSubtaskDoneActivityLog)
      .filter((log) => inRange(log.createdAt, range))
      .map((log) => ({
        task,
        subtaskId: log.subtaskId ?? '',
        subtaskTitle: fallbackTitle(log.subtaskTitle, '未命名子任务'),
        completedAt: log.createdAt,
      }))
      .filter((event) => event.subtaskId.length > 0),
  )

const dedupeTaskEvents = (events: TaskCompletionEvent[]) => {
  const byTaskId = new Map<string, TaskProgressTaskRecord>()
  for (const event of events) {
    const current = byTaskId.get(event.task.id)
    if (!current) {
      byTaskId.set(event.task.id, {
        id: event.task.id,
        title: fallbackTitle(event.task.title, '未命名任务'),
        completedAt: event.completedAt,
        completionEvents: 1,
        subtasks: [],
      })
      continue
    }
    current.completedAt = Math.max(current.completedAt, event.completedAt)
    current.completionEvents += 1
  }
  return byTaskId
}

const makeSubtaskRecord = (subtask: TaskSubtask, precise: boolean, completedAt?: number): TaskProgressSubtaskRecord => ({
  id: subtask.id,
  title: fallbackTitle(subtask.title, '未命名子任务'),
  completedAt,
  precise,
})

const attachSubtasks = (
  tasksById: Map<string, TaskProgressTaskRecord>,
  tasksBySourceId: Map<string, TaskItem>,
  subtaskEvents: SubtaskCompletionEvent[],
) => {
  const preciseByTaskId = new Map<string, TaskProgressSubtaskRecord[]>()
  for (const event of subtaskEvents) {
    const current = preciseByTaskId.get(event.task.id) ?? []
    if (!current.some((item) => item.id === event.subtaskId)) {
      current.push({
        id: event.subtaskId,
        title: event.subtaskTitle,
        completedAt: event.completedAt,
        precise: true,
      })
    }
    preciseByTaskId.set(event.task.id, current)
  }

  for (const [taskId, record] of tasksById) {
    const precise = preciseByTaskId.get(taskId) ?? []
    if (precise.length > 0) {
      record.subtasks = precise.sort((left, right) => (right.completedAt ?? 0) - (left.completedAt ?? 0))
      continue
    }
    const source = tasksBySourceId.get(taskId)
    record.subtasks = source?.subtasks.filter((subtask) => subtask.done).map((subtask) => makeSubtaskRecord(subtask, false)) ?? []
  }
}

const bucketizeByTime = (timestamps: readonly number[], range: TaskProgressRange): number[] => {
  const buckets = new Array<number>(TASK_PROGRESS_TREND_BUCKETS).fill(0)
  const span = range.endAt - range.startAt
  if (span <= 0) return buckets
  for (const value of timestamps) {
    const ratio = (value - range.startAt) / span
    if (ratio < 0 || ratio >= 1) continue
    const index = Math.min(TASK_PROGRESS_TREND_BUCKETS - 1, Math.floor(ratio * TASK_PROGRESS_TREND_BUCKETS))
    buckets[index] += 1
  }
  return buckets
}

const summarizeRange = (
  tasks: readonly TaskItem[],
  projects: readonly ProjectItem[],
  range: TaskProgressRange,
): Omit<TaskProgressSummary, 'period' | 'mode' | 'range' | 'previousRange' | 'previousTotals' | 'delta' | 'summaryLine' | 'reportText'> => {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const taskCompletionEvents = getTaskCompletionEvents(tasks, range)
  const subtaskCompletionEvents = getSubtaskCompletionEvents(tasks, range)
  const tasksBySourceId = new Map(tasks.map((task) => [task.id, task]))
  const taskRecordsById = dedupeTaskEvents(taskCompletionEvents)
  attachSubtasks(taskRecordsById, tasksBySourceId, subtaskCompletionEvents)

  const projectMap = new Map<string, TaskProgressProjectSummary>()
  for (const taskRecord of taskRecordsById.values()) {
    const task = tasksBySourceId.get(taskRecord.id)
    const project = task?.projectId ? projectById.get(task.projectId) : undefined
    const key = project?.id ?? '__unassigned'
    const current =
      projectMap.get(key) ??
      ({
        projectId: project?.id,
        projectTitle: project ? fallbackTitle(project.title, '未命名项目') : UNASSIGNED_PROJECT_TITLE,
        projectColor: project?.color ?? UNASSIGNED_PROJECT_COLOR,
        progress: project?.progress ?? 0,
        completedTaskCount: 0,
        completionEventCount: 0,
        completedSubtaskCount: 0,
        preciseSubtaskCount: 0,
        fallbackSubtaskCount: 0,
        latestCompletedAt: 0,
        tasks: [],
      } satisfies TaskProgressProjectSummary)

    current.completedTaskCount += 1
    current.completionEventCount += taskRecord.completionEvents
    current.completedSubtaskCount += taskRecord.subtasks.length
    current.preciseSubtaskCount += taskRecord.subtasks.filter((subtask) => subtask.precise).length
    current.fallbackSubtaskCount += taskRecord.subtasks.filter((subtask) => !subtask.precise).length
    current.latestCompletedAt = Math.max(current.latestCompletedAt, taskRecord.completedAt)
    current.tasks.push(taskRecord)
    projectMap.set(key, current)
  }

  const projectsSummary = [...projectMap.values()]
    .map((project) => ({
      ...project,
      tasks: project.tasks.sort((left, right) => right.completedAt - left.completedAt),
    }))
    .sort((left, right) => {
      if (right.completedTaskCount !== left.completedTaskCount) return right.completedTaskCount - left.completedTaskCount
      if (right.completedSubtaskCount !== left.completedSubtaskCount) return right.completedSubtaskCount - left.completedSubtaskCount
      return right.latestCompletedAt - left.latestCompletedAt
    })

  const totals = {
    projectCount: projectsSummary.length,
    completedTaskCount: taskRecordsById.size,
    completionEventCount: taskCompletionEvents.length,
    completedSubtaskCount: projectsSummary.reduce((sum, project) => sum + project.completedSubtaskCount, 0),
  }

  const trend: TaskProgressTrendBuckets = {
    tasks: bucketizeByTime(
      [...taskRecordsById.values()].map((record) => record.completedAt),
      range,
    ),
    subtasks: bucketizeByTime(
      subtaskCompletionEvents.map((event) => event.completedAt),
      range,
    ),
  }

  return {
    totals,
    trend,
    projects: projectsSummary,
  }
}

const periodName = (period: TaskProgressPeriod) => (period === 'week' ? '本周' : '本月')

const buildSummaryLine = (period: TaskProgressPeriod, totals: TaskProgressSummary['totals']) =>
  `${periodName(period)}在 ${totals.projectCount} 个项目推进了 ${totals.completedTaskCount} 个任务，完成 ${totals.completedSubtaskCount} 个子任务。`

const buildReportText = (summary: Pick<TaskProgressSummary, 'period' | 'range' | 'projects' | 'totals'>) => {
  const lines = [`${periodName(summary.period)}成果总结（${summary.range.label}）`, buildSummaryLine(summary.period, summary.totals)]
  if (summary.projects.length === 0) {
    lines.push('- 本周期暂无已完成任务。')
    return lines.join('\n')
  }

  for (const project of summary.projects) {
    lines.push(`- ${project.projectTitle}：完成 ${project.completedTaskCount} 个任务，${project.completedSubtaskCount} 个子任务。`)
    for (const task of project.tasks) {
      const subtasks = task.subtasks.length > 0 ? `（${task.subtasks.map((subtask) => subtask.title).join('、')}）` : ''
      lines.push(`  - ${task.title}${subtasks}`)
    }
  }
  return lines.join('\n')
}

export const buildTaskProgressSummary = ({
  tasks,
  projects,
  now = Date.now(),
  period,
  mode = 'compact',
}: BuildTaskProgressSummaryInput): TaskProgressSummary => {
  const range = getTaskProgressRange(now, period)
  const previousRange = getPreviousRange(range, period)
  const current = summarizeRange(tasks, projects, range)
  const previous = summarizeRange(tasks, projects, previousRange)
  const base = {
    period,
    mode,
    range,
    previousRange,
    totals: current.totals,
    previousTotals: {
      completedTaskCount: previous.totals.completedTaskCount,
      completionEventCount: previous.totals.completionEventCount,
      completedSubtaskCount: previous.totals.completedSubtaskCount,
    },
    delta: {
      completedTaskCount: current.totals.completedTaskCount - previous.totals.completedTaskCount,
      completionEventCount: current.totals.completionEventCount - previous.totals.completionEventCount,
      completedSubtaskCount: current.totals.completedSubtaskCount - previous.totals.completedSubtaskCount,
    },
    trend: current.trend,
    projects: current.projects,
  }

  return {
    ...base,
    summaryLine: buildSummaryLine(period, current.totals),
    reportText: buildReportText(base),
  }
}
