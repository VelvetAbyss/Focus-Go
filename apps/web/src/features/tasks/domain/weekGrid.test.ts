import { describe, expect, it } from 'vitest'
import { buildWeekGrid, weekGridDayIndex } from './weekGrid'
import type { TaskProgressSummary } from './taskProgressSummary'

const monday = new Date(2026, 9, 5).getTime()
const at = (day: number, hour: number) => new Date(2026, 9, 5 + day, hour).getTime()

const summaryWith = (tasks: Array<{ id: string; completedAt: number }>): Pick<TaskProgressSummary, 'range' | 'projects'> => ({
  range: { startAt: monday, endAt: at(7, 0), label: '' },
  projects: [
    {
      projectId: undefined,
      projectTitle: '',
      projectColor: '',
      progress: 0,
      completedTaskCount: tasks.length,
      completionEventCount: tasks.length,
      completedSubtaskCount: 0,
      preciseSubtaskCount: 0,
      fallbackSubtaskCount: 0,
      latestCompletedAt: 0,
      tasks: tasks.map((task) => ({ ...task, title: task.id, completionEvents: 1, subtasks: [] })),
    },
  ],
})

describe('buildWeekGrid', () => {
  it('puts each task on the local day it was finished, oldest at the bottom', () => {
    const days = buildWeekGrid(
      summaryWith([
        { id: 'wed-late', completedAt: at(2, 18) },
        { id: 'mon', completedAt: at(0, 9) },
        { id: 'wed-early', completedAt: at(2, 8) },
        { id: 'sun', completedAt: at(6, 23) },
      ]),
    )

    expect(days).toHaveLength(7)
    expect(days.map((day) => day.cells.length)).toEqual([1, 0, 2, 0, 0, 0, 1])
    expect(days[2].cells.map((cell) => cell.taskId)).toEqual(['wed-early', 'wed-late'])
    expect(days[6].startAt).toBe(at(6, 0))
  })

  it('finds the day that contains a moment', () => {
    const days = buildWeekGrid(summaryWith([]))
    expect(weekGridDayIndex(days, at(0, 0))).toBe(0)
    expect(weekGridDayIndex(days, at(4, 15))).toBe(4)
    expect(weekGridDayIndex(days, monday - 1)).toBe(-1)
  })
})
