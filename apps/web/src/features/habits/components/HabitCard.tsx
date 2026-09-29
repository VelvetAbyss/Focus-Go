import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, Check, Trash2 } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { HabitCalendar } from './HabitCalendar'
import { todayDateKey } from '../model/dateKey'
import { useHabitsI18n } from '../habitsI18n'
import { DURATION, EASE } from '../../../shared/motion/tokens'

type HabitCardProps = {
  habit: Habit
  completedDates: string[]
  streak: number
  onToggleToday: () => Promise<void>
  onToggleDate: (dateKey: string) => Promise<void>
  onArchive: () => Promise<void>
}

const daysSinceCreated = (createdAt: number) => {
  const diff = Date.now() - createdAt
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1)
}

const getLast7Days = (): string[] => {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  }
  return days
}

export const HabitCard = ({
  habit,
  completedDates,
  streak,
  onToggleToday,
  onToggleDate,
  onArchive,
}: HabitCardProps) => {
  const i18n = useHabitsI18n()
  const [showCalendar, setShowCalendar] = useState(false)

  const today = todayDateKey()
  const completedToday = completedDates.includes(today)
  const totalCompleted = completedDates.length
  // Past days can be checked off from before the habit was created, so the
  // ratio can pass 1; a rate never reads above 100%.
  const completionRate = totalCompleted > 0
    ? Math.min(100, Math.round((totalCompleted / daysSinceCreated(habit.createdAt)) * 100))
    : 0

  const last7Days = useMemo(() => getLast7Days(), [])
  // The habit's own colour is identity only: a 2px bar (DESIGN.md › Color = state).
  const accentColor = habit.color || 'var(--ink-4)'

  const handleToggleToday = async () => {
    await onToggleToday()
  }

  return (
    <div
      className="habit-card-design"
      style={{ '--hb-accent': accentColor } as React.CSSProperties}
    >
      {/* Color accent bar */}
      <div className="habit-card-design__accent" style={{ background: accentColor }} />

      <div className="habit-card-design__body">
        {/* Header */}
        <div className="habit-card-design__header">
          <div className="habit-card-design__hero">
            <div className="habit-card-design__icon-wrap">{habit.icon ?? '🎯'}</div>
            <div style={{ minWidth: 0 }}>
              <h3 className="habit-card-design__title">{habit.title}</h3>
              <p className="habit-card-design__description">{habit.description || '\u00a0'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void onArchive()}
            className="habit-card-design__delete"
            aria-label={i18n.remove}
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Last 7 days (DESIGN.md › Habit history): a done day is an ink dot, a
            missed day is bare paper with a hairline ring, today is the pen. */}
        <div className="habit-card-design__week">
          {last7Days.map((dateKey) => {
            const done = completedDates.includes(dateKey)
            const isToday = dateKey === today
            const dayNum = parseInt(dateKey.split('-')[2], 10)
            return (
              <div key={dateKey} className="habit-card-design__week-col">
                <div className="habit-card-design__week-num" data-today={isToday ? 'true' : undefined}>
                  {dayNum}
                </div>
                <div
                  className="habit-card-design__week-dot"
                  data-state={done ? 'done' : 'missed'}
                  data-today={isToday ? 'true' : undefined}
                />
              </div>
            )
          })}
        </div>

        {/* Stats */}
        <div className="habit-card-design__stats">
          {[
            { value: streak, label: i18n.streak, accent: streak > 0 },
            { value: `${completionRate}%`, label: i18n.completionRate, accent: false },
            { value: totalCompleted, label: i18n.total, accent: false },
          ].map((stat) => (
            <div key={stat.label} className="habit-card-design__stat">
              <div className="habit-card-design__stat-value" data-streak={stat.accent ? 'true' : undefined}>
                {stat.value}
              </div>
              <div className="habit-card-design__stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Complete button */}
        <button
          type="button"
          onClick={() => void handleToggleToday()}
          className={`habit-card-design__complete ${completedToday ? 'is-completed' : ''}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {completedToday ? (
              <motion.span
                key="done"
                className="habit-card-design__complete-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.base }}
              >
                <Check size={16} strokeWidth={2.5} />
                {i18n.todayCompleted}
              </motion.span>
            ) : (
              <motion.span
                key="todo"
                className="habit-card-design__complete-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: DURATION.base }}
              >
                {i18n.markToday}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Calendar toggle */}
        <button
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
          className="habit-card-design__calendar-toggle"
        >
          <motion.span
            animate={{ rotate: showCalendar ? 180 : 0 }}
            transition={{ duration: DURATION.base }}
            style={{ display: 'flex' }}
          >
            <Calendar size={14} />
          </motion.span>
          {showCalendar ? i18n.hideCalendar : i18n.showCalendar}
        </button>

        {/* Calendar expand */}
        <AnimatePresence initial={false}>
          {showCalendar && (
            <motion.div
              className="habit-card-design__calendar-wrap"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: DURATION.medium, ease: EASE.standard }}
            >
              <HabitCalendar completedDates={completedDates} onToggleCompletion={onToggleDate} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
