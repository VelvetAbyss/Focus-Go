import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { TripUpdateInput } from '@focus-go/core'
import { useLifeI18n } from '../life/lifeI18n'
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CalendarPlus,
  Download,
  FileText,
  Home,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Navigation,
  Plus,
  Sparkles,
  Trash2,
  Utensils,
  Wallet,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { ROUTES } from '../../app/routes/routes'
import type {
  TripBudgetCategory,
  TripChecklistGroup,
  TripFoodItem,
  TripItineraryDay,
  TripRecord,
  TripStayItem,
  TripTransportItem,
} from '../../data/models/types'
import {
  bookingStatusColor,
  budgetActual,
  budgetEstimated,
  checklistProgress,
  foodStatusColor,
  fmtUSD,
  tripDuration,
} from './tripData'
import {
  bookingStatusOptions,
  createBudgetItem,
  createChecklistGroup,
  createChecklistItem,
  createFoodItem,
  createItineraryItem,
  createStayItem,
  createTransportItem,
  foodStatusOptions,
  priceRangeOptions,
  transportCategoryOptions,
  transportMethodOptions,
  tripStatusOptions,
} from './tripEditorModel'
import { budgetBreakdown, splitBudget, tripDays, type BudgetSplit } from './budgetInsights'
import { PACKING_TEMPLATES, mergePackingTemplate } from './packingTemplates'
import { tripsRepo } from './tripsRepo'
import AuthInteractionGate from '../auth/AuthInteractionGate'
import { ItinerarySection, type ViewMode } from './sections/Itinerary'
import { JourneyMode } from './sections/JourneyMode'
import { setTripCommandContext } from './tripCommandRegistry'
import { downloadTripIcs } from './export/ical'
import { exportTripAsPdf } from './export/pdf'
import { isBrokenGeneratedHeroImage, resolveTripHeroImage } from './tripHeroImages'
import {
  AttachmentStrip,
  CHART_PALETTE,
  DangerButton,
  Donut,
  InkButton,
  JournalLabel as Label,
  PaperCard as Card,
  ProgressRing,
  SectionHeading,
  cardBg,
  inputStyle,
  ink,
  muted,
  paper,
  pf,
  skeletonBlock,
  subtleBorder,
  textareaStyle,
  tx,
} from './ui'

type SectionId = 'overview' | 'itinerary' | 'transport' | 'stay' | 'food' | 'budget' | 'checklist' | 'notes'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const numberStyle: CSSProperties = { ...inputStyle }

const ActionButton = ({ children, onClick, danger = false }: { children: ReactNode; onClick?: () => void; danger?: boolean }) =>
  danger ? <DangerButton onClick={onClick}>{children}</DangerButton> : <InkButton onClick={onClick}>{children}</InkButton>

const TripDetailSkeleton = () => (
  <div style={{ display: 'grid', gap: 18 }}>
    <div style={{ display: 'grid', gap: 10, maxWidth: 540 }}>
      <div style={skeletonBlock({ width: 120, height: 12, borderRadius: 999 })} />
      <div style={skeletonBlock({ width: 260, height: 42 })} />
      <div style={skeletonBlock({ width: '100%', height: 14, borderRadius: 999 })} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 18 }}>
      <div style={{ ...skeletonBlock({ minHeight: 520 }), border: `1px solid ${subtleBorder}`, background: cardBg }} />
      <div style={{ display: 'grid', gap: 18 }}>
        <div style={{ ...skeletonBlock({ minHeight: 220 }), border: `1px solid ${subtleBorder}`, background: cardBg }} />
        <div style={{ ...skeletonBlock({ minHeight: 160 }), border: `1px solid ${subtleBorder}`, background: cardBg }} />
        <div style={{ ...skeletonBlock({ minHeight: 160 }), border: `1px solid ${subtleBorder}`, background: cardBg }} />
      </div>
    </div>
  </div>
)


// Card, Hairline, SectionHeading, Label, ActionButton imported from ./ui

// ─── List-mutation helpers ────────────────────────────────────────────────────

/** Patch one item by id in an array. */
function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/** Remove one item by id from an array. */
function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id)
}

/** Patch one item inside a checklist group. */
function patchGroupItem(
  checklist: TripChecklistGroup[],
  groupId: string,
  itemId: string,
  patch: Partial<TripChecklistGroup['items'][number]>,
): TripChecklistGroup[] {
  return checklist.map((g) =>
    g.id === groupId
      ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
      : g,
  )
}

const normalizeDays = (days: TripItineraryDay[]) =>
  days.map((day, index) => ({
    ...day,
    day: index + 1,
    label: day.label || `Day ${index + 1}`,
  }))

const TripDetailPage = () => {
  const navigate = useNavigate()
  const { t } = useLifeI18n()
  const { tripId } = useParams()
  const [trip, setTrip] = useState<TripRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [collapsedDays, setCollapsedDays] = useState<number[]>([])
  const [itineraryView, setItineraryView] = useState<ViewMode>('list')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [budgetSplit, setBudgetSplit] = useState<BudgetSplit>('total')
  const [packMenuOpen, setPackMenuOpen] = useState(false)
  const [journeyOpen, setJourneyOpen] = useState(false)
  const [coverMatchLabel, setCoverMatchLabel] = useState('')

  const sections: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
    { id: 'overview', label: t('life.trips.detail.overview'), icon: <LayoutGrid size={14} /> },
    { id: 'itinerary', label: t('life.trips.detail.itinerary'), icon: <Calendar size={14} /> },
    { id: 'transport', label: t('life.trips.detail.transport'), icon: <Navigation size={14} /> },
    { id: 'stay', label: t('life.trips.detail.stay'), icon: <Home size={14} /> },
    { id: 'food', label: t('life.trips.detail.food'), icon: <Utensils size={14} /> },
    { id: 'budget', label: t('life.trips.detail.budget'), icon: <Wallet size={14} /> },
    { id: 'checklist', label: t('life.trips.checklist'), icon: <List size={14} /> },
    { id: 'notes', label: t('life.trips.detail.notes'), icon: <FileText size={14} /> },
  ]

  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>({
    overview: null,
    itinerary: null,
    transport: null,
    stay: null,
    food: null,
    budget: null,
    checklist: null,
    notes: null,
  })
  const [active, setActive] = useState<SectionId>('overview')
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingPatchRef = useRef<TripUpdateInput>({})
  const autoMatchCoverRef = useRef(false)
  const lastAutoMatchKeyRef = useRef('')


  useEffect(() => {
    const load = async () => {
      if (!tripId) return
      setLoading(true)
      try {
        setTrip(await tripsRepo.getById(tripId))
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [tripId])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const root = containerRef.current ?? null
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const id = visible.target.getAttribute('data-section') as SectionId | null
        if (id) setActive(id)
      },
      { root, rootMargin: '-10% 0px -60% 0px', threshold: [0.1, 0.25, 0.5] },
    )
    Object.values(sectionRefs.current).forEach((node) => { if (node) observer.observe(node) })
    return () => observer.disconnect()
  }, [trip?.id])

  const queuePatch = (patch: TripUpdateInput) => {
    if (!tripId) return
    pendingPatchRef.current = { ...pendingPatchRef.current, ...patch }
    setSaveState('saving')

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      const nextPatch = pendingPatchRef.current
      pendingPatchRef.current = {}
      try {
        const updated = await tripsRepo.update(tripId, nextPatch)
        if (!updated) {
          setSaveState('error')
          return
        }
        setTrip(updated)
        setSaveState('saved')
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current)
        savedTimeoutRef.current = setTimeout(() => setSaveState('idle'), 1200)
      } catch {
        setSaveState('error')
      }
    }, 280)
  }

  const patchTrip = (patch: TripUpdateInput) => {
    setTrip((current) => (current ? { ...current, ...patch } : current))
    queuePatch(patch)
  }

  const applyMatchedCover = () => {
    if (!trip) return
    const match = resolveTripHeroImage(trip.destination, trip.title)
    const matchKey = `${trip.id}:${match.query}`
    lastAutoMatchKeyRef.current = matchKey
    setCoverMatchLabel(match.label)
    if (trip.heroImage !== match.url) {
      patchTrip({ heroImage: match.url })
    }
  }

  const updateDestination = (destination: string) => {
    autoMatchCoverRef.current = true
    patchTrip({ destination })
  }

  const updateTitle = (title: string) => {
    autoMatchCoverRef.current = true
    patchTrip({ title })
  }

  const scrollTo = (id: SectionId) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (!trip) return
    const match = resolveTripHeroImage(trip.destination, trip.title)
    setCoverMatchLabel(match.label)

    if (!autoMatchCoverRef.current && trip.heroImage && !isBrokenGeneratedHeroImage(trip.heroImage)) return

    const matchKey = `${trip.id}:${match.query}`
    if (lastAutoMatchKeyRef.current === matchKey) return

    const timer = window.setTimeout(() => {
      autoMatchCoverRef.current = false
      lastAutoMatchKeyRef.current = matchKey
      if (trip.heroImage !== match.url) {
        patchTrip({ heroImage: match.url })
      }
    }, 520)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.destination, trip?.title])

  const updateItinerary = (days: TripItineraryDay[]) => patchTrip({ itinerary: normalizeDays(days) })

  const deleteTrip = async () => {
    if (!trip) return
    if (!window.confirm(t('life.trips.detail.deleteConfirm'))) return
    await tripsRepo.remove(trip.id)
    navigate(ROUTES.TRIPS)
  }

  const exportPdf = () => {
    if (!trip) return
    void exportTripAsPdf(trip)
  }

  const exportIcal = () => {
    if (!trip) return
    downloadTripIcs(trip)
  }

  const addActivityToDay = (dayNum: number) => {
    if (!trip) return
    setItineraryView('list')
    const days = trip.itinerary.map((d) =>
      d.day === dayNum ? { ...d, items: [...d.items, createItineraryItem()] } : d,
    )
    updateItinerary(days)
    setCollapsedDays((c) => c.filter((v) => v !== dayNum))
    scrollTo('itinerary')
  }
  useEffect(() => {
    if (!trip) return
    setTripCommandContext({
      trip,
      sections: sections.map((s) => ({ id: s.id, label: s.label })),
      scrollToSection: (id) => scrollTo(id as SectionId),
      switchItineraryView: (view) => {
        setItineraryView(view)
        scrollTo('itinerary')
      },
      addActivity: (dayNum) => addActivityToDay(dayNum),
      deleteTrip: () => void deleteTrip(),
      exportPdf,
      exportIcal,
    })
    return () => setTripCommandContext(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip])

  const updateTransport = (transport: TripTransportItem[]) => patchTrip({ transport })
  const updateStays = (stays: TripStayItem[]) => patchTrip({ stays })
  const updateFood = (food: TripFoodItem[]) => patchTrip({ food })
  const updateBudget = (budget: TripBudgetCategory[]) => patchTrip({ budget })
  const updateChecklist = (checklist: TripChecklistGroup[]) => patchTrip({ checklist })

  const duration = useMemo(() => (trip ? tripDuration(trip) : 0), [trip])
  const estimated = useMemo(() => (trip ? budgetEstimated(trip) : 0), [trip])
  const actual = useMemo(() => (trip ? budgetActual(trip) : 0), [trip])
  const progress = useMemo(() => (trip ? checklistProgress(trip) : { done: 0, total: 0 }), [trip])
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const breakdown = useMemo(() => (trip ? budgetBreakdown(trip) : null), [trip])
  const splitDays = useMemo(() => (trip ? tripDays(trip) : 1), [trip])

  const nextActions = useMemo(() => {
    if (!trip) return []
    return [
      !trip.destination && 'Set destination details',
      !trip.stays.some((stay) => stay.status === 'Confirmed') && 'Confirm accommodation',
      trip.transport.some((item) => item.method === 'Flight' && item.status !== 'Confirmed') && 'Confirm flight bookings',
      trip.transport.some((item) => item.status === 'Not booked') && 'Book remaining transport',
      trip.checklist.flatMap((group) => group.items).some((item) => item.label.toLowerCase().includes('visa') && !item.done) && 'Prepare visa documents',
    ].filter(Boolean) as string[]
  }, [trip])

  const pageWrapper: CSSProperties = {
    margin: -18,
    height: 'calc(100% + 36px)',
    minHeight: 'calc(100% + 36px)',
    boxSizing: 'border-box',
    overflowY: 'auto',
    background: paper,
    padding: 46,
  }

  if (loading) {
    return <div ref={containerRef} style={pageWrapper}><TripDetailSkeleton /></div>
  }

  if (!trip) {
    return (
      <div ref={containerRef} style={pageWrapper}>
        <Card style={{ maxWidth: 620, margin: '80px auto 0', padding: 28 }}>
          <h1 style={pf(28, 500)}>{t('life.trips.detail.tripNotFound')}</h1>
          <p style={{ ...tx(13, 400, muted), marginTop: 10 }}>{t('life.trips.detail.tripNotFoundDesc')}</p>
          <div style={{ marginTop: 18 }}>
            <ActionButton onClick={() => navigate(ROUTES.TRIPS)}>
              <ArrowLeft size={14} />
              {t('life.trips.detail.backToTrips')}
            </ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={pageWrapper}>
      <AuthInteractionGate>
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
        <aside style={{ position: 'sticky', top: 46, alignSelf: 'start', background: paper, borderRadius: 18, padding: 18 }}>
          <button type="button" onClick={() => navigate(ROUTES.TRIPS)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, border: 'none', background: 'transparent', cursor: 'pointer', ...tx(12, 500, muted) }}>
            <ArrowLeft size={14} /> {t('life.trips.detail.allTrips')}
          </button>
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...tx(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>{t('life.trips.detail.tripWorkspace')}</p>
            <h1 style={{ ...pf(28, 500), lineHeight: 1.1 }}>{trip.title}</h1>
            <p style={{ ...tx(12, 400, muted), marginTop: 8 }}>{trip.destination || t('life.trips.detail.destinationPending')}</p>
          </div>
          <nav style={{ display: 'grid', gap: 6 }}>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollTo(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: 12,
                  border: '1px solid transparent',
                  background: active === section.id ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
                  color: active === section.id ? ink : muted,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  ...tx(12, active === section.id ? 600 : 500, active === section.id ? ink : muted),
                }}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        <main style={{ display: 'grid', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 22, padding: '18px 22px', boxShadow: '0 1px 6px rgba(0, 0, 0, 0.05)' }}>
            <div>
              <p style={{ ...tx(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>{t('life.trips.detail.tripPlanner')}</p>
              <h2 style={{ ...pf(22, 500) }}>{trip.title}</h2>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{duration}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('life.trips.detail.daysLabel')}</div></div>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{trip.travelers}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('life.trips.detail.travelersLabel')}</div></div>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{progress.done}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{t('life.trips.detail.doneLabel')}</div></div>
              {trip.status === 'Done' ? (
                <InkButton onClick={() => setJourneyOpen(true)} ariaLabel={t('life.trips.journey.open')}>
                  <BookOpen size={14} /> {t('life.trips.journey.open')}
                </InkButton>
              ) : null}
              <div style={{ position: 'relative' }}>
                <InkButton onClick={() => setExportMenuOpen((v) => !v)} ariaLabel={t('life.trips.detail.export')}>
                  <Download size={14} /> {t('life.trips.detail.export')}
                </InkButton>
                {exportMenuOpen ? (
                  <>
                    <div
                      onClick={() => setExportMenuOpen(false)}
                      style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                    />
                    <div
                      role="menu"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        zIndex: 41,
                        minWidth: 200,
                        background: cardBg,
                        border: `1px solid ${subtleBorder}`,
                        borderRadius: 12,
                        boxShadow: '0 12px 32px rgba(40,36,30,0.18)',
                        padding: 6,
                        display: 'grid',
                        gap: 2,
                      }}
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExportMenuOpen(false); exportPdf() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, padding: '9px 10px', textAlign: 'left', ...tx(13, 500, ink) }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <FileText size={14} /> {t('life.trips.detail.exportPdf')}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExportMenuOpen(false); exportIcal() }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 8, padding: '9px 10px', textAlign: 'left', ...tx(13, 500, ink) }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <CalendarPlus size={14} /> {t('life.trips.detail.exportIcal')}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
              <span style={{ ...tx(11, 600, saveState === 'error' ? '#C05050' : ink), minWidth: 62, textAlign: 'right' }}>
                {saveState === 'saving' ? t('life.trips.detail.saving') : saveState === 'saved' ? t('life.trips.detail.saved') : saveState === 'error' ? t('life.trips.detail.retry') : ''}
              </span>
            </div>
          </div>

          <section ref={(node) => { sectionRefs.current.overview = node }} data-section="overview" style={{ display: 'grid', gap: 20 }}>
            <div style={{ position: 'relative', height: 220, borderRadius: 24, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
              {trip.heroImage ? (
                <img src={trip.heroImage} alt={trip.destination || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.78) saturate(0.70)' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'color-mix(in srgb, #F5F3F0 92%, transparent)' }}>
                  <ImageIcon size={42} />
                </div>
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, color-mix(in srgb, var(--text-primary) 65%, transparent) 100%)' }} />
              <div style={{ position: 'absolute', left: 24, bottom: 22 }}>
                <p style={{ ...tx(12, 400, 'rgba(255,255,255,0.72)'), marginBottom: 4 }}>{trip.destination || t('life.trips.detail.destinationPending')}</p>
                <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 30, fontWeight: 500, color: 'rgba(255,255,255,0.96)' }}>{trip.title}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>{t('life.trips.detail.duration')}</p><p style={{ ...tx(28, 600), lineHeight: 1 }}>{duration}<span style={{ ...tx(14, 400, muted) }}> days</span></p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>{t('life.trips.detail.travelersLabel')}</p><p style={{ ...tx(28, 600), lineHeight: 1 }}>{trip.travelers}<span style={{ ...tx(14, 400, muted) }}> pax</span></p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>{t('life.trips.detail.budget')}</p><p style={{ ...tx(22, 600), lineHeight: 1 }}>{fmtUSD(trip.budgetPlanned)}</p><p style={{ ...tx(10, 400, muted), marginTop: 8 }}>{fmtUSD(estimated)} estimated</p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>{t('life.trips.checklist')}</p><p style={{ ...tx(22, 600), lineHeight: 1 }}>{progress.done}<span style={{ ...tx(14, 400, muted) }}>/ {progress.total}</span></p><div style={{ marginTop: 10, height: 4, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}><div style={{ height: '100%', width: `${percent}%`, background: 'var(--text-primary)' }} /></div></Card>
            </div>

            <Card style={{ padding: '20px 22px', display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}><Label>Title</Label><input value={trip.title} onChange={(event) => updateTitle(event.target.value)} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Destination</Label><input value={trip.destination} onChange={(event) => updateDestination(event.target.value)} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Status</Label><select value={trip.status} onChange={(event) => patchTrip({ status: event.target.value as TripRecord['status'] })} style={inputStyle}>{tripStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Start Date</Label><input type="date" value={trip.startDate} onChange={(event) => patchTrip({ startDate: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>End Date</Label><input type="date" value={trip.endDate} onChange={(event) => patchTrip({ endDate: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Travelers</Label><input type="number" min={1} value={trip.travelers} onChange={(event) => patchTrip({ travelers: Math.max(1, Number(event.target.value) || 1) })} style={numberStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Planned Budget</Label><input type="number" min={0} value={trip.budgetPlanned} onChange={(event) => patchTrip({ budgetPlanned: Math.max(0, Number(event.target.value) || 0) })} style={numberStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Cover Emoji</Label><input value={trip.coverEmoji} onChange={(event) => patchTrip({ coverEmoji: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <Label>Cover Image</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', gap: 10, alignItems: 'center', border: `1px solid ${subtleBorder}`, borderRadius: 12, padding: 8, background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)' }}>
                    <div style={{ width: 76, height: 46, borderRadius: 9, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', display: 'grid', placeItems: 'center', color: muted }}>
                      {trip.heroImage ? (
                        <img src={trip.heroImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      ) : (
                        <ImageIcon size={18} />
                      )}
                    </div>
                    <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ ...tx(12, 500, muted), minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{coverMatchLabel || trip.destination || trip.title}</span>
                      <InkButton onClick={applyMatchedCover} style={{ padding: '7px 10px', flexShrink: 0 }} ariaLabel="Auto match cover image">
                        <Sparkles size={13} /> Match
                      </InkButton>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10, flex: 1 }}>
                  <Label>{t('life.trips.detail.nextActions')}</Label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(nextActions.length > 0 ? nextActions : ['Trip is fully shaped.']).map((action) => (
                      <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '12px 14px', background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)', border: `1px solid ${subtleBorder}` }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 36%, transparent)' }} />
                        <span style={tx(13, 400)}>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ActionButton
                  danger
                  onClick={() => void deleteTrip()}
                >
                  <Trash2 size={14} />
                  {t('life.trips.detail.deleteTrip')}
                </ActionButton>
              </div>
            </Card>
          </section>

          <div ref={(node) => { sectionRefs.current.itinerary = node as HTMLElement | null }} data-section="itinerary">
            <ItinerarySection
              trip={trip}
              t={t}
              collapsedDays={collapsedDays}
              setCollapsedDays={setCollapsedDays}
              onChange={updateItinerary}
              view={itineraryView}
              onViewChange={setItineraryView}
            />
          </div>

          <section ref={(node) => { sectionRefs.current.transport = node }} data-section="transport" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title={t('life.trips.detail.transport')} meta={`${trip.transport.length} routes`} action={<ActionButton onClick={() => updateTransport([...trip.transport, createTransportItem()])}><Plus size={14} /> {t('life.trips.detail.addRoute')}</ActionButton>} />
            {trip.transport.map((item) => {
              const sc = bookingStatusColor(item.status)
              const patch = (p: Partial<TripTransportItem>) => updateTransport(patchIn(trip.transport, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(11, 500, sc.text)}>{item.status}</span>
                    <ActionButton danger onClick={() => updateTransport(removeFrom(trip.transport, item.id))}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 140px', gap: 12 }}>
                    <input value={item.from} onChange={(e) => patch({ from: e.target.value })} style={inputStyle} placeholder="From" />
                    <input value={item.to} onChange={(e) => patch({ to: e.target.value })} style={inputStyle} placeholder="To" />
                    <select value={item.method} onChange={(e) => patch({ method: e.target.value as TripTransportItem['method'] })} style={inputStyle}>{transportMethodOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <select value={item.category} onChange={(e) => patch({ category: e.target.value as TripTransportItem['category'] })} style={inputStyle}>{transportCategoryOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <input value={item.date} onChange={(e) => patch({ date: e.target.value })} style={inputStyle} placeholder="Apr 18" />
                    <input value={item.departTime} onChange={(e) => patch({ departTime: e.target.value })} style={inputStyle} placeholder="Depart" />
                    <input value={item.arriveTime} onChange={(e) => patch({ arriveTime: e.target.value })} style={inputStyle} placeholder="Arrive" />
                    <select value={item.status} onChange={(e) => patch({ status: e.target.value as TripTransportItem['status'] })} style={inputStyle}>{bookingStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <input value={item.currency} onChange={(e) => patch({ currency: e.target.value })} style={inputStyle} placeholder="USD" />
                    <input type="number" min={0} value={item.cost} onChange={(e) => patch({ cost: Math.max(0, Number(e.target.value) || 0) })} style={numberStyle} placeholder="Cost" />
                  </div>
                  <textarea value={item.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} style={textareaStyle} placeholder="Notes" />
                  <AttachmentStrip tripId={trip.id} attachmentIds={item.attachmentIds ?? []} onChange={(next) => patch({ attachmentIds: next })} />
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.stay = node }} data-section="stay" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title={t('life.trips.detail.stay')} meta={`${trip.stays.length} accommodation`} action={<ActionButton onClick={() => updateStays([...trip.stays, createStayItem()])}><Plus size={14} /> {t('life.trips.detail.addStay')}</ActionButton>} />
            {trip.stays.map((stay) => {
              const sc = bookingStatusColor(stay.status)
              const patch = (p: Partial<TripStayItem>) => updateStays(patchIn(trip.stays, stay.id, p))
              return (
                <Card key={stay.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(11, 500, sc.text)}>{stay.status}</span>
                    <ActionButton danger onClick={() => updateStays(removeFrom(trip.stays, stay.id))}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 120px 140px', gap: 12 }}>
                    <input value={stay.name} onChange={(e) => patch({ name: e.target.value })} style={inputStyle} placeholder="Stay name" />
                    <input value={stay.checkIn} onChange={(e) => patch({ checkIn: e.target.value })} style={inputStyle} placeholder="Check-in" />
                    <input value={stay.checkOut} onChange={(e) => patch({ checkOut: e.target.value })} style={inputStyle} placeholder="Check-out" />
                    <input type="number" min={1} value={stay.nights} onChange={(e) => patch({ nights: Math.max(1, Number(e.target.value) || 1) })} style={numberStyle} />
                    <select value={stay.status} onChange={(e) => patch({ status: e.target.value as TripStayItem['status'] })} style={inputStyle}>{bookingStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <input value={stay.address} onChange={(e) => patch({ address: e.target.value })} style={{ ...inputStyle, gridColumn: 'span 3' }} placeholder="Address" />
                    <input value={stay.currency} onChange={(e) => patch({ currency: e.target.value })} style={inputStyle} placeholder="USD" />
                    <input type="number" min={0} value={stay.cost} onChange={(e) => patch({ cost: Math.max(0, Number(e.target.value) || 0) })} style={numberStyle} />
                  </div>
                  <textarea value={stay.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} style={textareaStyle} placeholder="Notes" />
                  <AttachmentStrip tripId={trip.id} attachmentIds={stay.attachmentIds ?? []} onChange={(next) => patch({ attachmentIds: next })} />
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.food = node }} data-section="food" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title={t('life.trips.detail.food')} meta={`${trip.food.length} places`} action={<ActionButton onClick={() => updateFood([...trip.food, createFoodItem()])}><Plus size={14} /> {t('life.trips.detail.addPlace')}</ActionButton>} />
            {trip.food.map((item) => {
              const sc = foodStatusColor(item.status)
              const patch = (p: Partial<TripFoodItem>) => updateFood(patchIn(trip.food, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ ...tx(10, 600, sc.text), background: sc.bg, borderRadius: 999, padding: '4px 8px' }}>{item.status}</span>
                    <ActionButton danger onClick={() => updateFood(removeFrom(trip.food, item.id))}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 120px 120px', gap: 12 }}>
                    <input value={item.name} onChange={(e) => patch({ name: e.target.value })} style={inputStyle} placeholder="Place" />
                    <input value={item.area} onChange={(e) => patch({ area: e.target.value })} style={inputStyle} placeholder="Area" />
                    <input value={item.cuisine} onChange={(e) => patch({ cuisine: e.target.value })} style={inputStyle} placeholder="Cuisine" />
                    <select value={item.priceRange} onChange={(e) => patch({ priceRange: e.target.value as TripFoodItem['priceRange'] })} style={inputStyle}>{priceRangeOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    <select value={item.status} onChange={(e) => patch({ status: e.target.value as TripFoodItem['status'] })} style={inputStyle}>{foodStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                  </div>
                  <textarea value={item.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} style={textareaStyle} placeholder="Notes" />
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.budget = node }} data-section="budget" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title={t('life.trips.detail.budget')} meta={`Planned ${fmtUSD(trip.budgetPlanned)} · Actual ${fmtUSD(actual)}`} action={<ActionButton onClick={() => updateBudget([...trip.budget, createBudgetItem()])}><Plus size={14} /> {t('life.trips.detail.addBudgetItem')}</ActionButton>} />
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', borderRadius: 10, width: 'fit-content' }}>
              {([
                ['total', t('life.trips.detail.split.total')],
                ['perPerson', t('life.trips.detail.split.perPerson')],
                ['perDay', t('life.trips.detail.split.perDay')],
              ] as Array<[BudgetSplit, string]>).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setBudgetSplit(key)}
                  style={{
                    ...tx(11, 600, budgetSplit === key ? ink : muted),
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 12px',
                    borderRadius: 7,
                    background: budgetSplit === key ? cardBg : 'transparent',
                    boxShadow: budgetSplit === key ? '0 1px 3px rgba(0, 0, 0, 0.12)' : 'none',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {budgetSplit !== 'total' ? (
              <p style={tx(11, 400, muted)}>
                {budgetSplit === 'perPerson'
                  ? t('life.trips.detail.split.perPersonNote', { count: Math.max(1, trip.travelers) })
                  : t('life.trips.detail.split.perDayNote', { count: splitDays })}
              </p>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {([
                [t('life.trips.detail.planned'), trip.budgetPlanned, ink],
                [t('life.trips.detail.estimated'), estimated, '#2E6EA6'],
                [t('life.trips.detail.actual'), actual, '#3D7A4E'],
                [t('life.trips.detail.remaining'), trip.budgetPlanned - actual, trip.budgetPlanned - actual >= 0 ? ink : '#C05050'],
              ] as Array<[string, number, string]>).map(([label, value, color]) => (
                <Card key={String(label)} style={{ padding: '16px 18px' }}>
                  <p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
                  <p style={{ ...tx(22, 600, color), lineHeight: 1 }}>${Math.round(splitBudget(value, budgetSplit, trip.travelers, splitDays)).toLocaleString()}</p>
                </Card>
              ))}
            </div>
            {breakdown && breakdown.slices.length > 0 ? (
              <Card style={{ padding: 22, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                <Donut
                  segments={breakdown.slices.map((slice, i) => ({ id: slice.id, value: slice.planned, color: CHART_PALETTE[i % CHART_PALETTE.length] }))}
                >
                  <span style={tx(10, 600, muted)}>{t('life.trips.detail.breakdown')}</span>
                  <span style={{ ...pf(22, 600, ink), lineHeight: 1.1 }}>${Math.round(splitBudget(breakdown.planned, budgetSplit, trip.travelers, splitDays)).toLocaleString()}</span>
                </Donut>
                <div style={{ flex: 1, minWidth: 220, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {breakdown.slices.map((slice, i) => (
                      <div key={slice.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_PALETTE[i % CHART_PALETTE.length], flexShrink: 0 }} />
                        <span style={{ ...tx(12, 500, ink), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slice.emoji} {slice.label}</span>
                        <span style={tx(11, 400, muted)}>{Math.round(slice.share * 100)}%</span>
                        <span style={tx(12, 600, ink)}>${Math.round(splitBudget(slice.planned, budgetSplit, trip.travelers, splitDays)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={tx(11, 500, muted)}>{t('life.trips.detail.balance')}</span>
                      <span style={tx(12, 600, breakdown.overrun ? '#C05050' : '#3D7A4E')}>
                        {breakdown.overrun
                          ? t('life.trips.detail.over', { count: Math.round(splitBudget(breakdown.actual - breakdown.planned, budgetSplit, trip.travelers, splitDays)) })
                          : `$${Math.round(splitBudget(breakdown.remaining, budgetSplit, trip.travelers, splitDays)).toLocaleString()} ${t('life.trips.detail.left')}`}
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                      <div style={{ width: `${Math.min(100, breakdown.percent)}%`, height: '100%', background: breakdown.overrun ? '#C05050' : '#5B8C5A', transition: 'width 0.4s ease' }} />
                    </div>
                    {breakdown.overrun ? (
                      <p style={tx(11, 500, '#C05050')}>⚠️ {t('life.trips.detail.overrunWarn', { count: breakdown.percent })}</p>
                    ) : null}
                  </div>
                </div>
              </Card>
            ) : null}
            {trip.budget.map((item) => {
              const patch = (p: Partial<TripBudgetCategory>) => updateBudget(patchIn(trip.budget, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(12, 500)}>{item.label || 'New budget item'}</span>
                    <ActionButton danger onClick={() => updateBudget(removeFrom(trip.budget, item.id))}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 160px 160px', gap: 12 }}>
                    <input value={item.emoji} onChange={(e) => patch({ emoji: e.target.value })} style={inputStyle} placeholder="💸" />
                    <input value={item.label} onChange={(e) => patch({ label: e.target.value })} style={inputStyle} placeholder="Label" />
                    <input type="number" min={0} value={item.planned} onChange={(e) => patch({ planned: Math.max(0, Number(e.target.value) || 0) })} style={numberStyle} placeholder="Planned" />
                    <input type="number" min={0} value={item.actual} onChange={(e) => patch({ actual: Math.max(0, Number(e.target.value) || 0) })} style={numberStyle} placeholder="Actual" />
                  </div>
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.checklist = node }} data-section="checklist" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading
              title={t('life.trips.checklist')}
              meta={`${progress.done} of ${progress.total} complete`}
              action={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <ActionButton onClick={() => setPackMenuOpen((v) => !v)}><Plus size={14} /> {t('life.trips.detail.addPackTemplate')}</ActionButton>
                    {packMenuOpen ? (
                      <>
                        <div onClick={() => setPackMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
                        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 31, background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 12, boxShadow: '0 8px 28px rgba(0, 0, 0, 0.16)', padding: 6, minWidth: 200, display: 'grid', gap: 2 }}>
                          {PACKING_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.id}
                              onClick={() => { updateChecklist(mergePackingTemplate(trip.checklist, tpl)); setPackMenuOpen(false) }}
                              style={{ ...tx(12, 500, ink), display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 10px', borderRadius: 8, textAlign: 'left', width: '100%' }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                            >
                              <span style={{ fontSize: 16 }}>{tpl.emoji}</span>
                              <span style={{ flex: 1 }}>{tpl.label}</span>
                              <span style={tx(10, 400, muted)}>{tpl.items.length}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <ActionButton onClick={() => updateChecklist([...trip.checklist, createChecklistGroup()])}><Plus size={14} /> {t('life.trips.detail.addGroup')}</ActionButton>
                </div>
              }
            />
            <Card style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 22 }}>
              <ProgressRing percent={percent} size={68} thickness={8} color={percent === 100 ? '#3D7A4E' : ink} />
              <div style={{ flex: 1, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <p style={tx(12, 400, muted)}>{t('life.trips.detail.overallProgress')}</p>
                  <p style={tx(12, 600)}>{t('life.trips.detail.packedCount', { done: progress.done, total: progress.total })}</p>
                </div>
                <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}><div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#6EAB7A' : 'var(--text-primary)', transition: 'width 0.4s ease' }} /></div>
              </div>
            </Card>
            {trip.checklist.map((group) => {
              const groupDone = group.items.filter((item) => item.done).length
              const patchG = (p: Partial<TripChecklistGroup>) => updateChecklist(patchIn(trip.checklist, group.id, p))
              return (
                <Card key={group.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 12, alignItems: 'center' }}>
                    <input value={group.emoji} onChange={(e) => patchG({ emoji: e.target.value })} style={inputStyle} />
                    <input value={group.label} onChange={(e) => patchG({ label: e.target.value })} style={inputStyle} />
                    <span style={{ ...tx(10, 500, groupDone === group.items.length ? '#3D7A4E' : muted), background: groupDone === group.items.length ? 'rgba(110,171,122,0.12)' : 'color-mix(in srgb, var(--text-primary) 6%, transparent)', borderRadius: 999, padding: '4px 8px' }}>{groupDone}/{group.items.length}</span>
                    <ActionButton danger onClick={() => updateChecklist(removeFrom(trip.checklist, group.id))}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={item.done} onChange={(e) => updateChecklist(patchGroupItem(trip.checklist, group.id, item.id, { done: e.target.checked }))} />
                      <input value={item.label} onChange={(e) => updateChecklist(patchGroupItem(trip.checklist, group.id, item.id, { label: e.target.value }))} style={inputStyle} placeholder="Checklist item" />
                      <ActionButton danger onClick={() => patchG({ items: group.items.filter((it) => it.id !== item.id) })}><Trash2 size={14} /> {t('life.trips.detail.remove')}</ActionButton>
                    </div>
                  ))}
                  <div><ActionButton onClick={() => patchG({ items: [...group.items, createChecklistItem()] })}><Plus size={14} /> {t('life.trips.detail.addItem')}</ActionButton></div>
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.notes = node }} data-section="notes" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title={t('life.trips.detail.notes')} meta={t('life.trips.detail.tripMemo')} />
            <Card style={{ padding: '22px 24px' }}>
              <textarea value={trip.notes} onChange={(event) => patchTrip({ notes: event.target.value })} style={{ ...textareaStyle, minHeight: 220 }} placeholder="Trip notes in plain text or markdown" />
            </Card>
          </section>
        </main>
      </div>
      {journeyOpen ? (
        <JourneyMode
          trip={trip}
          t={t}
          onPatch={(patch) => patchTrip(patch)}
          onClose={() => setJourneyOpen(false)}
          onExport={exportPdf}
        />
      ) : null}
      </AuthInteractionGate>
    </div>
  )
}

export default TripDetailPage
