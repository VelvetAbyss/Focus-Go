import type { HabitLog, HabitStatus } from '../../../data/models/types'
import { shiftDateKey } from './dateKey'

type StreakLog = Pick<HabitLog, 'dateKey' | 'status'>

const contributesToStreak = (status: HabitStatus) => status === 'completed' || status === 'frozen'

export const calculateStreak = (logs: StreakLog[], dateKey: string, freezesAllowed: number) => {
  const byDate = new Map(logs.map((log) => [log.dateKey, log.status]))
  const earliestDateKey = logs.length > 0 ? logs.reduce((min, log) => (log.dateKey < min ? log.dateKey : min), logs[0].dateKey) : null
  let streak = 0
  let cursor = dateKey
  let freezesLeft = Math.max(0, freezesAllowed)

  for (let index = 0; index < 3650; index += 1) {
    const status = byDate.get(cursor)
    if (!status) {
      if (earliestDateKey && cursor < earliestDateKey) break
      if (freezesLeft <= 0) break
      freezesLeft -= 1
      streak += 1
      cursor = shiftDateKey(cursor, -1)
      continue
    }

    if (contributesToStreak(status)) {
      streak += 1
      if (status === 'frozen') freezesLeft = Math.max(0, freezesLeft - 1)
      cursor = shiftDateKey(cursor, -1)
      continue
    }

    if (freezesLeft <= 0) break
    freezesLeft -= 1
    streak += 1
    cursor = shiftDateKey(cursor, -1)
  }

  return streak
}
