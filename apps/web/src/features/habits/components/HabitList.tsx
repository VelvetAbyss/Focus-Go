import { motion } from 'motion/react'
import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

type HabitListProps = {
  habits: Habit[]
  completedDatesByHabit: Record<string, string[]>
  onToggleToday: (habit: Habit) => Promise<void>
  onToggleDate: (habit: Habit, dateKey: string) => Promise<void>
  onArchive: (habitId: string) => Promise<void>
}

export const HabitList = ({ habits, completedDatesByHabit, onToggleToday, onToggleDate, onArchive }: HabitListProps) => {
  return (
    <div className="habit-list-design">
      {habits.map((habit, index) => (
        <motion.div
          key={habit.id}
          layout
          transition={{
            duration: 0.22,
            delay: index * 0.025,
            layout: { duration: 0.2, type: 'spring', stiffness: 320, damping: 30 },
          }}
        >
          <HabitCard
            habit={habit}
            completedDates={completedDatesByHabit[habit.id] ?? []}
            onToggleToday={() => onToggleToday(habit)}
            onToggleDate={(dateKey) => onToggleDate(habit, dateKey)}
            onArchive={() => onArchive(habit.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}
