import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { todayDateKey } from '../model/dateKey'

type HabitCalendarProps = {
  completedDates: string[]
  onToggleCompletion: (dateKey: string) => Promise<void>
  accentColor?: string
}

const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

const toDateKey = (year: number, month: number, day: number) => {
  const monthText = `${month + 1}`.padStart(2, '0')
  const dayText = `${day}`.padStart(2, '0')
  return `${year}-${monthText}-${dayText}`
}

export const HabitCalendar = ({ completedDates, onToggleCompletion, accentColor = '#3daa78' }: HabitCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [direction, setDirection] = useState(0)

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
            transition={{ duration: 0.2 }}
          >
            {year}年 {MONTH_NAMES[month]}
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
        {WEEK_DAYS.map((day) => (
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
                transition={{ duration: 0.18, delay: index * 0.008 }}
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
