import type { Habit, HabitLog, HabitType } from '../../../data/models/types'
import { dbService } from '../../../data/services/dbService'
import { CURRENT_USER_ID } from '../../labs/labsApi'
import { calculateStreak } from './streak'

export type HabitDraft = {
  title: string
  type: HabitType
  color: string
  target?: number
  freezesAllowed: number
}

export const HABIT_COLORS = ['#7edbc7', '#7ab8ff', '#f2a65a', '#e88dd8', '#c3f27f', '#f28482'] as const

export const listHabits = (archived = false) => dbService.habits.listHabits(CURRENT_USER_ID, { archived })

export const createHabit = (draft: HabitDraft) => {
  return dbService.habits.createHabit({
    userId: CURRENT_USER_ID,
    title: draft.title,
    type: draft.type,
    color: draft.color,
    target: draft.type === 'boolean' ? undefined : Math.max(1, Math.round(draft.target ?? 1)),
    archived: false,
    freezesAllowed: Math.max(0, Math.round(draft.freezesAllowed)),
    sortOrder: 0,
  })
}

export const updateHabit = (habitId: string, draft: Partial<HabitDraft>) => {
  const patch: Partial<Habit> = {}
  if (typeof draft.title === 'string') patch.title = draft.title
  if (typeof draft.color === 'string') patch.color = draft.color
  if (typeof draft.type === 'string') patch.type = draft.type
  if (typeof draft.freezesAllowed === 'number') patch.freezesAllowed = Math.max(0, Math.round(draft.freezesAllowed))
  if (typeof draft.target === 'number') patch.target = Math.max(1, Math.round(draft.target))
  return dbService.habits.updateHabit(habitId, patch)
}

export const archiveHabit = (habitId: string) => dbService.habits.archiveHabit(habitId)
export const restoreHabit = (habitId: string) => dbService.habits.restoreHabit(habitId)

export const reorderHabits = (orderedIds: string[]) => dbService.habits.reorderHabits(CURRENT_USER_ID, orderedIds)

export const completeHabit = (habit: Habit, dateKey: string, value?: number) => {
  const nextValue =
    typeof value === 'number' ? Math.max(1, Math.round(value)) : habit.type === 'boolean' ? undefined : Math.max(1, Math.round(habit.target ?? 1))
  return dbService.habits.recordHabitCompletion(habit.id, dateKey, nextValue)
}

export const undoHabit = (habitId: string, dateKey: string) => dbService.habits.undoHabitCompletion(habitId, dateKey)

export const listHabitLogs = (habitId: string) => dbService.habits.listHabitLogs(habitId)

export const getDailyProgress = (dateKey: string) => dbService.habits.getDailyProgress(CURRENT_USER_ID, dateKey)

export const getHeatmap = (days: number) => dbService.habits.getHeatmap(CURRENT_USER_ID, days)

export const getStreak = async (habitId: string, dateKey: string) => {
  const [habit, logs] = await Promise.all([dbService.habits.listHabits(CURRENT_USER_ID, { archived: false }), listHabitLogs(habitId)])
  const current = habit.find((item) => item.id === habitId)
  if (!current) return 0
  return calculateStreak(logs, dateKey, current.freezesAllowed)
}

export const isHabitCompleted = (logs: HabitLog[], dateKey: string) =>
  logs.some((log) => log.dateKey === dateKey && log.status === 'completed')
