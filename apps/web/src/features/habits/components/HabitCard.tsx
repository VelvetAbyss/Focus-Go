import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Calendar, Check, Trash2 } from 'lucide-react'
import type { Habit } from '../../../data/models/types'
import { HabitCalendar } from './HabitCalendar'
import { todayDateKey } from '../model/dateKey'
import { useHabitsI18n } from '../habitsI18n'

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
  const [justCompleted, setJustCompleted] = useState(false)

  const today = todayDateKey()
  const completedToday = completedDates.includes(today)
  const totalCompleted = completedDates.length
  const completionRate = totalCompleted > 0
    ? Math.round((totalCompleted / daysSinceCreated(habit.createdAt)) * 100)
    : 0

  const last7Days = useMemo(() => getLast7Days(), [])
  const accentColor = habit.color || '#3daa78'

  const handleToggleToday = async () => {
    if (!completedToday) {
      setJustCompleted(true)
      window.setTimeout(() => setJustCompleted(false), 900)
    }
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
        {/* Celebration ripple */}
        <AnimatePresence>
          {justCompleted && (
            <motion.div
              className="habit-card-design__celebration"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
              style={{
                background: `radial-gradient(ellipse at 50% 90%, ${accentColor}22 0%, transparent 65%)`,
              }}
            />
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="habit-card-design__header">
          <div className="habit-card-design__hero">
            <motion.div
              className="habit-card-design__icon-wrap"
              style={{ background: `${accentColor}18` }}
              animate={justCompleted ? { scale: [1, 1.25, 0.95, 1], rotate: [0, 14, -10, 0] } : {}}
              transition={{ duration: 0.45 }}
            >
              {habit.icon ?? '🎯'}
            </motion.div>
            <div style={{ minWidth: 0 }}>
              <h3 className="habit-card-design__title">{habit.title}</h3>
              <p className="habit-card-design__description">{habit.description || '\u00a0'}</p>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => void onArchive()}
            className="habit-card-design__delete"
            whileHover={{ scale: 1.18, rotate: 6 }}
            whileTap={{ scale: 0.85 }}
            aria-label={i18n.remove}
          >
            <Trash2 size={15} />
          </motion.button>
        </div>

        {/* Week dots — last 7 days */}
        <div className="habit-card-design__week">
          {last7Days.map((dateKey) => {
            const done = completedDates.includes(dateKey)
            const isToday = dateKey === today
            const dayNum = parseInt(dateKey.split('-')[2], 10)
            return (
              <div key={dateKey} className="habit-card-design__week-col">
                <div
                  className="habit-card-design__week-num"
                  style={isToday ? { color: accentColor, fontWeight: 700 } : undefined}
                >
                  {dayNum}
                </div>
                <motion.div
                  className="habit-card-design__week-dot"
                  style={{
                    background: done ? accentColor : undefined,
                    boxShadow: isToday && !done ? `0 0 0 2px ${accentColor}` : undefined,
                    opacity: isToday && !done ? 0.55 : undefined,
                  }}
                  animate={justCompleted && isToday ? { scale: [1, 1.45, 1] } : {}}
                  transition={{ duration: 0.32 }}
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
              <motion.div
                className="habit-card-design__stat-value"
                key={String(stat.value)}
                initial={{ scale: 0.88, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                style={stat.accent ? { color: accentColor } : undefined}
              >
                {stat.value}
              </motion.div>
              <div className="habit-card-design__stat-label">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Complete button */}
        <motion.button
          type="button"
          onClick={() => void handleToggleToday()}
          className={`habit-card-design__complete ${completedToday ? 'is-completed' : ''}`}
          style={completedToday ? { background: accentColor, borderColor: 'transparent' } : undefined}
          whileTap={{ scale: 0.97 }}
          animate={justCompleted ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 0.22 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {completedToday ? (
              <motion.span
                key="done"
                className="habit-card-design__complete-text"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
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
                transition={{ duration: 0.18 }}
              >
                {i18n.markToday}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Calendar toggle */}
        <motion.button
          type="button"
          onClick={() => setShowCalendar((prev) => !prev)}
          className="habit-card-design__calendar-toggle"
          whileTap={{ scale: 0.97 }}
        >
          <motion.span
            animate={{ rotate: showCalendar ? 180 : 0 }}
            transition={{ duration: 0.22 }}
            style={{ display: 'flex' }}
          >
            <Calendar size={14} />
          </motion.span>
          {showCalendar ? i18n.hideCalendar : i18n.showCalendar}
        </motion.button>

        {/* Calendar expand */}
        <AnimatePresence initial={false}>
          {showCalendar && (
            <motion.div
              className="habit-card-design__calendar-wrap"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            >
              <HabitCalendar
                completedDates={completedDates}
                onToggleCompletion={onToggleDate}
                accentColor={accentColor}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
