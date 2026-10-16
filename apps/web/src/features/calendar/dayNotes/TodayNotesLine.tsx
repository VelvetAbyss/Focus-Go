import { Link } from 'react-router-dom'
import { ROUTES } from '../../../app/routes/routes'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useDayNotes } from './useDayNotes'
import './dayNotes.css'

type TodayNotesLineProps = {
  /** Today as YYYY-MM-DD. */
  dayKey: string
  className?: string
}

/**
 * Today's day notes as one line under the dashboard date, linking to the
 * calendar. Nothing when there are none or the calendar's "On dashboard"
 * switch is off.
 */
const TodayNotesLine = ({ dayKey, className }: TodayNotesLineProps) => {
  const { t } = useI18n()
  const { byDate, showOnDashboard } = useDayNotes()
  const notes = byDate.get(dayKey)
  if (!showOnDashboard || !notes) return null
  const text = notes.map((note) => note.text).join(' · ')

  return (
    <Link to={ROUTES.CALENDAR} className={className} title={text} aria-label={t('dashboard.dayNotes.label', { text })}>
      <span className="day-note-fold" aria-hidden="true" />
      <span className="dash-hero__day-notes-text">{text}</span>
    </Link>
  )
}

export default TodayNotesLine
