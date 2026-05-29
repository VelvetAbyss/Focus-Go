import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TripRecord } from '../../../data/models/types'
import type { LifeTranslate } from '../../life/lifeI18n'
import { parseTripDateKey, statusColor } from '../tripData'
import { ink, muted, pf, subtleBorder, tx } from '../ui'

type Props = {
  trips: TripRecord[]
  t: LifeTranslate
  onOpen: (id: string) => void
}

type Span = {
  trip: TripRecord
  start: Date
  end: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const buildSpans = (trips: TripRecord[]): Span[] => {
  const spans: Span[] = []
  for (const trip of trips) {
    const start = parseTripDateKey(trip.startDate)
    if (!start) continue
    const end = parseTripDateKey(trip.endDate) ?? start
    spans.push({ trip, start: startOfDay(start), end: startOfDay(end < start ? start : end) })
  }
  return spans
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const inSpan = (day: Date, span: Span) => day >= span.start && day <= span.end

export const TripsCalendarView = ({ trips, t, onOpen }: Props) => {
  const today = useMemo(() => startOfDay(new Date()), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))

  const spans = useMemo(() => buildSpans(trips), [trips])

  const { weeks, monthLabel } = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const gridStart = new Date(first)
    gridStart.setDate(first.getDate() - first.getDay()) // back to Sunday
    const cells: Date[] = []
    for (let i = 0; i < 42; i += 1) {
      cells.push(startOfDay(new Date(gridStart.getTime() + i * DAY_MS)))
    }
    const rows: Date[][] = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    // Trim trailing empty week (all in next month)
    const trimmed = rows.filter((row) => row.some((d) => d.getMonth() === month) || rows.indexOf(row) < 5)
    return {
      weeks: trimmed,
      monthLabel: cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    }
  }, [cursor])

  const weekdayLabels = useMemo(() => {
    const base = new Date(2023, 0, 1) // a Sunday
    return Array.from({ length: 7 }, (_, i) =>
      new Date(base.getTime() + i * DAY_MS).toLocaleString(undefined, { weekday: 'short' }),
    )
  }, [])

  const goPrev = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
  const goNext = () => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))

  const headBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    border: `1px solid ${subtleBorder}`,
    background: '#FDFAF7',
    borderRadius: 10,
    padding: '6px 10px',
    cursor: 'pointer',
    color: ink,
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ ...pf(22, 600), margin: 0, letterSpacing: '0.01em' }}>{monthLabel}</h2>
        <div style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" style={headBtn} onClick={goPrev} aria-label={t('life.trips.calendar.prev')}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" style={{ ...headBtn, ...tx(12, 600, ink) }} onClick={goToday}>
            {t('life.trips.calendar.today')}
          </button>
          <button type="button" style={headBtn} onClick={goNext} aria-label={t('life.trips.calendar.next')}>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {weekdayLabels.map((label) => (
          <span
            key={label}
            style={{ ...tx(10, 600, muted), textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Weeks */}
      <div style={{ display: 'grid', gap: 6 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {week.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth()
              const isToday = sameDay(day, today)
              const dayer = spans.filter((s) => inSpan(day, s))
              return (
                <div
                  key={day.getTime()}
                  style={{
                    minHeight: 92,
                    borderRadius: 12,
                    border: `1px solid ${isToday ? statusColor('Ongoing').border : subtleBorder}`,
                    background: inMonth ? '#FDFAF7' : 'rgba(58,55,51,0.015)',
                    padding: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    opacity: inMonth ? 1 : 0.55,
                  }}
                >
                  <span
                    style={{
                      ...tx(11, isToday ? 700 : 500, isToday ? ink : muted),
                      alignSelf: 'flex-end',
                    }}
                  >
                    {day.getDate()}
                  </span>
                  <div style={{ display: 'grid', gap: 3 }}>
                    {dayer.map((span) => {
                      const status = statusColor(span.trip.status)
                      const isStart = sameDay(day, span.start)
                      return (
                        <button
                          key={span.trip.id}
                          type="button"
                          onClick={() => onOpen(span.trip.id)}
                          title={span.trip.title}
                          style={{
                            ...tx(10, 600, status.text),
                            textAlign: 'left',
                            border: 'none',
                            cursor: 'pointer',
                            background: `${status.text}14`,
                            borderLeft: `2px solid ${status.text}`,
                            borderRadius: 4,
                            padding: '2px 5px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isStart ? `${span.trip.coverEmoji || '🧭'} ${span.trip.title}` : '·'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {spans.length === 0 ? (
        <p style={{ ...tx(13, 400, muted), textAlign: 'center', margin: '8px 0' }}>{t('life.trips.calendar.empty')}</p>
      ) : null}
    </div>
  )
}

export default TripsCalendarView
