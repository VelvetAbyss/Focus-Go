import type { Habit } from '../../../data/models/types'

export type HabitWidgetScope = 'day' | 'week' | 'month'

export type HabitWidgetTodoRow = {
  id: string
  scope: HabitWidgetScope
  title: string
  done: boolean
  summary: string
  icon?: string
  color: string
}

type BuildHabitWidgetTodosArgs = {
  scope: HabitWidgetScope
  habits: Habit[]
  completedDatesByHabit: Record<string, string[]>
  today: string
}

const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0)
}

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const startOfWeek = (date: Date) => {
  const next = new Date(date)
  const diff = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - diff)
  next.setHours(12, 0, 0, 0)
  return next
}

const countInRange = (dates: string[], startKey: string, endKey: string) =>
  dates.filter((dateKey) => dateKey >= startKey && dateKey <= endKey).length

const buildSummary = (scope: HabitWidgetScope, dates: string[], today: string) => {
  if (scope === 'day') return dates.includes(today) ? 'Completed today' : 'Ready for today'

  const current = parseDateKey(today)
  if (scope === 'week') {
    const start = startOfWeek(current)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${countInRange(dates, formatDateKey(start), formatDateKey(end))}/7 days`
  }

  const start = new Date(current.getFullYear(), current.getMonth(), 1, 12, 0, 0, 0)
  const end = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12, 0, 0, 0)
  const daysInMonth = end.getDate()
  return `${countInRange(dates, formatDateKey(start), formatDateKey(end))}/${daysInMonth} days`
}

const isDoneForScope = (scope: HabitWidgetScope, dates: string[], today: string) => {
  if (scope === 'day') return dates.includes(today)

  const current = parseDateKey(today)
  if (scope === 'week') {
    const start = formatDateKey(startOfWeek(current))
    const endDate = startOfWeek(current)
    endDate.setDate(endDate.getDate() + 6)
    return countInRange(dates, start, formatDateKey(endDate)) > 0
  }

  const start = formatDateKey(new Date(current.getFullYear(), current.getMonth(), 1, 12, 0, 0, 0))
  const end = formatDateKey(new Date(current.getFullYear(), current.getMonth() + 1, 0, 12, 0, 0, 0))
  return countInRange(dates, start, end) > 0
}

export const buildHabitWidgetTodos = ({ scope, habits, completedDatesByHabit, today }: BuildHabitWidgetTodosArgs): HabitWidgetTodoRow[] =>
  habits
    .filter((habit) => !habit.archived)
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
      return left.createdAt - right.createdAt
    })
    .map((habit) => {
      const completedDates = completedDatesByHabit[habit.id] ?? []
      return {
        id: habit.id,
        scope,
        title: habit.title,
        done: isDoneForScope(scope, completedDates, today),
        summary: buildSummary(scope, completedDates, today),
        icon: habit.icon,
        color: habit.color,
      }
    })
