import { motion } from 'motion/react'
import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

type HabitListProps = {
  habits: Habit[]
  completedDatesByHabit: Record<string, string[]>
  streakByHabit: Record<string, number>
  onToggleToday: (habit: Habit) => Promise<void>
  onToggleDate: (habit: Habit, dateKey: string) => Promise<void>
  onArchive: (habitId: string) => Promise<void>
}

export const HabitList = ({
  habits,
  completedDatesByHabit,
  streakByHabit,
  onToggleToday,
  onToggleDate,
  onArchive,
}: HabitListProps) => {
  return (
    <div className="habit-list-design">
      {habits.map((habit, index) => (
        <motion.div
          key={habit.id}
          layout
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.32,
            delay: index * 0.06,
            layout: { duration: 0.22, type: 'spring', stiffness: 320, damping: 30 },
          }}
        >
          <HabitCard
            habit={habit}
            completedDates={completedDatesByHabit[habit.id] ?? []}
            streak={streakByHabit[habit.id] ?? 0}
            onToggleToday={() => onToggleToday(habit)}
            onToggleDate={(dateKey) => onToggleDate(habit, dateKey)}
            onArchive={() => onArchive(habit.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}
