import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSyncDataRefresh } from '../../../data/sync/service'
import type { Habit, HabitLog } from '../../../data/models/types'
import {
  archiveHabit,
  completeHabit,
  createHabit,
  getDailyProgress,
  getHeatmap,
  getStreak,
  isHabitCompleted,
  listHabitLogs,
  listHabits,
  reorderHabits,
  restoreHabit,
  undoHabit,
  updateHabit,
  type HabitDraft,
} from '../model/habitSchema'
import { todayDateKey } from '../model/dateKey'
import { emitHabitsChanged, subscribeHabitsChanged } from '../habitSync'

type HabitLogsMap = Record<string, HabitLog[]>

type State = {
  loading: boolean
  activeHabits: Habit[]
  archivedHabits: Habit[]
  logsByHabit: HabitLogsMap
  completedDatesByHabit: Record<string, string[]>
  streakByHabit: Record<string, number>
  dailyProgress: { completed: number; total: number; percent: number }
  heatmap: Array<{ dateKey: string; completed: number; total: number }>
}

const initialState: State = {
  loading: true,
  activeHabits: [],
  archivedHabits: [],
  logsByHabit: {},
  completedDatesByHabit: {},
  streakByHabit: {},
  dailyProgress: { completed: 0, total: 0, percent: 0 },
  heatmap: [],
}

export const useHabitTracker = () => {
  const [state, setState] = useState<State>(initialState)
  const dateKey = todayDateKey()

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    const [activeHabits, archivedHabits] = await Promise.all([listHabits(false), listHabits(true)])
    const allHabits = [...activeHabits, ...archivedHabits]
    const [dailyProgress, heatmap, logsRows, streakRows] = await Promise.all([
      getDailyProgress(dateKey),
      getHeatmap(35),
      Promise.all(allHabits.map((habit) => listHabitLogs(habit.id))),
      Promise.all(allHabits.map((habit) => getStreak(habit.id, dateKey))),
    ])

    const logsByHabit = allHabits.reduce<HabitLogsMap>((acc, habit, index) => {
      acc[habit.id] = logsRows[index] ?? []
      return acc
    }, {})

    const completedDatesByHabit = allHabits.reduce<Record<string, string[]>>((acc, habit, index) => {
      const rows = logsRows[index] ?? []
      acc[habit.id] = rows
        .filter((log) => log.status === 'completed')
        .map((log) => log.dateKey)
        .sort()
      return acc
    }, {})

    const streakByHabit = allHabits.reduce<Record<string, number>>((acc, habit, index) => {
      acc[habit.id] = streakRows[index] ?? 0
      return acc
    }, {})

    setState({
      loading: false,
      activeHabits,
      archivedHabits,
      logsByHabit,
      completedDatesByHabit,
      streakByHabit,
      dailyProgress,
      heatmap,
    })
  }, [dateKey])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => subscribeHabitsChanged(() => {
    void refresh()
  }), [refresh])

  useSyncDataRefresh(refresh)

  const completedHabitIds = useMemo(() => {
    return new Set(
      state.activeHabits
        .filter((habit) => isHabitCompleted(state.logsByHabit[habit.id] ?? [], dateKey))
        .map((habit) => habit.id),
    )
  }, [dateKey, state.activeHabits, state.logsByHabit])

  const handleCreate = useCallback(
    async (draft: HabitDraft) => {
      const habit = await createHabit(draft)
      emitHabitsChanged('create')
      return habit
    },
    [],
  )

  const handleUpdate = useCallback(
    async (habitId: string, draft: Partial<HabitDraft>) => {
      await updateHabit(habitId, draft)
      emitHabitsChanged('update')
    },
    [],
  )

  const handleArchive = useCallback(
    async (habitId: string) => {
      await archiveHabit(habitId)
      emitHabitsChanged('archive')
    },
    [],
  )

  const handleRestore = useCallback(
    async (habitId: string) => {
      await restoreHabit(habitId)
      emitHabitsChanged('restore')
    },
    [],
  )

  const handleComplete = useCallback(
    async (habit: Habit, value?: number, targetDateKey?: string) => {
      await completeHabit(habit, targetDateKey ?? dateKey, value)
      emitHabitsChanged('complete')
    },
    [dateKey],
  )

  const handleUndo = useCallback(
    async (habitId: string, targetDateKey?: string) => {
      await undoHabit(habitId, targetDateKey ?? dateKey)
      emitHabitsChanged('undo')
    },
    [dateKey],
  )

  const moveHabit = useCallback(
    async (habitId: string, direction: -1 | 1) => {
      const index = state.activeHabits.findIndex((habit) => habit.id === habitId)
      if (index < 0) return
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= state.activeHabits.length) return
      const next = [...state.activeHabits]
      const [picked] = next.splice(index, 1)
      next.splice(targetIndex, 0, picked)
      await reorderHabits(next.map((item) => item.id))
      emitHabitsChanged('reorder')
    },
    [state.activeHabits],
  )

  return {
    ...state,
    dateKey,
    completedHabitIds,
    refresh,
    createHabit: handleCreate,
    updateHabit: handleUpdate,
    archiveHabit: handleArchive,
    restoreHabit: handleRestore,
    completeHabit: handleComplete,
    undoHabit: handleUndo,
    moveHabit,
  }
}
