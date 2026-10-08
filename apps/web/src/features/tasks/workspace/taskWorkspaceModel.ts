import type { FocusSession, TaskItem } from '../../../data/models/types'
import { isTaskClosed, isTaskFollowUpDue, isTaskOverdue, rankNextActionTask, toLocalDayStart } from '../domain/taskRules'
import { isTaskDoneActivityLog } from '../domain/taskProgressSummary'

export type ReviewPeriod = 'day' | 'week' | 'month'
export type ReviewRange = { start: number; end: number }
export const localDateKey = (timestamp: number) => {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export const reviewRange = (period: ReviewPeriod, offset = 0, now = Date.now()): ReviewRange => {
  const date = new Date(toLocalDayStart(now))
  if (period === 'week') date.setDate(date.getDate() - (date.getDay() + 6) % 7 + offset * 7)
  else if (period === 'month') date.setFullYear(date.getFullYear(), date.getMonth() + offset, 1)
  else date.setDate(date.getDate() + offset)
  const end = new Date(date)
  if (period === 'month') end.setMonth(end.getMonth() + 1)
  else end.setDate(end.getDate() + (period === 'week' ? 7 : 1))
  return { start: date.getTime(), end: end.getTime() }
}
export const isWithin = (timestamp: number | undefined, range: ReviewRange): timestamp is number =>
  typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= range.start && timestamp < range.end

/** A done status is not a timestamp. Only actual completion logs establish when work finished. */
export const completionRecords = (tasks: readonly TaskItem[], range: ReviewRange) => tasks.flatMap(task => {
  // Reopening/undo within the same period withdraws that result. Later reopening
  // does not rewrite an earlier period's outcome. Array order resolves equal timestamps.
  const transitions = (task.activityLogs ?? []).map((log,index)=>({log,index}))
    .filter(({log})=>log.type==='status' && Number.isFinite(log.createdAt) && log.createdAt<range.end
      && (isTaskDoneActivityLog(log) || /^(status changed to|状态变更为)/i.test(log.message.trim())))
    .sort((a,b)=>a.log.createdAt-b.log.createdAt || a.index-b.index)
  const last = transitions.at(-1)?.log
  return last && isTaskDoneActivityLog(last) && isWithin(last.createdAt,range) ? [{task,completedAt:last.createdAt}] : []
}).sort((a,b)=>b.completedAt-a.completedAt)

/** Resolved dependencies stop blocking. Missing or dropped dependencies remain unresolved. */
export const unresolvedDependencies = (task: TaskItem, tasks: readonly TaskItem[]) => {
  const byId = new Map(tasks.map(item => [item.id, item]))
  return [...new Set([...(task.blockedByTaskIds ?? []), ...(task.dependencyTaskIds ?? [])])].filter(id => byId.get(id)?.status !== 'done')
}
export const blockedForExecution = (task: TaskItem, tasks: readonly TaskItem[]) =>
  task.isBlocked === true || unresolvedDependencies(task, tasks).length > 0

export const buildTodayPlan = (tasks: readonly TaskItem[], allTasks = tasks, now = Date.now()) => {
  const planned = tasks.filter(task => task.isToday && !isTaskClosed(task) && task.status !== 'waiting')
  const order = (items: TaskItem[]) => items.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || rankNextActionTask(a, b))
  const doing = order(planned.filter(task => task.status === 'doing' && !blockedForExecution(task, allTasks)))
  const ready = order(planned.filter(task => task.status === 'todo' && !blockedForExecution(task, allTasks)))
  const blocked = order(planned.filter(task => (task.status === 'todo' || task.status === 'doing') && blockedForExecution(task, allTasks)))
  const verify = order(planned.filter(task => task.status === 'verify'))
  const completed = completionRecords(tasks, reviewRange('day', 0, now)).filter(record => record.task.status === 'done')
  const candidates = order(tasks.filter(task => !task.isToday && (task.status === 'todo' || task.status === 'doing')))
  const followUps = order(tasks.filter(task => task.status === 'waiting' && (task.isToday || isTaskFollowUpDue(task, now))))
  return { doing, ready, blocked, verify, completed, candidates, followUps, next: doing[0] ?? ready[0] ?? null, plannedCount: planned.length }
}

export const buildTaskReview = (tasks: readonly TaskItem[], sessions: readonly FocusSession[], range: ReviewRange, now = Date.now(), allTasks = tasks) => {
  const records = completionRecords(tasks, range)
  const finishedSessions = sessions.filter(session => session.status === 'completed' && isWithin(session.completedAt, range))
  const measured = finishedSessions.filter(session => typeof session.actualMinutes === 'number' && Number.isFinite(session.actualMinutes) && session.actualMinutes >= 0)
  const minutes = measured.reduce((sum, session) => sum + session.actualMinutes!, 0)
  const days: { key: string; at: number; completed: number; minutes: number }[] = []
  for (let date = new Date(range.start); date.getTime() < range.end; date.setDate(date.getDate() + 1)) {
    const key = localDateKey(date.getTime())
    days.push({ key, at: date.getTime(), completed: records.filter(record => localDateKey(record.completedAt) === key).length,
      minutes: measured.filter(session => localDateKey(session.completedAt!) === key).reduce((sum, session) => sum + session.actualMinutes!, 0) })
  }
  return {
    records, sessions: finishedSessions, minutes, days,
    unmeasuredSessions: finishedSessions.length - measured.length,
    undatedFocusSessions: sessions.filter(session => session.status === 'completed' && (typeof session.completedAt !== 'number' || !Number.isFinite(session.completedAt))).length,
    undatedCompletions: tasks.filter(task => task.status === 'done' && !(task.activityLogs ?? []).some(isTaskDoneActivityLog)),
    created: tasks.filter(task => isWithin(task.createdAt, range)).length,
    doing: tasks.filter(task => task.status === 'doing'),
    blocked: tasks.filter(task => !isTaskClosed(task) && blockedForExecution(task, allTasks)),
    followUps: tasks.filter(task => isTaskFollowUpDue(task, now)),
    verify: tasks.filter(task => task.status === 'verify'),
    overdue: tasks.filter(task => isTaskOverdue(task, now)),
  }
}
