import { describe, expect, it } from 'vitest'
import type { TaskItem } from '../../../data/models/types'
import { buildJarShelf, collectJarWeeks, startOfJarWeek, weekKeyOf } from './completionJar'

const done = (id: string, at: Date) => ({ id, type: 'status' as const, message: 'Status changed to Done', createdAt: at.getTime() })

const task = (id: string, logs: TaskItem['activityLogs']): TaskItem =>
  ({ id, title: id, status: 'done', activityLogs: logs, subtasks: [], tags: [] }) as unknown as TaskItem

describe('completionJar', () => {
  it('starts weeks on Monday at local midnight', () => {
    expect(new Date(startOfJarWeek(new Date(2026, 8, 30, 15).getTime()))).toEqual(new Date(2026, 8, 28))
    // A Sunday belongs to the week that began the Monday before.
    expect(new Date(startOfJarWeek(new Date(2026, 9, 4, 23).getTime()))).toEqual(new Date(2026, 8, 28))
    expect(weekKeyOf(new Date(2026, 8, 28).getTime())).toBe('2026-09-28')
  })

  it('makes one bead per task per week, ordered by its first completion', () => {
    const tasks = [
      task('b', [done('1', new Date(2026, 8, 29, 9)), done('2', new Date(2026, 8, 30, 9))]),
      task('a', [done('3', new Date(2026, 8, 30, 8))]),
      task('c', [{ id: '4', type: 'status', message: 'Status changed to Doing', createdAt: new Date(2026, 8, 29).getTime() }]),
    ]
    const week = collectJarWeeks(tasks).get(new Date(2026, 8, 28).getTime())
    expect(week?.beads.map((bead) => bead.taskId)).toEqual(['b', 'a'])
    expect(week?.beads[0].completedAt).toBe(new Date(2026, 8, 29, 9).getTime())
  })

  it('counts a task again in a later week it is completed in', () => {
    const tasks = [task('a', [done('1', new Date(2026, 8, 22, 9)), done('2', new Date(2026, 8, 29, 9))])]
    const weeks = collectJarWeeks(tasks)
    expect(weeks.size).toBe(2)
  })

  it('puts only weeks with beads on the shelf, oldest first, at most shelfSize', () => {
    const tasks = [
      task('w-1', [done('1', new Date(2026, 8, 22, 9))]),
      // no completions in the week of 2026-09-14
      task('w-3', [done('2', new Date(2026, 8, 8, 9))]),
      task('w-4', [done('3', new Date(2026, 8, 1, 9))]),
      task('now', [done('4', new Date(2026, 8, 29, 9))]),
    ]
    const shelf = buildJarShelf(tasks, { anchorAt: new Date(2026, 8, 30).getTime(), shelfSize: 2 })
    expect(shelf.main.key).toBe('2026-09-28')
    expect(shelf.main.beads).toHaveLength(1)
    expect(shelf.shelf.map((week) => week.key)).toEqual(['2026-09-07', '2026-09-21'])
  })

  it('gives an empty open jar for a week with nothing done yet', () => {
    const shelf = buildJarShelf([], { anchorAt: new Date(2026, 8, 30).getTime() })
    expect(shelf.main.beads).toEqual([])
    expect(shelf.shelf).toEqual([])
  })
})
