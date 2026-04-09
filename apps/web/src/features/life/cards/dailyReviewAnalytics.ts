import type { DiaryEntry, FocusSession, NoteItem, TaskItem } from '../../../data/models/types'
import { toDateKey } from '../../../shared/utils/time'

export type DailyReviewGranularity = 'today' | 'week' | 'month'

export type DailyReviewTaskRecord = {
  id: string
  title: string
  completedAt: number
  subtasks: TaskItem['subtasks']
}

export type DailyReviewSummary = {
  completedTasks: number
  completedSubtasks: number
  focusMinutes: number
  diaryWritten: boolean
  noteChars: number
  focusPresenceMinutes: number
}

export type DailyReviewAnalytics = {
  summary: DailyReviewSummary
  completedTasks: DailyReviewTaskRecord[]
}

type BuildDailyReviewAnalyticsInput = {
  tasks: readonly TaskItem[]
  sessions: readonly FocusSession[]
  diaries: readonly DiaryEntry[]
  notes: readonly NoteItem[]
  now?: number
  granularity: DailyReviewGranularity
}

const DAY_MS = 24 * 60 * 60 * 1000

const isDoneStatusLog = (message: string) => {
  const normalized = message.trim().toLowerCase()
  return normalized === 'status changed to done' || message.trim() === '状态变更为已完成'
}

const startOfLocalDay = (value: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const getRangeStart = (now: number, granularity: DailyReviewGranularity) => {
  const dayStart = startOfLocalDay(now)
  if (granularity === 'today') return dayStart
  if (granularity === 'week') return dayStart - DAY_MS * 6
  return dayStart - DAY_MS * 29
}

const getRangeEnd = (now: number) => startOfLocalDay(now) + DAY_MS

const inRange = (value: number, start: number, end: number) => value >= start && value < end

export const buildDailyReviewAnalytics = ({
  tasks,
  sessions,
  diaries,
  notes,
  now = Date.now(),
  granularity,
}: BuildDailyReviewAnalyticsInput): DailyReviewAnalytics => {
  const rangeStart = getRangeStart(now, granularity)
  const rangeEnd = getRangeEnd(now)
  const completedTaskRecords = tasks
    .map((task) => {
      const completedAt = task.activityLogs
        .filter((log) => log.type === 'status' && isDoneStatusLog(log.message))
        .map((log) => log.createdAt)
        .find((createdAt) => inRange(createdAt, rangeStart, rangeEnd))
      if (!completedAt) return null
      return {
        id: task.id,
        title: task.title,
        completedAt,
        subtasks: task.subtasks,
      }
    })
    .filter((task): task is DailyReviewTaskRecord => Boolean(task))
    .sort((a, b) => b.completedAt - a.completedAt)

  const focusMinutes = sessions
    .filter((session) => session.status === 'completed' && session.completedAt && inRange(session.completedAt, rangeStart, rangeEnd))
    .reduce((sum, session) => sum + (session.actualMinutes ?? session.plannedMinutes), 0)

  const diaryWritten =
    granularity === 'today'
      ? diaries.some((entry) => !entry.deletedAt && entry.dateKey === toDateKey(new Date(now)))
      : diaries.some((entry) => !entry.deletedAt && inRange(entry.entryAt, rangeStart, rangeEnd))

  const noteChars = notes
    .filter((note) => !note.deletedAt && inRange(note.updatedAt, rangeStart, rangeEnd))
    .reduce((sum, note) => sum + note.charCount, 0)

  return {
    summary: {
      completedTasks: completedTaskRecords.length,
      completedSubtasks: completedTaskRecords.reduce((sum, task) => sum + task.subtasks.filter((item) => item.done).length, 0),
      focusMinutes,
      diaryWritten,
      noteChars,
      focusPresenceMinutes: focusMinutes,
    },
    completedTasks: completedTaskRecords,
  }
}
