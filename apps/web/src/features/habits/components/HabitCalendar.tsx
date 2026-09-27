import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayDateKey } from '../model/dateKey'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { DURATION } from '../../../shared/motion/tokens'

type HabitCalendarProps = {
  completedDates: string[]
  onToggleCompletion: (dateKey: string) => Promise<void>
  accentColor?: string
}

// Weekday headers and the month caption come from Intl rather than a hand-kept
// table: it stays correct for every locale the app adds later, and it formats
// the year the way each locale expects (2026年3月 vs March 2026).
const localeOf = (language: string) => (language === 'zh' ? 'zh-CN' : 'en-US')

const weekDayLabels = (language: string) => {
  const fmt = new Intl.DateTimeFormat(localeOf(language), { weekday: 'narrow' })
  // 2024-01-07 is a Sunday, matching this grid's Sunday-first column order.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))))
}

const monthCaption = (language: string, year: number, month: number) =>
  new Intl.DateTimeFormat(localeOf(language), { year: 'numeric', month: 'long' })
    .format(new Date(Date.UTC(year, month, 1)))

const toDateKey = (year: number, month: number, day: number) => {
  const monthText = `${month + 1}`.padStart(2, '0')
  const dayText = `${day}`.padStart(2, '0')
  return `${year}-${monthText}-${dayText}`
}

export const HabitCalendar = ({ completedDates, onToggleCompletion, accentColor = '#3daa78' }: HabitCalendarProps) => {
  const { language } = usePreferences()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [direction, setDirection] = useState(0)
  const weekDays = useMemo(() => weekDayLabels(language), [language])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  const today = todayDateKey()
  const monthKey = `${year}-${month}`

  return (
    <div className="habit-calendar">
      <div className="habit-calendar__nav">
        <motion.button
          type="button"
          className="habit-calendar__nav-button"
          onClick={() => {
            setDirection(-1)
            setCurrentMonth(new Date(year, month - 1))
          }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9, x: -2 }}
        >
          <ChevronLeft size={15} />
        </motion.button>

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={monthKey}
            className="habit-calendar__title"
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: DURATION.base }}
          >
            {monthCaption(language, year, month)}
          </motion.div>
        </AnimatePresence>

        <motion.button
          type="button"
          className="habit-calendar__nav-button"
          onClick={() => {
            setDirection(1)
            setCurrentMonth(new Date(year, month + 1))
          }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9, x: 2 }}
        >
          <ChevronRight size={15} />
        </motion.button>
      </div>

      <div className="habit-calendar__grid">
        {weekDays.map((day) => (
          <div key={day} className="habit-calendar__weekday">
            {day}
          </div>
        ))}

        {Array.from({ length: startingDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="habit-calendar__empty" />
        ))}

        <AnimatePresence mode="wait" initial={false}>
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const dateKey = toDateKey(year, month, day)
            const completed = completedDates.includes(dateKey)
            const isFuture = dateKey > today
            const isToday = dateKey === today
            return (
              <motion.button
                key={`${monthKey}-${day}`}
                type="button"
                disabled={isFuture}
                className={`habit-calendar__day ${isFuture ? 'is-future' : ''} ${isToday ? 'is-today' : ''} ${completed ? 'is-completed' : ''}`}
                style={{
                  background: completed ? accentColor : undefined,
                  boxShadow: isToday ? `0 0 0 2px ${accentColor}` : undefined,
                }}
                onClick={() => void onToggleCompletion(dateKey)}
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: DURATION.base, delay: index * 0.008 }}
                whileHover={!isFuture ? { scale: 1.14 } : {}}
                whileTap={!isFuture ? { scale: 0.88 } : {}}
              >
                {day}
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
