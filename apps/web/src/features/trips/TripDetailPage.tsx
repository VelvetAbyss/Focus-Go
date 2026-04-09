import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { TripUpdateInput } from '@focus-go/core'
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  ChevronUp,
  FileText,
  Home,
  LayoutGrid,
  List,
  Navigation,
  Plus,
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
  TripItineraryItem,
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
  itineraryTypeStyle,
  tripDuration,
} from './tripData'
import {
  bookingStatusOptions,
  createBudgetItem,
  createChecklistGroup,
  createChecklistItem,
  createFoodItem,
  createItineraryDay,
  createItineraryItem,
  createStayItem,
  createTransportItem,
  foodStatusOptions,
  itineraryTypeOptions,
  priceRangeOptions,
  transportCategoryOptions,
  transportMethodOptions,
  tripStatusOptions,
} from './tripEditorModel'
import { tripsRepo } from './tripsRepo'

type SectionId = 'overview' | 'itinerary' | 'transport' | 'stay' | 'food' | 'budget' | 'checklist' | 'notes'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const paper = '#F5F3F0'
const cardBg = '#FDFAF7'
const ink = '#3A3733'
const muted = 'rgba(58,55,51,0.45)'
const subtleBorder = 'rgba(58,55,51,0.09)'

const tx = (size = 13, weight = 400, color = ink): CSSProperties => ({ fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: weight, color })
const pf = (size = 16, weight = 500, color = ink): CSSProperties => ({ fontFamily: 'Playfair Display, serif', fontSize: size, fontWeight: weight, color })

const inputStyle: CSSProperties = { width: '100%', borderRadius: 12, border: `1px solid ${subtleBorder}`, background: '#FFFCF9', padding: '10px 12px', outline: 'none', ...tx(13, 400) }
const textareaStyle: CSSProperties = { ...inputStyle, minHeight: 88, resize: 'vertical' }
const numberStyle: CSSProperties = { ...inputStyle }

const skeletonBlock = (style?: CSSProperties): CSSProperties => ({
  borderRadius: 18,
  background: 'linear-gradient(90deg, rgba(58,55,51,0.05) 0%, rgba(58,55,51,0.11) 50%, rgba(58,55,51,0.05) 100%)',
  backgroundSize: '200% 100%',
  animation: 'life-loader-shimmer 1.35s ease-in-out infinite',
  ...style,
})

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

const sections: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid size={14} /> },
  { id: 'itinerary', label: 'Itinerary', icon: <Calendar size={14} /> },
  { id: 'transport', label: 'Transport', icon: <Navigation size={14} /> },
  { id: 'stay', label: 'Stay', icon: <Home size={14} /> },
  { id: 'food', label: 'Food', icon: <Utensils size={14} /> },
  { id: 'budget', label: 'Budget', icon: <Wallet size={14} /> },
  { id: 'checklist', label: 'Checklist', icon: <List size={14} /> },
  { id: 'notes', label: 'Notes', icon: <FileText size={14} /> },
]

const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 16, boxShadow: '0 1px 6px rgba(58,55,51,0.05)', ...style }}>{children}</div>
)

const Hairline = () => <div style={{ height: 1, background: subtleBorder }} />

const SectionHeading = ({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <h2 style={pf(22, 500)}>{title}</h2>
      {meta ? <p style={{ ...tx(12, 400, muted), marginTop: 6 }}>{meta}</p> : null}
    </div>
    {action}
  </div>
)

const Label = ({ children }: { children: ReactNode }) => <span style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>{children}</span>

const ActionButton = ({ children, onClick, danger = false }: { children: ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      border: `1px solid ${danger ? 'rgba(192,80,80,0.22)' : subtleBorder}`,
      background: danger ? 'rgba(192,80,80,0.08)' : '#FFFCF9',
      padding: '9px 12px',
      cursor: 'pointer',
      ...tx(12, 600, danger ? '#C05050' : ink),
    }}
  >
    {children}
  </button>
)

// ─── List-mutation helpers ────────────────────────────────────────────────────

/** Patch one item by id in an array. */
function patchIn<T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item))
}

/** Remove one item by id from an array. */
function removeFrom<T extends { id: string }>(list: T[], id: string): T[] {
  return list.filter((item) => item.id !== id)
}

/** Patch top-level fields on an itinerary day. */
function patchDay(days: TripItineraryDay[], dayNum: number, patch: Partial<TripItineraryDay>): TripItineraryDay[] {
  return days.map((d) => (d.day === dayNum ? { ...d, ...patch } : d))
}

/** Patch one activity inside a specific itinerary day. */
function patchDayItem(days: TripItineraryDay[], dayNum: number, itemId: string, patch: Partial<TripItineraryItem>): TripItineraryDay[] {
  return days.map((d) =>
    d.day === dayNum
      ? { ...d, items: d.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
      : d,
  )
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
  const { tripId } = useParams()
  const [trip, setTrip] = useState<TripRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [collapsedDays, setCollapsedDays] = useState<number[]>([])
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

  const scrollTo = (id: SectionId) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const updateItinerary = (days: TripItineraryDay[]) => patchTrip({ itinerary: normalizeDays(days) })
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
    height: 'calc(100vh - 40px)',
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
          <h1 style={pf(28, 500)}>Trip not found</h1>
          <p style={{ ...tx(13, 400, muted), marginTop: 10 }}>This trip was removed or the link is no longer valid.</p>
          <div style={{ marginTop: 18 }}>
            <ActionButton onClick={() => navigate(ROUTES.TRIPS)}>
              <ArrowLeft size={14} />
              Back to Trips
            </ActionButton>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={pageWrapper}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 24, maxWidth: 1480, margin: '0 auto' }}>
        <aside style={{ position: 'sticky', top: 24, alignSelf: 'start', background: paper, borderRadius: 18, padding: 18 }}>
          <button type="button" onClick={() => navigate(ROUTES.TRIPS)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, border: 'none', background: 'transparent', cursor: 'pointer', ...tx(12, 500, muted) }}>
            <ArrowLeft size={14} /> All Trips
          </button>
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...tx(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>Trip Workspace</p>
            <h1 style={{ ...pf(28, 500), lineHeight: 1.1 }}>{trip.title}</h1>
            <p style={{ ...tx(12, 400, muted), marginTop: 8 }}>{trip.destination || 'Destination pending'}</p>
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
                  background: active === section.id ? 'rgba(58,55,51,0.08)' : 'transparent',
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, background: cardBg, border: `1px solid ${subtleBorder}`, borderRadius: 22, padding: '18px 22px', boxShadow: '0 1px 6px rgba(58,55,51,0.05)' }}>
            <div>
              <p style={{ ...tx(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>Trip planner</p>
              <h2 style={{ ...pf(22, 500) }}>{trip.title}</h2>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{duration}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>Days</div></div>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{trip.travelers}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>Travelers</div></div>
              <div><div style={{ ...tx(28, 600), lineHeight: 1 }}>{progress.done}</div><div style={{ ...tx(10, 600, muted), letterSpacing: '0.08em', textTransform: 'uppercase' }}>Done</div></div>
              <span style={{ ...tx(11, 600, saveState === 'error' ? '#C05050' : ink), minWidth: 62, textAlign: 'right' }}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry' : ''}
              </span>
            </div>
          </div>

          <section ref={(node) => { sectionRefs.current.overview = node }} data-section="overview" style={{ display: 'grid', gap: 20 }}>
            <div style={{ position: 'relative', height: 220, borderRadius: 24, overflow: 'hidden' }}>
              <img src={trip.heroImage} alt={trip.destination || trip.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.78) saturate(0.70)' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(58,55,51,0.65) 100%)' }} />
              <div style={{ position: 'absolute', left: 24, bottom: 22 }}>
                <p style={{ ...tx(12, 400, 'rgba(255,255,255,0.72)'), marginBottom: 4 }}>{trip.destination || 'Destination pending'}</p>
                <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 30, fontWeight: 500, color: 'rgba(255,255,255,0.96)' }}>{trip.title}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>Duration</p><p style={{ ...tx(28, 600), lineHeight: 1 }}>{duration}<span style={{ ...tx(14, 400, muted) }}> days</span></p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>Travelers</p><p style={{ ...tx(28, 600), lineHeight: 1 }}>{trip.travelers}<span style={{ ...tx(14, 400, muted) }}> pax</span></p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>Budget</p><p style={{ ...tx(22, 600), lineHeight: 1 }}>{fmtUSD(trip.budgetPlanned)}</p><p style={{ ...tx(10, 400, muted), marginTop: 8 }}>{fmtUSD(estimated)} estimated</p></Card>
              <Card style={{ padding: '18px 20px' }}><p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 8 }}>Checklist</p><p style={{ ...tx(22, 600), lineHeight: 1 }}>{progress.done}<span style={{ ...tx(14, 400, muted) }}>/ {progress.total}</span></p><div style={{ marginTop: 10, height: 4, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.08)' }}><div style={{ height: '100%', width: `${percent}%`, background: '#3A3733' }} /></div></Card>
            </div>

            <Card style={{ padding: '20px 22px', display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                <div style={{ display: 'grid', gap: 6 }}><Label>Title</Label><input value={trip.title} onChange={(event) => patchTrip({ title: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Destination</Label><input value={trip.destination} onChange={(event) => patchTrip({ destination: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Status</Label><select value={trip.status} onChange={(event) => patchTrip({ status: event.target.value as TripRecord['status'] })} style={inputStyle}>{tripStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Start Date</Label><input type="date" value={trip.startDate} onChange={(event) => patchTrip({ startDate: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>End Date</Label><input type="date" value={trip.endDate} onChange={(event) => patchTrip({ endDate: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Travelers</Label><input type="number" min={1} value={trip.travelers} onChange={(event) => patchTrip({ travelers: Math.max(1, Number(event.target.value) || 1) })} style={numberStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Planned Budget</Label><input type="number" min={0} value={trip.budgetPlanned} onChange={(event) => patchTrip({ budgetPlanned: Math.max(0, Number(event.target.value) || 0) })} style={numberStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Cover Emoji</Label><input value={trip.coverEmoji} onChange={(event) => patchTrip({ coverEmoji: event.target.value })} style={inputStyle} /></div>
                <div style={{ display: 'grid', gap: 6 }}><Label>Hero Image</Label><input value={trip.heroImage} onChange={(event) => patchTrip({ heroImage: event.target.value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'grid', gap: 10, flex: 1 }}>
                  <Label>Next Actions</Label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {(nextActions.length > 0 ? nextActions : ['Trip is fully shaped.']).map((action) => (
                      <div key={action} style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '12px 14px', background: 'rgba(58,55,51,0.03)', border: `1px solid ${subtleBorder}` }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: 'rgba(58,55,51,0.36)' }} />
                        <span style={tx(13, 400)}>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <ActionButton
                  danger
                  onClick={async () => {
                    if (!window.confirm('Delete this trip?')) return
                    await tripsRepo.remove(trip.id)
                    navigate(ROUTES.TRIPS)
                  }}
                >
                  <Trash2 size={14} />
                  Delete Trip
                </ActionButton>
              </div>
            </Card>
          </section>

          <section ref={(node) => { sectionRefs.current.itinerary = node }} data-section="itinerary" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title="Itinerary" meta={`${trip.itinerary.length} days · ${trip.itinerary.reduce((sum, day) => sum + day.items.length, 0)} activities`} action={<ActionButton onClick={() => updateItinerary([...trip.itinerary, createItineraryDay(trip.itinerary.length + 1)])}><Plus size={14} /> Add Day</ActionButton>} />
            {trip.itinerary.map((day) => {
              const isCollapsed = collapsedDays.includes(day.day)
              const patchD = (p: Partial<TripItineraryDay>) => updateItinerary(patchDay(trip.itinerary, day.day, p))
              const patchItem = (itemId: string, p: Partial<TripItineraryItem>) =>
                updateItinerary(patchDayItem(trip.itinerary, day.day, itemId, p))
              return (
                <Card key={day.day}>
                  <button
                    type="button"
                    onClick={() => setCollapsedDays((c) => c.includes(day.day) ? c.filter((v) => v !== day.day) : [...c, day.day])}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(58,55,51,0.07)', ...tx(11, 600) }}>{day.day}</div>
                      <div style={{ textAlign: 'left' }}>
                        <p style={pf(15, 500)}>{day.label}</p>
                        <p style={tx(11, 400, 'rgba(58,55,51,0.40)')}>{day.date || 'Date pending'} · {day.items.length} items</p>
                      </div>
                    </div>
                    {isCollapsed ? <ChevronDown size={15} color={muted} /> : <ChevronUp size={15} color={muted} />}
                  </button>
                  {!isCollapsed ? (
                    <>
                      <Hairline />
                      <div style={{ padding: 20, display: 'grid', gap: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 12 }}>
                          <input value={day.date} onChange={(e) => patchD({ date: e.target.value })} style={inputStyle} placeholder="Apr 18" />
                          <input value={day.label} onChange={(e) => patchD({ label: e.target.value })} style={inputStyle} placeholder="Day label" />
                          <ActionButton danger onClick={() => updateItinerary(normalizeDays(trip.itinerary.filter((d) => d.day !== day.day)))}><Trash2 size={14} /> Remove Day</ActionButton>
                        </div>
                        {day.items.map((item) => {
                          const badge = itineraryTypeStyle(item.type)
                          return (
                            <Card key={item.id} style={{ padding: 14 }}>
                              <div style={{ display: 'grid', gap: 10 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 120px 120px auto', gap: 10 }}>
                                  <input value={item.title} onChange={(e) => patchItem(item.id, { title: e.target.value })} style={inputStyle} placeholder="Activity" />
                                  <input value={item.time} onChange={(e) => patchItem(item.id, { time: e.target.value })} style={inputStyle} placeholder="09:00" />
                                  <select value={item.type} onChange={(e) => patchItem(item.id, { type: e.target.value as TripItineraryItem['type'] })} style={inputStyle}>{itineraryTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                                  <ActionButton danger onClick={() => patchD({ items: day.items.filter((it) => it.id !== item.id) })}><Trash2 size={14} /> Remove</ActionButton>
                                </div>
                                <input value={item.location} onChange={(e) => patchItem(item.id, { location: e.target.value })} style={inputStyle} placeholder="Location" />
                                <textarea value={item.notes ?? ''} onChange={(e) => patchItem(item.id, { notes: e.target.value })} style={textareaStyle} placeholder="Notes" />
                                <span style={{ ...tx(10, 600, badge.text), background: badge.bg, borderRadius: 999, padding: '4px 8px', alignSelf: 'start', textTransform: 'capitalize', letterSpacing: '0.05em' }}>{item.type}</span>
                              </div>
                            </Card>
                          )
                        })}
                        <div><ActionButton onClick={() => patchD({ items: [...day.items, createItineraryItem()] })}><Plus size={14} /> Add Activity</ActionButton></div>
                      </div>
                    </>
                  ) : null}
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.transport = node }} data-section="transport" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title="Transport" meta={`${trip.transport.length} routes`} action={<ActionButton onClick={() => updateTransport([...trip.transport, createTransportItem()])}><Plus size={14} /> Add Route</ActionButton>} />
            {trip.transport.map((item) => {
              const sc = bookingStatusColor(item.status)
              const patch = (p: Partial<TripTransportItem>) => updateTransport(patchIn(trip.transport, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(11, 500, sc.text)}>{item.status}</span>
                    <ActionButton danger onClick={() => updateTransport(removeFrom(trip.transport, item.id))}><Trash2 size={14} /> Remove</ActionButton>
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
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.stay = node }} data-section="stay" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title="Stay" meta={`${trip.stays.length} accommodation`} action={<ActionButton onClick={() => updateStays([...trip.stays, createStayItem()])}><Plus size={14} /> Add Stay</ActionButton>} />
            {trip.stays.map((stay) => {
              const sc = bookingStatusColor(stay.status)
              const patch = (p: Partial<TripStayItem>) => updateStays(patchIn(trip.stays, stay.id, p))
              return (
                <Card key={stay.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(11, 500, sc.text)}>{stay.status}</span>
                    <ActionButton danger onClick={() => updateStays(removeFrom(trip.stays, stay.id))}><Trash2 size={14} /> Remove</ActionButton>
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
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.food = node }} data-section="food" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title="Food" meta={`${trip.food.length} places`} action={<ActionButton onClick={() => updateFood([...trip.food, createFoodItem()])}><Plus size={14} /> Add Place</ActionButton>} />
            {trip.food.map((item) => {
              const sc = foodStatusColor(item.status)
              const patch = (p: Partial<TripFoodItem>) => updateFood(patchIn(trip.food, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ ...tx(10, 600, sc.text), background: sc.bg, borderRadius: 999, padding: '4px 8px' }}>{item.status}</span>
                    <ActionButton danger onClick={() => updateFood(removeFrom(trip.food, item.id))}><Trash2 size={14} /> Remove</ActionButton>
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
            <SectionHeading title="Budget" meta={`Planned ${fmtUSD(trip.budgetPlanned)} · Actual ${fmtUSD(actual)}`} action={<ActionButton onClick={() => updateBudget([...trip.budget, createBudgetItem()])}><Plus size={14} /> Add Budget Item</ActionButton>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              {[
                ['Planned', trip.budgetPlanned, ink],
                ['Estimated', estimated, '#2E6EA6'],
                ['Actual', actual, '#3D7A4E'],
                ['Remaining', trip.budgetPlanned - actual, trip.budgetPlanned - actual >= 0 ? ink : '#C05050'],
              ].map(([label, value, color]) => (
                <Card key={String(label)} style={{ padding: '16px 18px' }}>
                  <p style={{ ...tx(10, 600, muted), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
                  <p style={{ ...tx(22, 600, color as string), lineHeight: 1 }}>${Number(value).toLocaleString()}</p>
                </Card>
              ))}
            </div>
            {trip.budget.map((item) => {
              const patch = (p: Partial<TripBudgetCategory>) => updateBudget(patchIn(trip.budget, item.id, p))
              return (
                <Card key={item.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={tx(12, 500)}>{item.label || 'New budget item'}</span>
                    <ActionButton danger onClick={() => updateBudget(removeFrom(trip.budget, item.id))}><Trash2 size={14} /> Remove</ActionButton>
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
            <SectionHeading title="Checklist" meta={`${progress.done} of ${progress.total} complete`} action={<ActionButton onClick={() => updateChecklist([...trip.checklist, createChecklistGroup()])}><Plus size={14} /> Add Group</ActionButton>} />
            <Card style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={tx(12, 400, muted)}>Overall progress</p>
                <p style={tx(12, 600)}>{percent}%</p>
              </div>
              <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.08)' }}><div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#6EAB7A' : '#3A3733' }} /></div>
            </Card>
            {trip.checklist.map((group) => {
              const groupDone = group.items.filter((item) => item.done).length
              const patchG = (p: Partial<TripChecklistGroup>) => updateChecklist(patchIn(trip.checklist, group.id, p))
              return (
                <Card key={group.id} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr auto auto', gap: 12, alignItems: 'center' }}>
                    <input value={group.emoji} onChange={(e) => patchG({ emoji: e.target.value })} style={inputStyle} />
                    <input value={group.label} onChange={(e) => patchG({ label: e.target.value })} style={inputStyle} />
                    <span style={{ ...tx(10, 500, groupDone === group.items.length ? '#3D7A4E' : muted), background: groupDone === group.items.length ? 'rgba(110,171,122,0.12)' : 'rgba(58,55,51,0.06)', borderRadius: 999, padding: '4px 8px' }}>{groupDone}/{group.items.length}</span>
                    <ActionButton danger onClick={() => updateChecklist(removeFrom(trip.checklist, group.id))}><Trash2 size={14} /> Remove</ActionButton>
                  </div>
                  {group.items.map((item) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, alignItems: 'center' }}>
                      <input type="checkbox" checked={item.done} onChange={(e) => updateChecklist(patchGroupItem(trip.checklist, group.id, item.id, { done: e.target.checked }))} />
                      <input value={item.label} onChange={(e) => updateChecklist(patchGroupItem(trip.checklist, group.id, item.id, { label: e.target.value }))} style={inputStyle} placeholder="Checklist item" />
                      <ActionButton danger onClick={() => patchG({ items: group.items.filter((it) => it.id !== item.id) })}><Trash2 size={14} /> Remove</ActionButton>
                    </div>
                  ))}
                  <div><ActionButton onClick={() => patchG({ items: [...group.items, createChecklistItem()] })}><Plus size={14} /> Add Item</ActionButton></div>
                </Card>
              )
            })}
          </section>

          <section ref={(node) => { sectionRefs.current.notes = node }} data-section="notes" style={{ display: 'grid', gap: 14 }}>
            <SectionHeading title="Notes" meta="Trip memo" />
            <Card style={{ padding: '22px 24px' }}>
              <textarea value={trip.notes} onChange={(event) => patchTrip({ notes: event.target.value })} style={{ ...textareaStyle, minHeight: 220 }} placeholder="Trip notes in plain text or markdown" />
            </Card>
          </section>
        </main>
      </div>
    </div>
  )
}

export default TripDetailPage
