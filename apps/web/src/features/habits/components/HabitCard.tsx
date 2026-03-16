import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, Check, Flame, Trash2, TrendingUp } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { HabitCalendar } from './HabitCalendar'
import { todayDateKey } from '../model/dateKey'
import { useHabitsI18n } from '../habitsI18n'

type HabitCardProps = {
  habit: Habit
  completedDates: string[]
  onToggleToday: () => Promise<void>
  onToggleDate: (dateKey: string) => Promise<void>
  onArchive: () => Promise<void>
}

const daysSinceCreated = (createdAt: number) => {
  const diff = Date.now() - createdAt
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
}

export const HabitCard = ({ habit, completedDates, onToggleToday, onToggleDate, onArchive }: HabitCardProps) => {
  const i18n = useHabitsI18n()
  const [showCalendar, setShowCalendar] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const today = todayDateKey()
  const completedToday = completedDates.includes(today)

  const streak = (() => {
    let count = 0
    let cursor = today
    while (completedDates.includes(cursor)) {
      count += 1
      const [year, month, day] = cursor.split('-').map(Number)
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() - 1)
      cursor = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
    }
    return count
  })()

  const totalCompleted = completedDates.length
  const completionRate = totalCompleted > 0 ? Math.round((totalCompleted / daysSinceCreated(habit.createdAt)) * 100) : 0

  const handleToggleToday = async () => {
    if (!completedToday) {
      setJustCompleted(true)
      window.setTimeout(() => setJustCompleted(false), 600)
    }
    await onToggleToday()
  }

  const stats = [
    { icon: Flame, value: streak, label: i18n.streak },
    { icon: TrendingUp, value: `${completionRate}%`, label: i18n.completionRate },
    { icon: Calendar, value: totalCompleted, label: i18n.total },
  ]

  return (
    <motion.div
      className="habit-card-design"
      whileHover={{ y: -2, boxShadow: '0 4px 20px rgba(58, 55, 51, 0.06)' }}
      transition={{ duration: 0.2 }}
    >
      <AnimatePresence>
        {justCompleted ? (
          <motion.div
            className="habit-card-design__celebration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => void onArchive()}
        className="habit-card-design__delete"
        whileHover={{ scale: 1.2, rotate: 8 }}
        whileTap={{ scale: 0.85 }}
        aria-label={i18n.remove}
      >
        <Trash2 size={16} />
      </motion.button>

      <div className="habit-card-design__header">
        <div className="habit-card-design__hero">
          <motion.span
            className="habit-card-design__icon"
            animate={justCompleted ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
            transition={{ duration: 0.32 }}
          >
            {habit.icon ?? '🎯'}
          </motion.span>
          <div>
            <h3 className="habit-card-design__title">{habit.title}</h3>
            <p className="habit-card-design__description">{habit.description || ' '}</p>
          </div>
        </div>
      </div>

      <div className="habit-card-design__stats">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            className="habit-card-design__stat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 + 0.04, duration: 0.2 }}
          >
            <stat.icon className="habit-card-design__stat-icon" size={16} />
            <motion.div
              className="habit-card-design__stat-value"
              key={String(stat.value)}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              {stat.value}
            </motion.div>
            <div className="habit-card-design__stat-label">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={() => void handleToggleToday()}
        className={`habit-card-design__complete ${completedToday ? 'is-completed' : ''}`}
        whileTap={{ scale: 0.97 }}
        animate={justCompleted ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 0.2 }}
      >
        <AnimatePresence mode="wait">
          {completedToday ? (
            <motion.span
              key="completed"
              className="habit-card-design__complete-text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              <motion.span initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
                <Check size={18} />
              </motion.span>
              {i18n.todayCompleted}
            </motion.span>
          ) : (
            <motion.span
              key="uncompleted"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.16 }}
            >
              {i18n.markToday}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <motion.button
        type="button"
        onClick={() => setShowCalendar((prev) => !prev)}
        className="habit-card-design__calendar-toggle"
        whileTap={{ scale: 0.97 }}
      >
        <motion.span animate={{ rotate: showCalendar ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <Calendar size={16} />
        </motion.span>
        {showCalendar ? i18n.hideCalendar : i18n.showCalendar}
      </motion.button>

      <AnimatePresence>
        {showCalendar ? (
          <motion.div
            className="habit-card-design__calendar-wrap"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <HabitCalendar completedDates={completedDates} onToggleCompletion={onToggleDate} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
