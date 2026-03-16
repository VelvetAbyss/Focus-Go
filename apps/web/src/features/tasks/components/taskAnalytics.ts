import type { TaskItem } from '../tasks.types'

export type AnalyticsGranularity = 'day' | 'week' | 'month'

export type AnalyticsBucket = {
  key: string
  label: string
  startAt: number
  endAt: number
  completions: number
  created: number
}

export type TaskAnalyticsSummary = {
  completions: number
  completionRate: number
  streakDays: number
  averageCompletions: number
}

export type TaskAnalyticsResult = {
  buckets: AnalyticsBucket[]
  summary: TaskAnalyticsSummary
}

type BuildTaskAnalyticsOptions = {
  now?: number
  granularity: AnalyticsGranularity
}

const DONE_MESSAGE = 'status changed to done'
const DAY_MS = 24 * 60 * 60 * 1000

const WINDOW_SIZE: Record<AnalyticsGranularity, number> = {
  day: 14,
  week: 12,
  month: 12,
}

const toUtcDayStart = (value: number) => {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const toUtcWeekStart = (value: number) => {
  const date = new Date(toUtcDayStart(value))
  const day = date.getUTCDay()
  const offset = (day + 6) % 7
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - offset)
}

const toUtcMonthStart = (value: number) => {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

const addUtcDays = (value: number, amount: number) => value + amount * DAY_MS

const addUtcMonths = (value: number, amount: number) => {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)
}

const getBucketRange = (value: number, granularity: AnalyticsGranularity) => {
  if (granularity === 'day') {
    const startAt = toUtcDayStart(value)
    return { startAt, endAt: addUtcDays(startAt, 1) }
  }
  if (granularity === 'week') {
    const startAt = toUtcWeekStart(value)
    return { startAt, endAt: addUtcDays(startAt, 7) }
  }
  const startAt = toUtcMonthStart(value)
  return { startAt, endAt: addUtcMonths(startAt, 1) }
}

const shiftBucketStart = (value: number, granularity: AnalyticsGranularity, amount: number) => {
  if (granularity === 'day') return addUtcDays(value, amount)
  if (granularity === 'week') return addUtcDays(value, amount * 7)
  return addUtcMonths(value, amount)
}

const formatBucketLabel = (startAt: number, granularity: AnalyticsGranularity) => {
  const date = new Date(startAt)
  if (granularity === 'day') {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  if (granularity === 'week') {
    const end = new Date(addUtcDays(startAt, 6))
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })} - ${end.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' })}`
  }
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const extractCompletionEvents = (tasks: TaskItem[]) =>
  tasks.flatMap((task) =>
    task.activityLogs
      .filter((log) => log.type === 'status' && log.message.toLowerCase() === DONE_MESSAGE)
      .map((log) => ({
        taskId: task.id,
        createdAt: log.createdAt,
      })),
  )

const computeStreakDays = (completionEvents: Array<{ createdAt: number }>, now: number) => {
  const completionDays = new Set(completionEvents.map((event) => toUtcDayStart(event.createdAt)))
  let streak = 0
  let cursor = toUtcDayStart(now)
  while (completionDays.has(cursor)) {
    streak += 1
    cursor = addUtcDays(cursor, -1)
  }
  return streak
}

const roundTo = (value: number, digits: number) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const buildTaskAnalytics = (tasks: TaskItem[], { now = Date.now(), granularity }: BuildTaskAnalyticsOptions): TaskAnalyticsResult => {
  const currentRange = getBucketRange(now, granularity)
  const totalBuckets = WINDOW_SIZE[granularity]
  const firstBucketStart = shiftBucketStart(currentRange.startAt, granularity, -(totalBuckets - 1))
  const buckets: AnalyticsBucket[] = Array.from({ length: totalBuckets }, (_, index) => {
    const startAt = shiftBucketStart(firstBucketStart, granularity, index)
    return {
      key: `${granularity}-${startAt}`,
      label: formatBucketLabel(startAt, granularity),
      startAt,
      endAt: getBucketRange(startAt, granularity).endAt,
      completions: 0,
      created: 0,
    }
  })

  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket.startAt, index]))
  const completionEvents = extractCompletionEvents(tasks)

  completionEvents.forEach((event) => {
    const { startAt } = getBucketRange(event.createdAt, granularity)
    const index = bucketIndex.get(startAt)
    if (index == null) return
    buckets[index]!.completions += 1
  })

  tasks.forEach((task) => {
    const { startAt } = getBucketRange(task.createdAt, granularity)
    const index = bucketIndex.get(startAt)
    if (index == null) return
    buckets[index]!.created += 1
  })

  const completions = buckets.reduce((sum, bucket) => sum + bucket.completions, 0)
  const created = buckets.reduce((sum, bucket) => sum + bucket.created, 0)
  const completionRate = created > 0 ? roundTo((completions / created) * 100, 0) : 0
  const averageCompletions = buckets.length > 0 ? roundTo(buckets.reduce((sum, bucket) => sum + bucket.completions, 0) / buckets.length, 1) : 0

  return {
    buckets,
    summary: {
      completions,
      completionRate,
      streakDays: computeStreakDays(completionEvents, now),
      averageCompletions,
    },
  }
}
