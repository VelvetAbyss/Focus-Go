import { useCallback, useEffect, useState } from 'react'
import type { FocusSession } from '../../data/models/types'
import { focusRepo } from '../../data/repositories/focusRepo'
import { SYNC_DATA_UPDATED_EVENT } from '../../data/sync/constants'

const FOCUS_TIMER_EVENT = 'focus:timer-updated'
const MAX_STREAK_LOOKBACK_DAYS = 365

export type TodayFocusStats = {
  sessionsToday: number
  completedToday: number
  focusMinutesToday: number
  streakDays: number
  lastCompletedAt: number | null
  recentCompletedTimes: number[]
}

const EMPTY_STATS: TodayFocusStats = {
  sessionsToday: 0,
  completedToday: 0,
  focusMinutesToday: 0,
  streakDays: 0,
  lastCompletedAt: null,
  recentCompletedTimes: [],
}

const startOfLocalDay = (value: number) => {
  const date = new Date(value)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const dayKey = (value: number) => new Date(value).toLocaleDateString('en-CA')

const computeStreak = (completedSessions: FocusSession[]): number => {
  if (completedSessions.length === 0) return 0
  const keys = new Set(
    completedSessions.map((session) => dayKey(session.completedAt ?? session.updatedAt))
  )
  const todayKey = dayKey(Date.now())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = dayKey(yesterday.getTime())

  let offset = 0
  if (!keys.has(todayKey)) {
    if (!keys.has(yesterdayKey)) return 0
    offset = 1
  }

  let streak = 0
  const cursor = new Date()
  for (let i = offset; i < MAX_STREAK_LOOKBACK_DAYS + offset; i++) {
    const day = new Date(cursor)
    day.setDate(cursor.getDate() - i)
    if (keys.has(dayKey(day.getTime()))) {
      streak++
    } else {
      break
    }
  }
  return streak
}

const deriveStats = (sessions: readonly FocusSession[]): TodayFocusStats => {
  const now = Date.now()
  const dayStart = startOfLocalDay(now)
  const dayEnd = dayStart + 24 * 60 * 60 * 1000

  const completed = sessions.filter(
    (session) => session.status === 'completed' && (session.completedAt ?? session.updatedAt)
  )

  const startedToday = sessions.filter((session) => {
    const created = session.createdAt ?? 0
    return created >= dayStart && created < dayEnd
  })

  const completedToday = completed.filter((session) => {
    const when = session.completedAt ?? session.updatedAt
    return when >= dayStart && when < dayEnd
  })

  const focusMinutesToday = completedToday.reduce(
    (sum, session) => sum + (session.actualMinutes ?? session.plannedMinutes ?? 0),
    0
  )

  const recentCompletedTimes = completedToday
    .map((session) => session.completedAt ?? session.updatedAt)
    .sort((a, b) => a - b)

  const lastCompletedAt = completed.length
    ? Math.max(...completed.map((session) => session.completedAt ?? session.updatedAt))
    : null

  return {
    sessionsToday: startedToday.length,
    completedToday: completedToday.length,
    focusMinutesToday: Math.round(focusMinutesToday),
    streakDays: computeStreak(completed),
    lastCompletedAt,
    recentCompletedTimes,
  }
}

export const useTodayFocusStats = (): TodayFocusStats => {
  const [stats, setStats] = useState<TodayFocusStats>(EMPTY_STATS)

  const load = useCallback(async () => {
    try {
      const sessions = await focusRepo.listSessions()
      setStats(deriveStats(sessions ?? []))
    } catch {
      setStats(EMPTY_STATS)
    }
  }, [])

  useEffect(() => {
    void load()
    const onUpdate = () => void load()
    window.addEventListener(FOCUS_TIMER_EVENT, onUpdate)
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, onUpdate)
    return () => {
      window.removeEventListener(FOCUS_TIMER_EVENT, onUpdate)
      window.removeEventListener(SYNC_DATA_UPDATED_EVENT, onUpdate)
    }
  }, [load])

  return stats
}
