import { useMemo } from 'react'
import { ArrowRight, Users } from 'lucide-react'
import type { TripRecord } from '../../../data/models/types'
import type { LifeTranslate } from '../../life/lifeI18n'
import {
  daysUntilStart,
  parseTripDateKey,
  statusColor,
  tripDuration,
  tripPhase,
} from '../tripData'
import { ink, muted, pf, subtleBorder, tx } from '../ui'

type Props = {
  trips: TripRecord[]
  t: LifeTranslate
  onOpen: (id: string) => void
}

type Group = { key: string; label: string; trips: TripRecord[] }

const monthShort = (date: Date) => date.toLocaleString(undefined, { month: 'short' })

const groupByYear = (trips: TripRecord[]): Group[] => {
  const sorted = [...trips].sort((a, b) => {
    const da = parseTripDateKey(a.startDate)?.getTime() ?? -Infinity
    const db = parseTripDateKey(b.startDate)?.getTime() ?? -Infinity
    return db - da
  })
  const groups = new Map<string, TripRecord[]>()
  for (const trip of sorted) {
    const date = parseTripDateKey(trip.startDate)
    const key = date ? String(date.getFullYear()) : 'undated'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(trip)
  }
  return Array.from(groups.entries()).map(([key, list]) => ({
    key,
    label: key === 'undated' ? '—' : key,
    trips: list,
  }))
}

export const TripsTimelineView = ({ trips, t, onOpen }: Props) => {
  const groups = useMemo(() => groupByYear(trips), [trips])

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {groups.map((group) => (
        <section key={group.key} style={{ display: 'grid', gap: 14 }}>
          <h2 style={{ ...pf(22, 600), margin: 0, letterSpacing: '0.01em' }}>{group.label}</h2>
          <div style={{ position: 'relative', display: 'grid', gap: 12, paddingLeft: 4 }}>
            {group.trips.map((trip) => (
              <TimelineRow key={trip.id} trip={trip} t={t} onOpen={() => onOpen(trip.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const TimelineRow = ({ trip, t, onOpen }: { trip: TripRecord; t: LifeTranslate; onOpen: () => void }) => {
  const start = parseTripDateKey(trip.startDate)
  const phase = tripPhase(trip)
  const days = daysUntilStart(trip)
  const status = statusColor(trip.status)
  const duration = tripDuration(trip)

  const countdown =
    phase === 'ongoing'
      ? t('life.trips.countdown.ongoing')
      : phase === 'past'
        ? t('life.trips.countdown.ended')
        : days <= 0
          ? t('life.trips.countdown.today')
          : t('life.trips.countdown.dminus', { count: days })

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={onKey}
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr',
        gap: 16,
        alignItems: 'stretch',
        cursor: 'pointer',
      }}
    >
      {/* Date rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingTop: 6 }}>
        {start ? (
          <>
            <span style={{ ...tx(10, 600, muted), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {monthShort(start)}
            </span>
            <span style={{ ...pf(20, 600) }}>{start.getDate()}</span>
          </>
        ) : (
          <span style={{ ...tx(10, 500, muted), textAlign: 'center' }}>{t('life.trips.timeline.undated')}</span>
        )}
        <span style={{ flex: 1, width: 1, background: subtleBorder, marginTop: 4 }} aria-hidden="true" />
      </div>

      {/* Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          borderRadius: 16,
          border: `1px solid ${subtleBorder}`,
          background: '#FDFAF7',
          padding: '14px 18px',
          boxShadow: '0 1px 2px rgba(58,55,51,0.04)',
        }}
      >
        <span style={{ fontSize: 28, lineHeight: 1 }}>{trip.coverEmoji || '🧭'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ ...pf(16, 600), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {trip.title}
            </h3>
            <span
              style={{
                ...tx(10, 600, status.text),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                border: `1px solid ${status.border}`,
                borderRadius: 999,
                padding: '2px 8px',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 999, background: status.text }} />
              {trip.status}
            </span>
          </div>
          <p style={{ ...tx(12, 400, muted), margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span>{trip.destination || t('life.trips.destinationPending')}</span>
            <span aria-hidden="true">·</span>
            <span>{trip.startDate}{t('life.trips.dateTo')}{trip.endDate}</span>
            {duration > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={11} /> {trip.travelers} · {duration}d
                </span>
              </>
            ) : null}
          </p>
        </div>
        <span
          style={{
            ...tx(11, 600, phase === 'ongoing' ? '#5B8C5A' : ink),
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {countdown}
          <ArrowRight size={13} color={muted} />
        </span>
      </div>
    </div>
  )
}

export default TripsTimelineView
