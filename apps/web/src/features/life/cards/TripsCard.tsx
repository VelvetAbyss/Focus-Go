import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Calendar, ChevronRight, Circle, Clock, MapPin, Sparkles, Users, Wallet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildTripDetailRoute, ROUTES } from '../../../app/routes/routes'
import type { TripRecord } from '../../../data/models/types'
import { useSyncDataRefresh } from '../../../data/sync/service'
import { tripsRepo } from '../../trips/tripsRepo'
import {
  checklistProgress,
  daysUntilStart,
  fmtUSD,
  ongoingMoment,
  statusColor,
  tripDuration,
  tripPhase,
} from '../../trips/tripData'
import { TRIP_TEMPLATES } from '../../trips/templates'
import { useLifeI18n } from '../lifeI18n'

const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const preloadTripsPage = () => import('../../trips/TripsPage')
const preloadTripDetailPage = () => import('../../trips/TripDetailPage')

type Translator = ReturnType<typeof useLifeI18n>['t']

const cardShell: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  borderRadius: 24,
  cursor: 'pointer',
  background: 'var(--bg-elevated)',
  border: '1px solid transparent',
  boxShadow: 'var(--shadow-card)',
  height: '100%',
}

const label10: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'color-mix(in srgb, var(--text-primary) 38%, transparent)',
}

/** Top N unfinished checklist labels across all groups. */
const topTodos = (trip: TripRecord, max: number) => {
  const out: string[] = []
  for (const group of trip.checklist) {
    for (const item of group.items) {
      if (!item.done && out.length < max) out.push(item.label)
    }
    if (out.length >= max) break
  }
  return out
}

/** Progress of the "packing"-flavoured checklist group, falling back to overall. */
const packingProgress = (trip: TripRecord) => {
  const group = trip.checklist.find((g) => /pack|打包|🧳/i.test(`${g.label} ${g.emoji ?? ''}`))
  if (group) {
    const total = group.items.length
    const done = group.items.filter((i) => i.done).length
    return { done, total }
  }
  return checklistProgress(trip)
}

const TripsCard = () => {
  const { t } = useLifeI18n()
  const navigate = useNavigate()
  const [trip, setTrip] = useState<TripRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const prefetchTripsList = () => {
    void preloadTripsPage()
  }
  const prefetchTripDetail = () => {
    void preloadTripDetailPage()
  }

  const tripStatusLabel = (status: TripRecord['status']) =>
    status === 'Planning'
      ? t('life.trips.status.planning')
      : status === 'Booked' || status === 'Ready'
        ? t('life.trips.status.booked')
        : status === 'Ongoing'
          ? t('life.trips.status.active')
          : t('life.trips.status.completed')

  const loadTrip = useCallback(async () => {
    setLoading(true)
    try {
      setTrip(await tripsRepo.getDashboardTrip())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTrip()
  }, [loadTrip])

  useSyncDataRefresh(() => {
    void loadTrip()
  }, ['trips'])

  if (loading) {
    return (
      <div
        className="life-card"
        style={{ ...cardShell, cursor: 'default', padding: 20 }}
      >
        <div className="life-card-loader" data-testid="life-card-loader" aria-hidden="true">
          <div className="life-card-loader__hero" />
          <div className="life-card-loader__lines">
            <span className="life-card-loader__line" />
            <span className="life-card-loader__line" style={{ width: '74%' }} />
            <span className="life-card-loader__line" style={{ width: '52%' }} />
          </div>
          <div className="life-card-loader__stats">
            <span className="life-card-loader__pill" />
            <span className="life-card-loader__pill life-card-loader__pill--short" />
          </div>
        </div>
      </div>
    )
  }

  if (!trip) {
    return <IdleCard t={t} navigate={navigate} prefetch={prefetchTripsList} />
  }

  const sc = statusColor(trip.status)
  const phase = tripPhase(trip)
  const duration = tripDuration(trip)
  const startMonth = months[Number(trip.startDate.split('-')[1])]
  const startDay = Number(trip.startDate.split('-')[2])
  const endDay = Number(trip.endDate.split('-')[2])
  const days = daysUntilStart(trip)

  const open = () => navigate(buildTripDetailRoute(trip.id))

  return (
    <div
      style={cardShell}
      onMouseEnter={prefetchTripDetail}
      onFocus={prefetchTripDetail}
      onPointerDown={prefetchTripDetail}
      onClick={open}
    >
      {/* Hero */}
      <div style={{ position: 'relative', height: 108, overflow: 'hidden' }}>
        {trip.heroImage ? (
          <img
            src={trip.heroImage}
            alt={trip.destination}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.82) saturate(0.75)' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #6E7F73, #3A4A42)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, color-mix(in srgb, var(--text-primary) 10%, transparent) 0%, color-mix(in srgb, var(--text-primary) 55%, transparent) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={10} color="rgba(255,255,255,0.80)" />
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.88)', letterSpacing: '0.04em' }}>{trip.destination}</span>
        </div>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: sc.text, background: 'color-mix(in srgb, var(--bg-elevated) 90%, transparent)', border: `1px solid ${sc.border}`, borderRadius: 999, padding: '3px 8px', backdropFilter: 'blur(4px)' }}>
            {phase === 'ongoing' ? t('life.trips.countdown.ongoing') : phase === 'imminent' ? t('life.trips.countdown.dminus', { count: Math.max(days, 0) }) : tripStatusLabel(trip.status)}
          </span>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 14px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 13 }}>{trip.coverEmoji}</span>
            <span style={label10}>{t('life.card.trips')}</span>
          </div>
          <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2 }}>{trip.title}</h3>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'color-mix(in srgb, var(--text-primary) 38%, transparent)' }}>
          <ChevronRight size={15} />
        </div>
      </div>

      {/* State-specific body */}
      {phase === 'ongoing' ? (
        <OngoingBody trip={trip} t={t} />
      ) : phase === 'imminent' ? (
        <ImminentBody trip={trip} t={t} />
      ) : (
        <DefaultBody trip={trip} t={t} duration={duration} dateRange={`${startMonth} ${startDay} – ${endDay}`} />
      )}
    </div>
  )
}

const OngoingBody = ({ trip, t }: { trip: TripRecord; t: Translator }) => {
  const moment = ongoingMoment(trip)
  const countdownLabel = (() => {
    if (!moment || moment.minutesToNext == null) return null
    const m = moment.minutesToNext
    return m < 60 ? t('life.trips.card.inMinutes', { count: m }) : t('life.trips.card.inHours', { count: Math.round(m / 60) })
  })()

  return (
    <div style={{ padding: '16px 20px', display: 'grid', gap: 12, flex: 1 }}>
      {moment ? (
        <span style={{ ...label10, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{t('life.trips.card.dayOf', { count: moment.dayIndex })}{moment.dayLabel ? ` · ${moment.dayLabel}` : ''}</span>
      ) : null}

      {moment?.current ? (
        <Activity tone="now" badge={t('life.trips.card.now')} item={moment.current} />
      ) : null}

      {moment?.next ? (
        <Activity tone="next" badge={t('life.trips.card.next')} item={moment.next} trailing={countdownLabel} />
      ) : null}

      {!moment?.current && !moment?.next ? (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'color-mix(in srgb, var(--text-primary) 55%, transparent)', margin: 0 }}>{t('life.trips.card.freeDay')}</p>
      ) : null}

      <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#7A3A7A' }}>
        {t('life.trips.card.openTrip')} <ArrowRight size={13} />
      </span>
    </div>
  )
}

const Activity = ({
  tone,
  badge,
  item,
  trailing,
}: {
  tone: 'now' | 'next'
  badge: string
  item: { title: string; location?: unknown; time?: string; startTime?: string }
  trailing?: string | null
}) => {
  const accent = tone === 'now' ? '#7A3A7A' : 'color-mix(in srgb, var(--text-primary) 45%, transparent)'
  const time = item.startTime?.includes('T') ? item.startTime.slice(item.startTime.indexOf('T') + 1, item.startTime.indexOf('T') + 6) : item.time
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ marginTop: 3, width: 7, height: 7, borderRadius: 999, background: accent, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ ...label10, color: accent, letterSpacing: '0.08em' }}>{badge}</span>
          {trailing ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 50%, transparent)' }}>
              <Clock size={10} /> {trailing}
            </span>
          ) : time ? (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{time}</span>
          ) : null}
        </div>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </p>
      </div>
    </div>
  )
}

const ImminentBody = ({ trip, t }: { trip: TripRecord; t: Translator }) => {
  const packing = packingProgress(trip)
  const pct = packing.total === 0 ? 0 : Math.round((packing.done / packing.total) * 100)
  const todos = topTodos(trip, 3)
  return (
    <div style={{ padding: '16px 20px', display: 'grid', gap: 12, flex: 1 }}>
      {/* Packing progress */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 500, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)', letterSpacing: '0.04em' }}>{t('life.trips.card.packing')}</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{packing.done}/{packing.total}</span>
        </div>
        <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: pct === 100 ? '#6EAB7A' : '#E8A85F' }} />
        </div>
      </div>

      {/* Top todos */}
      {todos.length > 0 ? (
        <div style={{ display: 'grid', gap: 6 }}>
          <span style={{ ...label10, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{t('life.trips.card.todo')}</span>
          {todos.map((todo, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'color-mix(in srgb, var(--text-primary) 62%, transparent)' }}>
              <Circle size={9} color="color-mix(in srgb, var(--text-primary) 30%, transparent)" /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo}</span>
            </span>
          ))}
        </div>
      ) : (
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'color-mix(in srgb, var(--text-primary) 55%, transparent)', margin: 0 }}>{t('life.trips.card.allSet')}</p>
      )}

      <span style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: '#B07830' }}>
        {t('life.trips.card.openTrip')} <ArrowRight size={13} />
      </span>
    </div>
  )
}

const DefaultBody = ({ trip, t, duration, dateRange }: { trip: TripRecord; t: Translator; duration: number; dateRange: string }) => {
  const { done, total } = checklistProgress(trip)
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <>
      <div style={{ padding: '16px 20px', display: 'grid', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={11} color="color-mix(in srgb, var(--text-primary) 35%, transparent)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'color-mix(in srgb, var(--text-primary) 60%, transparent)' }}>{dateRange}</span>
          </div>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)' }}>{t('life.trips.days', { count: duration })}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={11} color="color-mix(in srgb, var(--text-primary) 35%, transparent)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'color-mix(in srgb, var(--text-primary) 60%, transparent)' }}>{t('life.trips.travelers', { count: trip.travelers })}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Wallet size={10} color="color-mix(in srgb, var(--text-primary) 35%, transparent)" />
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{fmtUSD(trip.budgetPlanned)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 500, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', letterSpacing: '0.04em' }}>{t('life.trips.checklist')}</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)' }}>{done}/{total}</span>
        </div>
        <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
          <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: progress === 100 ? '#6EAB7A' : 'color-mix(in srgb, var(--text-primary) 35%, transparent)' }} />
        </div>
      </div>
    </>
  )
}

const IdleCard = ({ t, navigate, prefetch }: { t: Translator; navigate: ReturnType<typeof useNavigate>; prefetch: () => void }) => {
  const recs = TRIP_TEMPLATES.slice(0, 3)
  return (
    <div
      style={{ ...cardShell, justifyContent: 'flex-start', gap: 14, padding: 24 }}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      onPointerDown={prefetch}
      onClick={() => navigate(ROUTES.TRIPS)}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ ...label10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} /> {t('life.card.trips')}
        </span>
        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2, margin: 0 }}>{t('life.trips.card.startTemplate')}</h3>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'color-mix(in srgb, var(--text-primary) 52%, transparent)', lineHeight: 1.6, margin: 0 }}>{t('life.trips.emptyDescription')}</p>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ ...label10, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{t('life.trips.card.templates')}</span>
        {recs.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              navigate(ROUTES.TRIPS)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              textAlign: 'left',
              border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
              background: 'var(--bg-elevated)',
              borderRadius: 12,
              padding: '9px 12px',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{tpl.coverEmoji}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.title}</span>
              <span style={{ display: 'block', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'color-mix(in srgb, var(--text-primary) 45%, transparent)' }}>{tpl.destination} · {t('life.trips.days', { count: tpl.days })}</span>
            </span>
            <ArrowRight size={13} color="color-mix(in srgb, var(--text-primary) 35%, transparent)" />
          </button>
        ))}
      </div>
    </div>
  )
}

export default TripsCard
