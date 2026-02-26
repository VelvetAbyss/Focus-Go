import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

type HabitListProps = {
  habits: Habit[]
  completedHabitIds: Set<string>
  streakByHabit: Record<string, number>
  archived: boolean
  onComplete: (habit: Habit, value?: number) => Promise<void>
  onArchive: (habitId: string) => Promise<void>
  onRestore: (habitId: string) => Promise<void>
  onEdit: (habit: Habit) => void
  onMove: (habitId: string, direction: -1 | 1) => Promise<void>
}

export const HabitList = ({ habits, completedHabitIds, streakByHabit, archived, onComplete, onArchive, onRestore, onEdit, onMove }: HabitListProps) => {
  return (
    <div className="habit-list">
      {habits.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          streak={streakByHabit[habit.id] ?? 0}
          completed={completedHabitIds.has(habit.id)}
          archived={archived}
          onComplete={(value) => onComplete(habit, value)}
          onArchive={() => onArchive(habit.id)}
          onRestore={() => onRestore(habit.id)}
          onEdit={() => onEdit(habit)}
          onMoveUp={() => onMove(habit.id, -1)}
          onMoveDown={() => onMove(habit.id, 1)}
        />
      ))}
    </div>
  )
}
