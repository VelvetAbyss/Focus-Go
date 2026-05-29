import { useEffect, useMemo, useRef, useState } from 'react'
import { NewTripPicker, type NewTripChoice } from './NewTripPicker'
import type { CSSProperties } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Circle,
  Globe as GlobeIcon,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Trash2,
  Users,
  Plane,
  Hotel,
  Utensils,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildTripDetailRoute, ROUTES } from '../../app/routes/routes'
import type { TripRecord, TripStatus } from '../../data/models/types'
import { useSyncDataRefresh } from '../../data/sync/service'
import {
  bookingReadiness,
  budgetActualOverrun,
  checklistProgress,
  daysUntilStart,
  fmtUSD,
  readinessTone,
  statusColor,
  tripDuration,
  tripHighlights,
  tripPhase,
  type TripPhase,
} from './tripData'
import { tripsRepo } from './tripsRepo'
import { useLifeI18n } from '../life/lifeI18n'
import AuthInteractionGate from '../auth/AuthInteractionGate'
import { TripsTimelineView } from './views/TripsTimelineView'
import { TripsCalendarView } from './views/TripsCalendarView'
import { TripsAtlasView } from './views/TripsAtlasView'

type ViewMode = 'grid' | 'timeline' | 'calendar' | 'atlas'
type FilterKey = 'all' | 'planning' | 'booked' | 'ongoing' | 'done'

const STORAGE_VIEW_KEY = 'trips_view_mode'
const isViewMode = (value: string | null): value is ViewMode =>
  value === 'grid' || value === 'timeline' || value === 'calendar' || value === 'atlas'

const TripsPage = () => {
  const navigate = useNavigate()
  const { t } = useLifeI18n()
  const [trips, setTrips] = useState<TripRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid'
    const stored = window.localStorage.getItem(STORAGE_VIEW_KEY)
    return isViewMode(stored) ? stored : 'grid'
  })
  const containerRef = useRef<HTMLDivElement>(null)

  const switchView = (next: ViewMode) => {
    setViewMode(next)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_VIEW_KEY, next)
  }

  const statusLabel = (s: TripStatus) => {
    const map: Record<TripStatus, string> = {
      Planning: t('life.trips.status.planning'),
      Booked: t('life.trips.status.booked'),
      Ready: t('life.trips.status.booked'),
      Ongoing: t('life.trips.status.active'),
      Done: t('life.trips.status.completed'),
    }
    return map[s] ?? s
  }

  const loadTrips = async () => {
    setLoading(true)
    try {
      setTrips(await tripsRepo.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTrips()
  }, [])

  useSyncDataRefresh(() => {
    void loadTrips()
  }, ['trips'])

  const [pickerOpen, setPickerOpen] = useState(false)

  const handleCreate = () => {
    setPickerOpen(true)
  }

  const handlePickerChoice = async (choice: NewTripChoice) => {
    setPickerOpen(false)
    setCreating(true)
    try {
      const overrides = choice.kind === 'template'
        ? {
            title: choice.data.title,
            destination: choice.data.destination,
            countryCode: choice.data.countryCode,
            coverEmoji: choice.data.coverEmoji,
            startDate: choice.data.startDate,
            endDate: choice.data.endDate,
            itinerary: choice.data.itinerary,
            budget: choice.data.budget,
            checklist: choice.data.checklist,
            tags: choice.data.tags,
            templateId: choice.data.templateId,
          }
        : undefined
      const created = await tripsRepo.create(overrides as Parameters<typeof tripsRepo.create>[0])
      navigate(buildTripDetailRoute(created.id))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (tripId: string) => {
    if (!window.confirm(t('life.trips.deleteConfirm'))) return
    await tripsRepo.remove(tripId)
    await loadTrips()
  }

  const summary = useMemo(() => {
    let upcoming = 0
    let ongoing = 0
    let past = 0
    trips.forEach((trip) => {
      const phase = tripPhase(trip)
      if (phase === 'ongoing') ongoing += 1
      else if (phase === 'past') past += 1
      else upcoming += 1
    })
    return { total: trips.length, upcoming, ongoing, past }
  }, [trips])

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = { all: trips.length, planning: 0, booked: 0, ongoing: 0, done: 0 }
    trips.forEach((trip) => {
      const phase = tripPhase(trip)
      if (phase === 'ongoing') counts.ongoing += 1
      else if (phase === 'past') counts.done += 1
      else if (trip.status === 'Booked' || trip.status === 'Ready') counts.booked += 1
      else counts.planning += 1
    })
    return counts
  }, [trips])

  const filteredTrips = useMemo(() => {
    if (filter === 'all') return trips
    return trips.filter((trip) => {
      const phase = tripPhase(trip)
      if (filter === 'ongoing') return phase === 'ongoing'
      if (filter === 'done') return phase === 'past'
      if (filter === 'booked') return phase !== 'ongoing' && phase !== 'past' && (trip.status === 'Booked' || trip.status === 'Ready')
      // planning
      return phase !== 'ongoing' && phase !== 'past' && trip.status !== 'Booked' && trip.status !== 'Ready'
    })
  }, [trips, filter])

  const heroTrip = useMemo(() => {
    const upcoming = trips
      .filter((trip) => {
        const phase = tripPhase(trip)
        return phase === 'upcoming' || phase === 'imminent'
      })
      .sort((a, b) => daysUntilStart(a) - daysUntilStart(b))
    return upcoming[0] ?? null
  }, [trips])

  return (
    <div ref={containerRef} className="trips-journal">
      <AuthInteractionGate>
        <div className="trips-journal__inner">
          {/* Header */}
          <header className="trips-journal__header">
            <div>
              <button type="button" className="trips-journal__crumb" onClick={() => navigate(ROUTES.DASHBOARD)}>
                <ArrowLeft size={13} /> {t('life.trips.dashboard')}
              </button>
              <h1 className="trips-journal__title">{t('life.trips.title')}</h1>
              <p className="trips-journal__subtitle">{t('life.trips.description')}</p>
            </div>
            <div className="trips-journal__header-actions">
              <div className="trips-journal__view-switch" role="tablist" aria-label={t('life.trips.title')}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'grid'}
                  className="trips-journal__view-tab"
                  onClick={() => switchView('grid')}
                >
                  <LayoutGrid size={13} /> {t('life.trips.view.grid')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'timeline'}
                  className="trips-journal__view-tab"
                  onClick={() => switchView('timeline')}
                >
                  <ListIcon size={13} /> {t('life.trips.view.timeline')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'calendar'}
                  className="trips-journal__view-tab"
                  onClick={() => switchView('calendar')}
                >
                  <CalendarIcon size={13} /> {t('life.trips.view.calendar')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={viewMode === 'atlas'}
                  className="trips-journal__view-tab"
                  onClick={() => switchView('atlas')}
                >
                  <GlobeIcon size={13} /> {t('life.trips.view.atlas')}
                </button>
              </div>
              <button
                type="button"
                className="trips-journal__new"
                onClick={handleCreate}
                disabled={creating}
              >
                <Plus size={14} />
                {creating ? t('life.trips.creating') : t('life.trips.newTrip')}
              </button>
            </div>
          </header>

          {/* Summary strip */}
          {!loading && trips.length > 0 ? (
            <div className="trips-journal__summary">
              <SummaryCell label={t('life.trips.summary.total')} value={summary.total} />
              <SummaryCell label={t('life.trips.summary.upcoming')} value={summary.upcoming} />
              <SummaryCell label={t('life.trips.summary.ongoing')} value={summary.ongoing} />
              <SummaryCell label={t('life.trips.summary.past')} value={summary.past} />
            </div>
          ) : null}

          {/* Hero — Next departure */}
          {!loading && heroTrip ? <HeroBanner trip={heroTrip} onOpen={() => navigate(buildTripDetailRoute(heroTrip.id))} /> : null}

          {/* Filters */}
          {!loading && trips.length > 0 ? (
            <div className="trips-journal__filters" role="toolbar">
              {(['all', 'planning', 'booked', 'ongoing', 'done'] as FilterKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="trips-journal__filter"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  <span>{t(`life.trips.filter.${key}`)}</span>
                  <span className="trips-journal__filter-count">{filterCounts[key]}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Loading skeleton */}
          {loading ? (
            <div className="trips-journal__grid">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="trips-journal__skeleton" />
              ))}
            </div>
          ) : null}

          {/* Empty */}
          {!loading && trips.length === 0 ? (
            <div className="trips-journal__empty">
              <h2 className="trips-journal__empty-title">{t('life.trips.noTrips')}</h2>
              <p className="trips-journal__empty-desc">{t('life.trips.noTripsDesc')}</p>
              <button type="button" className="trips-journal__empty-cta" onClick={handleCreate} disabled={creating}>
                <Plus size={14} />
                {creating ? t('life.trips.creating') : t('life.trips.createTrip')}
              </button>
            </div>
          ) : null}

          {/* Grid */}
          {!loading && filteredTrips.length > 0 && viewMode === 'grid' ? (
            <div className="trips-journal__grid">
              {filteredTrips.map((trip, i) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  index={i}
                  statusLabel={statusLabel}
                  onOpen={() => navigate(buildTripDetailRoute(trip.id))}
                  onDelete={() => handleDelete(trip.id)}
                  t={t}
                />
              ))}
            </div>
          ) : null}

          {/* Timeline */}
          {!loading && filteredTrips.length > 0 && viewMode === 'timeline' ? (
            <TripsTimelineView trips={filteredTrips} t={t} onOpen={(id) => navigate(buildTripDetailRoute(id))} />
          ) : null}

          {/* Calendar */}
          {!loading && trips.length > 0 && viewMode === 'calendar' ? (
            <TripsCalendarView trips={filteredTrips} t={t} onOpen={(id) => navigate(buildTripDetailRoute(id))} />
          ) : null}

          {/* Atlas */}
          {!loading && trips.length > 0 && viewMode === 'atlas' ? (
            <TripsAtlasView trips={filteredTrips} t={t} onOpen={(id) => navigate(buildTripDetailRoute(id))} />
          ) : null}
        </div>
      </AuthInteractionGate>
      <NewTripPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickerChoice} />
    </div>
  )
}

const SummaryCell = ({ label, value }: { label: string; value: number }) => (
  <div className="trips-journal__summary-cell">
    <span className="trips-journal__summary-label">{label}</span>
    <span className="trips-journal__summary-value">{value}</span>
  </div>
)

const HeroBanner = ({ trip, onOpen }: { trip: TripRecord; onOpen: () => void }) => {
  const { t } = useLifeI18n()
  const days = daysUntilStart(trip)
  const phase = tripPhase(trip)
  const checklist = checklistProgress(trip)
  // Top 3 unfinished checklist items
  const todoItems: { label: string }[] = []
  for (const group of trip.checklist) {
    for (const item of group.items) {
      if (!item.done && todoItems.length < 3) todoItems.push({ label: item.label })
    }
    if (todoItems.length >= 3) break
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }
  return (
    <div role="button" tabIndex={0} className="trips-journal__hero" onClick={onOpen} onKeyDown={onKey} aria-label={trip.title}>
      <div
        className="trips-journal__hero-image"
        style={{ backgroundImage: `url(${trip.heroImage})` } as CSSProperties}
        aria-hidden="true"
      />
      <div className="trips-journal__hero-countdown">
        <span className="trips-journal__hero-eyebrow">{t('life.trips.nextDeparture')}</span>
        <span className="trips-journal__hero-dnumber">
          {days <= 0 ? (
            <>{t('life.trips.countdown.today')}</>
          ) : (
            <>
              <sup>D-</sup>
              {days}
            </>
          )}
        </span>
        <span className="trips-journal__hero-dlabel">
          {phase === 'imminent' ? t('life.trips.status.booked') : t('life.trips.status.planning')}
        </span>
      </div>
      <div className="trips-journal__hero-body">
        <div className="trips-journal__hero-meta">
          <span>{trip.coverEmoji}</span>
          <span>{trip.destination || t('life.trips.destinationPending')}</span>
          <span className="trips-journal__hero-meta-dot" aria-hidden="true" />
          <span>{t('life.trips.daysCount', { count: tripDuration(trip) })}</span>
          <span className="trips-journal__hero-meta-dot" aria-hidden="true" />
          <span>{t('life.trips.travelersCount', { count: trip.travelers })}</span>
        </div>
        <h2 className="trips-journal__hero-title">{trip.title}</h2>
        <p className="trips-journal__hero-dates">
          {trip.startDate}
          {t('life.trips.dateTo')}
          {trip.endDate}
          {checklist.total > 0 ? <> · ◐ {checklist.done}/{checklist.total}</> : null}
        </p>
        {todoItems.length > 0 ? (
          <div className="trips-journal__hero-todos">
            {todoItems.map((item, idx) => (
              <span key={idx} className="trips-journal__hero-todo">
                <Circle size={11} />
                {item.label}
              </span>
            ))}
          </div>
        ) : null}
        <span className="trips-journal__hero-cta">
          {t('life.trips.openWorkspace')} <ArrowRight size={13} />
        </span>
      </div>
    </div>
  )
}

type Translator = ReturnType<typeof useLifeI18n>['t']

const phaseToCountdown = (phase: TripPhase, days: number, t: Translator) => {
  if (phase === 'ongoing') return { label: t('life.trips.countdown.ongoing'), pulse: true }
  if (phase === 'past') return { label: t('life.trips.countdown.ended'), pulse: false }
  if (days <= 0) return { label: t('life.trips.countdown.today'), pulse: false }
  return { label: t('life.trips.countdown.dminus', { count: days }), pulse: false }
}

interface TripCardProps {
  trip: TripRecord
  index: number
  statusLabel: (s: TripStatus) => string
  onOpen: () => void
  onDelete: () => void
  t: Translator
}

const TripCard = ({ trip, index, statusLabel, onOpen, onDelete, t }: TripCardProps) => {
  const phase = tripPhase(trip)
  const days = daysUntilStart(trip)
  const status = statusColor(trip.status)
  const readiness = bookingReadiness(trip)
  const budget = budgetActualOverrun(trip)
  const checklist = checklistProgress(trip)
  const checklistPct = checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : 0
  const highlights = tripHighlights(trip, 2)
  const countdown = phaseToCountdown(phase, days, t)
  const duration = tripDuration(trip)

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }
  return (
    <div
      role="button"
      tabIndex={0}
      className="trips-journal__card"
      style={{ '--tj-card-i': index } as CSSProperties}
      onClick={onOpen}
      onKeyDown={handleKey}
    >
      {/* Hero strip */}
      <div className="trips-journal__card-hero">
        {trip.heroImage ? (
          <img className="trips-journal__card-image" src={trip.heroImage} alt={trip.destination || trip.title} />
        ) : (
          <div className="trips-journal__card-image" style={{ background: 'linear-gradient(135deg, #6E7F73, #3A4A42)' }} />
        )}
        <div className="trips-journal__card-hero-row">
          <span
            className="trips-journal__card-status"
            style={{ color: status.text, borderColor: status.border, background: 'rgba(253,250,247,0.94)' }}
          >
            <span className="trips-journal__card-status-dot" />
            {statusLabel(trip.status)}
          </span>
          <span className="trips-journal__card-countdown" data-phase={phase}>
            {countdown.pulse ? <span className="trips-journal__card-countdown-pulse" aria-hidden="true" /> : null}
            {countdown.label}
          </span>
        </div>
        <button
          type="button"
          className="trips-journal__card-delete"
          aria-label="Delete"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <Trash2 size={13} />
        </button>
        <div className="trips-journal__card-hero-foot">
          <div className="trips-journal__card-place">
            <span className="trips-journal__card-emoji">{trip.coverEmoji}</span>
            <span>{trip.destination || t('life.trips.destinationPending')}</span>
          </div>
          <h3 className="trips-journal__card-title">{trip.title}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="trips-journal__card-body">
        {/* Date row */}
        <div className="trips-journal__row">
          <span className="trips-journal__row-dates">
            <CalendarIcon size={11} style={{ verticalAlign: '-1px', marginRight: 6, opacity: 0.55 }} />
            {trip.startDate} → {trip.endDate}
          </span>
          <span className="trips-journal__row-meta">
            <Users size={11} /> {trip.travelers} · {duration}d
          </span>
        </div>

        {/* Day-density shape */}
        {duration > 0 ? (
          <div className="trips-journal__shape" aria-label={t('life.trips.shape')}>
            {trip.itinerary.map((day) => {
              const density = day.items.length >= 3 ? 'full' : day.items.length >= 1 ? 'mid' : 'low'
              return (
                <span
                  key={day.day}
                  className="trips-journal__shape-bar"
                  data-density={density}
                  title={`Day ${day.day} · ${day.label} (${day.items.length})`}
                />
              )
            })}
          </div>
        ) : null}

        <div className="trips-journal__divider" />

        {/* Readiness */}
        {readiness.transport.total + readiness.stays.total + readiness.food.total > 0 ? (
          <div className="trips-journal__module">
            <div className="trips-journal__module-head">
              <span>{t('life.trips.readiness.title')}</span>
            </div>
            <div className="trips-journal__readiness">
              <ReadinessPill
                icon={<Plane size={11} />}
                cluster={readiness.transport}
                label={t('life.trips.readiness.transport')}
              />
              <ReadinessPill
                icon={<Hotel size={11} />}
                cluster={readiness.stays}
                label={t('life.trips.readiness.stays')}
              />
              <ReadinessPill
                icon={<Utensils size={11} />}
                cluster={readiness.food}
                label={t('life.trips.readiness.food')}
              />
            </div>
          </div>
        ) : null}

        {/* Budget */}
        {budget.planned > 0 ? (
          <div className="trips-journal__module">
            <div className="trips-journal__module-head">
              <span>{t('life.trips.budgetTitle')}</span>
              <span className="trips-journal__module-head-value">{fmtUSD(budget.planned)}</span>
            </div>
            <div className="trips-journal__bar">
              <div
                className="trips-journal__bar-fill"
                data-state={budget.overrun ? 'overrun' : budget.percent >= 100 ? 'complete' : 'partial'}
                style={{ '--bar-pct': `${Math.min(budget.percent, 100)}%` } as CSSProperties}
              />
            </div>
            <div className="trips-journal__bar-foot" data-tone={budget.overrun ? 'overrun' : 'neutral'}>
              <span>
                {budget.overrun
                  ? t('life.trips.budgetOverrun', { amount: fmtUSD(budget.actual - budget.planned).replace('$', '') })
                  : budget.actual > 0
                    ? t('life.trips.budgetUsed', { pct: budget.percent, used: fmtUSD(budget.actual).replace('$', '') })
                    : t('life.trips.budgetUntracked')}
              </span>
            </div>
          </div>
        ) : null}

        {/* Checklist */}
        {checklist.total > 0 ? (
          <div className="trips-journal__module">
            <div className="trips-journal__module-head">
              <span>{t('life.trips.checklistTitle')}</span>
              <span className="trips-journal__module-head-value">
                {checklist.done}/{checklist.total}
              </span>
            </div>
            <div className="trips-journal__bar">
              <div
                className="trips-journal__bar-fill"
                data-state={checklistPct >= 100 ? 'complete' : 'partial'}
                style={{ '--bar-pct': `${checklistPct}%` } as CSSProperties}
              />
            </div>
          </div>
        ) : null}

        {/* Highlights */}
        {highlights.length > 0 ? (
          <div className="trips-journal__module">
            <div className="trips-journal__module-head">
              <span>{t('life.trips.highlightsTitle')}</span>
            </div>
            <div className="trips-journal__highlights">
              {highlights.map((day) => (
                <div className="trips-journal__highlight-row" key={day.day}>
                  <span className="trips-journal__highlight-day">Day {day.day}</span>
                  <span className="trips-journal__highlight-label">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Hover CTA */}
        <span className="trips-journal__card-cta">
          {t('life.trips.openWorkspace')}
        </span>
      </div>
    </div>
  )
}

const ReadinessPill = ({
  icon,
  cluster,
  label,
}: {
  icon: React.ReactNode
  cluster: { confirmed: number; pending: number; total: number }
  label: string
}) => {
  const tone = readinessTone(cluster)
  return (
    <div className="trips-journal__readiness-pill" data-tone={tone}>
      <span className="trips-journal__readiness-row">
        <span aria-hidden="true">{icon}</span>
        <span>
          {cluster.confirmed}/{cluster.total || 0}
        </span>
      </span>
      <span className="trips-journal__readiness-label">{label}</span>
    </div>
  )
}

export default TripsPage
