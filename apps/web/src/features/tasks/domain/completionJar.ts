import type { TaskItem } from '../../../data/models/types'
import { isTaskDoneActivityLog } from './taskProgressSummary'

/**
 * The completion jar's data: one bead per task completed in a week, read from
 * the task activity logs with the same rule as the weekly recap (a task counts
 * once per week however often it was ticked). Weeks with no completions never
 * appear — an empty week is not a missed goal, it simply leaves no jar.
 */

export type JarBead = {
  taskId: string
  /** First time the task was marked done in this week. */
  completedAt: number
}

export type JarWeek = {
  /** Local date of the week's Monday, `YYYY-MM-DD`. */
  key: string
  startAt: number
  endAt: number
  /** Oldest first, so a bead's place in the jar never changes as more land. */
  beads: JarBead[]
}

export type JarShelf = {
  /** The week on show (the recap card's selected week). */
  main: JarWeek
  /** Earlier weeks that have beads, oldest first, at most `shelfSize`. */
  shelf: JarWeek[]
}

const pad = (value: number) => String(value).padStart(2, '0')

export const weekKeyOf = (startAt: number) => {
  const date = new Date(startAt)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight of the Monday that starts the week containing `value`. */
export const startOfJarWeek = (value: number) => {
  const date = new Date(value)
  const mondayOffset = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset).getTime()
}

// Week starts are local midnights; DST can make a week 167 or 169 hours, so
// step by calendar days rather than by a fixed number of milliseconds.
const shiftWeeks = (startAt: number, weeks: number) => {
  const date = new Date(startAt)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + weeks * 7).getTime()
}

const emptyWeek = (startAt: number): JarWeek => ({ key: weekKeyOf(startAt), startAt, endAt: shiftWeeks(startAt, 1), beads: [] })

/** Every week that has at least one completion, keyed by week start. */
export const collectJarWeeks = (tasks: readonly TaskItem[]): Map<number, JarWeek> => {
  const weeks = new Map<number, Map<string, number>>()
  for (const task of tasks) {
    for (const log of task.activityLogs ?? []) {
      if (!isTaskDoneActivityLog(log)) continue
      const startAt = startOfJarWeek(log.createdAt)
      let byTask = weeks.get(startAt)
      if (!byTask) {
        byTask = new Map()
        weeks.set(startAt, byTask)
      }
      const first = byTask.get(task.id)
      if (first === undefined || log.createdAt < first) byTask.set(task.id, log.createdAt)
    }
  }
  const result = new Map<number, JarWeek>()
  for (const [startAt, byTask] of weeks) {
    const beads = [...byTask.entries()]
      .map(([taskId, completedAt]) => ({ taskId, completedAt }))
      .sort((a, b) => a.completedAt - b.completedAt || a.taskId.localeCompare(b.taskId))
    result.set(startAt, { ...emptyWeek(startAt), beads })
  }
  return result
}

/**
 * The jar for the week containing `anchorAt`, and the shelf of earlier weeks
 * that have beads (looking back up to `lookbackWeeks`).
 */
export const buildJarShelf = (
  tasks: readonly TaskItem[],
  { anchorAt, shelfSize = 6, lookbackWeeks = 52 }: { anchorAt: number; shelfSize?: number; lookbackWeeks?: number },
): JarShelf => {
  const weeks = collectJarWeeks(tasks)
  const mainStart = startOfJarWeek(anchorAt)
  const main = weeks.get(mainStart) ?? emptyWeek(mainStart)
  const shelf: JarWeek[] = []
  for (let back = 1; back <= lookbackWeeks && shelf.length < shelfSize; back++) {
    const week = weeks.get(shiftWeeks(mainStart, -back))
    if (week && week.beads.length > 0) shelf.unshift(week)
  }
  return { main, shelf }
}
