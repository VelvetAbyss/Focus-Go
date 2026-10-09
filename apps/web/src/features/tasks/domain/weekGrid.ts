import type { TaskProgressSummary } from './taskProgressSummary'

/**
 * The recap's graph-paper week: the week's finished tasks, counted the way the
 * recap counts them (once per task), sorted into Monday–Sunday columns with
 * the oldest at the bottom.
 */

export type WeekGridCell = {
  taskId: string
  title: string
  completedAt: number
}

export type WeekGridDay = {
  /** Local midnight that starts the day. */
  startAt: number
  /** Oldest first, so a cell keeps its place as more land above it. */
  cells: WeekGridCell[]
}

// Day starts are local midnights; DST can make a day 23 or 25 hours, so step
// by calendar days rather than by a fixed number of milliseconds.
const dayStarts = (weekStart: number) => {
  const date = new Date(weekStart)
  return Array.from({ length: 7 }, (_, index) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + index).getTime())
}

/** Index of the day in `days` that contains `at`, or -1 before the week starts. */
export const weekGridDayIndex = (days: readonly WeekGridDay[], at: number) => {
  for (let index = days.length - 1; index >= 0; index--) {
    if (at >= days[index].startAt) return index
  }
  return -1
}

export const buildWeekGrid = (summary: Pick<TaskProgressSummary, 'range' | 'projects'>): WeekGridDay[] => {
  const days: WeekGridDay[] = dayStarts(summary.range.startAt).map((startAt) => ({ startAt, cells: [] }))
  for (const project of summary.projects) {
    for (const task of project.tasks) {
      const index = weekGridDayIndex(days, task.completedAt)
      if (index < 0) continue
      days[index].cells.push({ taskId: task.id, title: task.title, completedAt: task.completedAt })
    }
  }
  for (const day of days) {
    day.cells.sort((a, b) => a.completedAt - b.completedAt || a.taskId.localeCompare(b.taskId))
  }
  return days
}
