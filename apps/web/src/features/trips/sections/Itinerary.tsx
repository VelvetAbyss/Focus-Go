import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Clock, GripVertical, MapPin, Plus, Trash2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import type {
  TripItineraryDay,
  TripItineraryItem,
  TripRecord,
} from '../../../data/models/types'
import type { LifeTranslate } from '../../life/lifeI18n'
import { createItineraryDay, createItineraryItem, itineraryTypeOptions } from '../tripEditorModel'
import { itineraryTypeStyle } from '../tripData'
import {
  detectConflicts,
  computeGaps,
  getItemBounds,
  minutesToHHMM,
  moveItem,
  parseHHMM,
} from '../tripScheduling'
import {
  DangerButton,
  Hairline,
  InkButton,
  PaperCard,
  SectionHeading,
  TimelineRail,
  RAIL_HOUR_HEIGHT,
  RAIL_START_HOUR,
  RAIL_END_HOUR,
  inputStyle,
  ink,
  muted,
  pf,
  subtleBorder,
  textareaStyle,
  tx,
} from '../ui'
import { pickMapProvider, type SearchResult } from '../../../lib/maps'
import { ItineraryMapView } from './ItineraryMapView'
import { useTripWeather } from '../useTripWeather'
import type { WeatherDay } from '../../../lib/services/weather'

export type ViewMode = 'list' | 'timeline' | 'map'

export type ItineraryT = LifeTranslate

type Props = {
  trip: TripRecord
  t: ItineraryT
  collapsedDays: number[]
  setCollapsedDays: (updater: (current: number[]) => number[]) => void
  onChange: (days: TripItineraryDay[]) => void
  /** Optional controlled view mode. When omitted, the section manages it internally. */
  view?: ViewMode
  onViewChange?: (view: ViewMode) => void
}

const normalizeDays = (days: TripItineraryDay[]): TripItineraryDay[] =>
  days.map((day, index) => ({
    ...day,
    day: index + 1,
    label: day.label || `Day ${index + 1}`,
  }))

const formatGap = (gapMin: number) => {
  if (gapMin < 60) return `${gapMin}m`
  const h = Math.floor(gapMin / 60)
  const m = gapMin % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const dndItemId = (dayNum: number, itemId: string) => `d${dayNum}:${itemId}`
const parseDndItemId = (id: string): { dayNum: number; itemId: string } | null => {
  const m = id.match(/^d(\d+):(.+)$/)
  if (!m) return null
  return { dayNum: Number(m[1]), itemId: m[2] }
}

const LocationPicker = ({
  initialQuery,
  countryCode,
  onPick,
  onClose,
}: {
  initialQuery: string
  countryCode?: string
  onPick: (result: SearchResult) => void
  onClose: () => void
}) => {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const adapter = useMemo(() => pickMapProvider(countryCode), [countryCode])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    const handle = window.setTimeout(async () => {
      try {
        const found = await adapter.searchPOI(trimmed)
        if (!cancelled) setResults(found)
      } catch {
        if (!cancelled) setError('Search failed — check your connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 380)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, adapter])

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 36,
        right: 0,
        zIndex: 50,
        width: 320,
        background: '#FDFAF7',
        border: `1px solid ${subtleBorder}`,
        borderRadius: 12,
        boxShadow: '0 6px 24px rgba(58,55,51,0.14)',
        padding: 12,
        display: 'grid',
        gap: 10,
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a place (e.g. Tokyo Tower)"
        style={inputStyle}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && results[0]) {
            e.preventDefault()
            onPick(results[0])
          }
        }}
      />
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...tx(11, 500, muted) }}>
          <Loader2 size={12} /> Searching…
        </div>
      ) : null}
      {error ? <div style={{ ...tx(11, 500, '#C05050') }}>{error}</div> : null}
      {!loading && !error && results.length === 0 && query.trim().length >= 2 ? (
        <div style={{ ...tx(11, 500, muted) }}>No results.</div>
      ) : null}
      {results.length > 0 ? (
        <div style={{ display: 'grid', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onPick(r)}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid transparent`,
                background: 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(58,55,51,0.05)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={tx(12, 600, ink)}>{r.name}</div>
              {r.address ? <div style={{ ...tx(11, 400, muted), marginTop: 2 }}>{r.address}</div> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <button
          type="button"
          onClick={onClose}
          style={{ ...tx(11, 600, muted), border: 'none', background: 'transparent', cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

const SortableItemRow = ({
  dayNum,
  item,
  conflicting,
  countryCode,
  onPatch,
  onRemove,
  t,
}: {
  dayNum: number
  item: TripItineraryItem
  conflicting: boolean
  countryCode?: string
  onPatch: (patch: Partial<TripItineraryItem>) => void
  onRemove: () => void
  t: ItineraryT
}) => {
  const sortable = useSortable({ id: dndItemId(dayNum, item.id) })
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable
  const [pickerOpen, setPickerOpen] = useState(false)
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const badge = itineraryTypeStyle(item.type)
  const pinned = item.geo?.lat != null && item.geo?.lng != null
  return (
    <div ref={setNodeRef} style={style}>
      <PaperCard style={{ padding: 14, borderColor: conflicting ? 'rgba(192,80,80,0.45)' : subtleBorder, boxShadow: conflicting ? '0 0 0 1px rgba(192,80,80,0.18)' : undefined }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1.4fr 92px 92px 120px auto', gap: 10, alignItems: 'center' }}>
            <button
              {...attributes}
              {...listeners}
              type="button"
              aria-label="Drag handle"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'grab', color: muted, padding: 0 }}
            >
              <GripVertical size={16} />
            </button>
            <input value={item.title} onChange={(e) => onPatch({ title: e.target.value })} style={inputStyle} placeholder="Activity" />
            <input value={item.startTime ?? ''} onChange={(e) => onPatch({ startTime: e.target.value })} style={inputStyle} placeholder="09:00" aria-label="Start time" />
            <input value={item.endTime ?? ''} onChange={(e) => onPatch({ endTime: e.target.value })} style={inputStyle} placeholder="10:30" aria-label="End time" />
            <select value={item.type} onChange={(e) => onPatch({ type: e.target.value as TripItineraryItem['type'] })} style={inputStyle}>{itineraryTypeOptions.map((typeOpt) => <option key={typeOpt} value={typeOpt}>{typeOpt}</option>)}</select>
            <DangerButton onClick={onRemove}><Trash2 size={14} /> {t('life.trips.detail.remove')}</DangerButton>
          </div>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <input value={item.location} onChange={(e) => onPatch({ location: e.target.value })} style={inputStyle} placeholder="Location" />
            <button
              type="button"
              aria-label="Pick location on map"
              onClick={() => setPickerOpen((v) => !v)}
              style={{
                ...tx(11, 600, pinned ? '#5B8C5A' : ink),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                border: `1px solid ${subtleBorder}`,
                borderRadius: 12,
                background: '#FFFCF9',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <MapPin size={13} />
              {pinned ? 'Pinned' : 'Pin'}
            </button>
            {pickerOpen ? (
              <LocationPicker
                initialQuery={item.location || ''}
                countryCode={countryCode}
                onPick={(result) => {
                  onPatch({
                    location: result.name,
                    geo: { lat: result.position.lat, lng: result.position.lng, address: result.address },
                  })
                  setPickerOpen(false)
                }}
                onClose={() => setPickerOpen(false)}
              />
            ) : null}
          </div>
          <textarea value={item.notes ?? ''} onChange={(e) => onPatch({ notes: e.target.value })} style={textareaStyle} placeholder="Notes" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...tx(10, 600, badge.text), background: badge.bg, borderRadius: 999, padding: '4px 8px', textTransform: 'capitalize', letterSpacing: '0.05em' }}>{item.type}</span>
            {conflicting ? (
              <span style={{ ...tx(10, 600, '#C05050'), display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(192,80,80,0.08)', borderRadius: 999, padding: '4px 8px' }}>
                <AlertTriangle size={11} /> overlaps another activity
              </span>
            ) : null}
          </div>
        </div>
      </PaperCard>
    </div>
  )
}

const GapPill = ({ severity, gapMin }: { severity: 'tight' | 'large'; gapMin: number }) => {
  const tone = severity === 'tight'
    ? { fg: '#A65B2E', bg: 'rgba(166,91,46,0.10)', label: 'Tight transfer' }
    : { fg: '#5C6B8A', bg: 'rgba(92,107,138,0.10)', label: 'Long break — add lunch?' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: tone.bg, alignSelf: 'center', justifySelf: 'center' }}>
      <Clock size={12} color={tone.fg} />
      <span style={{ ...tx(11, 600, tone.fg) }}>{tone.label} · {formatGap(gapMin)}</span>
    </div>
  )
}

const TimelineBlocks = ({ day, conflictIds, onPatch }: { day: TripItineraryDay; conflictIds: Set<string>; onPatch: (itemId: string, patch: Partial<TripItineraryItem>) => void }) => {
  const blocks = day.items
    .map((item) => ({ item, bounds: getItemBounds(item) }))
    .filter((b) => b.bounds.startMin != null)
  return (
    <TimelineRail>
      {blocks.map(({ item, bounds }) => {
        const start = bounds.startMin as number
        const end = bounds.endMin ?? start + 60
        const top = ((start / 60) - RAIL_START_HOUR) * RAIL_HOUR_HEIGHT
        const heightHours = Math.max(0.5, (end - start) / 60)
        const height = heightHours * RAIL_HOUR_HEIGHT
        const badge = itineraryTypeStyle(item.type)
        const conflict = conflictIds.has(item.id)
        return (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: Math.max(0, top),
              height,
              padding: 8,
              borderRadius: 10,
              background: badge.bg,
              border: `1px solid ${conflict ? 'rgba(192,80,80,0.45)' : subtleBorder}`,
              boxShadow: '0 1px 3px rgba(58,55,51,0.06)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            onClick={() => onPatch(item.id, {})}
            title={`${item.title} · ${item.location}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
              <span style={{ ...tx(12, 600, ink), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || '(untitled)'}</span>
              <span style={{ ...tx(10, 500, badge.text), whiteSpace: 'nowrap' }}>{minutesToHHMM(start)} – {minutesToHHMM(end)}</span>
            </div>
            {item.location ? <p style={{ ...tx(11, 400, muted), marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.location}</p> : null}
            {conflict ? <span style={{ ...tx(10, 600, '#C05050') }}>⚠ overlap</span> : null}
          </div>
        )
      })}
    </TimelineRail>
  )
}

const WeatherChip = ({ weather }: { weather: WeatherDay }) => (
  <span
    title={weather.source === 'climate' ? 'Historical climate average' : 'Forecast'}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 999,
      background: 'rgba(124,90,58,0.08)',
      ...tx(11, 600, '#7C5A3A'),
    }}
  >
    <span aria-hidden style={{ fontSize: 13 }}>{weather.icon}</span>
    {weather.tempHigh}°/{weather.tempLow}°
    {weather.source === 'climate' ? <span style={{ ...tx(9, 500, muted), marginLeft: 2 }}>avg</span> : null}
  </span>
)

const DayCard = ({
  day,
  t,
  view,
  countryCode,
  weather,
  collapsed,
  onToggleCollapse,
  onPatchDay,
  onPatchItem,
  onRemoveItem,
  onRemoveDay,
  onAddItem,
}: {
  day: TripItineraryDay
  t: ItineraryT
  view: ViewMode
  countryCode?: string
  weather?: WeatherDay
  collapsed: boolean
  onToggleCollapse: () => void
  onPatchDay: (patch: Partial<TripItineraryDay>) => void
  onPatchItem: (itemId: string, patch: Partial<TripItineraryItem>) => void
  onRemoveItem: (itemId: string) => void
  onRemoveDay: () => void
  onAddItem: () => void
}) => {
  const conflicts = useMemo(() => detectConflicts(day), [day])
  const gaps = useMemo(() => computeGaps(day), [day])
  const conflictIds = useMemo(() => {
    const s = new Set<string>()
    for (const c of conflicts) { s.add(c.a); s.add(c.b) }
    return s
  }, [conflicts])
  const gapsByAfterId = useMemo(() => {
    const m = new Map<string, typeof gaps[number]>()
    for (const g of gaps) if (g.severity !== 'normal') m.set(g.afterItemId, g)
    return m
  }, [gaps])
  const itemIds = day.items.map((it) => dndItemId(day.day, it.id))

  return (
    <PaperCard>
      <button
        type="button"
        onClick={onToggleCollapse}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', border: 'none', background: 'transparent', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(58,55,51,0.07)', ...tx(11, 600) }}>{day.day}</div>
          <div style={{ textAlign: 'left' }}>
            <p style={pf(15, 500)}>{day.label}</p>
            <p style={tx(11, 400, 'rgba(58,55,51,0.40)')}>{day.date || 'Date pending'} · {day.items.length} items{conflicts.length ? ` · ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}` : ''}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {weather ? <WeatherChip weather={weather} /> : null}
          {collapsed ? <ChevronDown size={15} color={muted} /> : <ChevronUp size={15} color={muted} />}
        </div>
      </button>
      {!collapsed ? (
        <>
          <Hairline />
          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 12 }}>
              <input value={day.date} onChange={(e) => onPatchDay({ date: e.target.value })} style={inputStyle} placeholder="2026-04-18" />
              <input value={day.label} onChange={(e) => onPatchDay({ label: e.target.value })} style={inputStyle} placeholder="Day label" />
              <DangerButton onClick={onRemoveDay}><Trash2 size={14} /> {t('life.trips.detail.removeDay')}</DangerButton>
            </div>
            {view === 'timeline' ? (
              <TimelineBlocks day={day} conflictIds={conflictIds} onPatch={onPatchItem} />
            ) : (
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'grid', gap: 10 }}>
                  {day.items.map((item, idx) => {
                    const gap = gapsByAfterId.get(item.id)
                    return (
                      <Renderable key={item.id}>
                        <SortableItemRow
                          dayNum={day.day}
                          item={item}
                          conflicting={conflictIds.has(item.id)}
                          countryCode={countryCode}
                          onPatch={(p) => onPatchItem(item.id, p)}
                          onRemove={() => onRemoveItem(item.id)}
                          t={t}
                        />
                        {idx < day.items.length - 1 && gap ? (
                          <GapPill severity={gap.severity as 'tight' | 'large'} gapMin={gap.gapMin} />
                        ) : null}
                      </Renderable>
                    )
                  })}
                </div>
              </SortableContext>
            )}
            <div><InkButton onClick={onAddItem}><Plus size={14} /> {t('life.trips.detail.addActivity')}</InkButton></div>
          </div>
        </>
      ) : null}
    </PaperCard>
  )
}

const Renderable = ({ children }: { children: ReactNode }) => <div style={{ display: 'grid', gap: 10 }}>{children}</div>

const patchDayItems = (days: TripItineraryDay[], dayNum: number, mapper: (items: TripItineraryItem[]) => TripItineraryItem[]): TripItineraryDay[] =>
  days.map((d) => (d.day === dayNum ? { ...d, items: mapper(d.items) } : d))

/**
 * Itinerary section: list/timeline toggle, dnd-kit cross-day drag, conflict +
 * gap detection. State (collapse, view mode, drag id) lives here; persistence
 * goes through the onChange prop.
 */
export const ItinerarySection = ({ trip, t, collapsedDays, setCollapsedDays, onChange, view: controlledView, onViewChange }: Props) => {
  const [internalView, setInternalView] = useState<ViewMode>('list')
  const view = controlledView ?? internalView
  const setView = (next: ViewMode) => {
    if (onViewChange) onViewChange(next)
    else setInternalView(next)
  }
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const { weatherByDate } = useTripWeather(trip)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id))
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null)
    if (!e.over) return
    const from = parseDndItemId(String(e.active.id))
    const to = parseDndItemId(String(e.over.id))
    if (!from || !to) return
    if (from.dayNum === to.dayNum && from.itemId === to.itemId) return
    const targetDay = trip.itinerary.find((d) => d.day === to.dayNum)
    if (!targetDay) return
    const targetIndex = targetDay.items.findIndex((it) => it.id === to.itemId)
    const safeIndex = targetIndex < 0 ? targetDay.items.length : targetIndex
    onChange(moveItem(trip.itinerary, from, { dayNum: to.dayNum, index: safeIndex }))
  }

  const activeItem = useMemo(() => {
    if (!activeDragId) return null
    const parsed = parseDndItemId(activeDragId)
    if (!parsed) return null
    const d = trip.itinerary.find((dd) => dd.day === parsed.dayNum)
    return d?.items.find((it) => it.id === parsed.itemId) ?? null
  }, [activeDragId, trip.itinerary])

  const onPatchItem = (dayNum: number, itemId: string, patch: Partial<TripItineraryItem>) => {
    // Keep legacy `time` field in sync when startTime/endTime change so existing
    // dashboards / card previews keep working.
    const finalPatch: Partial<TripItineraryItem> = { ...patch }
    if (patch.startTime != null || patch.endTime != null) {
      const day = trip.itinerary.find((d) => d.day === dayNum)
      const current = day?.items.find((it) => it.id === itemId)
      const start = patch.startTime ?? current?.startTime ?? ''
      const end = patch.endTime ?? current?.endTime ?? ''
      const startMin = parseHHMM(start)
      const endMin = parseHHMM(end)
      finalPatch.time = start && end ? `${start} – ${end}` : start || end || ''
      if (startMin != null && endMin != null && endMin > startMin) {
        finalPatch.durationMin = endMin - startMin
      }
    }
    onChange(patchDayItems(trip.itinerary, dayNum, (items) => items.map((it) => (it.id === itemId ? { ...it, ...finalPatch } : it))))
  }

  const totalActivities = trip.itinerary.reduce((sum, day) => sum + day.items.length, 0)
  const totalConflicts = useMemo(
    () => trip.itinerary.reduce((sum, day) => sum + detectConflicts(day).length, 0),
    [trip.itinerary],
  )

  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <SectionHeading
        title={t('life.trips.detail.itinerary')}
        meta={`${trip.itinerary.length} days · ${totalActivities} activities${totalConflicts ? ` · ${totalConflicts} conflict${totalConflicts > 1 ? 's' : ''}` : ''}`}
        action={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ViewToggle value={view} onChange={setView} />
            <InkButton onClick={() => onChange(normalizeDays([...trip.itinerary, createItineraryDay(trip.itinerary.length + 1)]))}>
              <Plus size={14} /> {t('life.trips.detail.addDay')}
            </InkButton>
          </div>
        )}
      />
      {view === 'map' ? (
        <PaperCard style={{ padding: 16 }}>
          <ItineraryMapView trip={trip} />
        </PaperCard>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div style={{ display: view === 'map' ? 'none' : 'grid', gap: 14 }}>
          {trip.itinerary.map((day) => {
            const isCollapsed = collapsedDays.includes(day.day)
            return (
              <DayCard
                key={day.day}
                day={day}
                t={t}
                view={view}
                countryCode={trip.countryCode}
                weather={day.date ? weatherByDate[day.date] : undefined}
                collapsed={isCollapsed}
                onToggleCollapse={() => setCollapsedDays((c) => (c.includes(day.day) ? c.filter((v) => v !== day.day) : [...c, day.day]))}
                onPatchDay={(p) => onChange(trip.itinerary.map((d) => (d.day === day.day ? { ...d, ...p } : d)))}
                onPatchItem={(itemId, p) => onPatchItem(day.day, itemId, p)}
                onRemoveItem={(itemId) => onChange(patchDayItems(trip.itinerary, day.day, (items) => items.filter((it) => it.id !== itemId)))}
                onRemoveDay={() => onChange(normalizeDays(trip.itinerary.filter((d) => d.day !== day.day)))}
                onAddItem={() => onChange(patchDayItems(trip.itinerary, day.day, (items) => [...items, createItineraryItem()]))}
              />
            )
          })}
        </div>
        <DragOverlay>
          {activeItem ? (
            <PaperCard style={{ padding: 12, transform: 'rotate(-1deg)', cursor: 'grabbing', maxWidth: 520 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <ArrowRight size={14} color={muted} />
                <span style={pf(14, 500)}>{activeItem.title || '(untitled)'}</span>
                {activeItem.startTime ? <span style={tx(11, 500, muted)}>{activeItem.startTime}</span> : null}
              </div>
            </PaperCard>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  )
}

const ViewToggle = ({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) => (
  <div style={{ display: 'inline-flex', border: `1px solid ${subtleBorder}`, borderRadius: 999, padding: 2, background: '#FFFCF9' }} role="tablist" aria-label="View mode">
    {(['list', 'timeline', 'map'] as const).map((mode) => {
      const active = mode === value
      return (
        <button
          key={mode}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(mode)}
          style={{
            ...tx(11, 600, active ? ink : muted),
            border: 'none',
            background: active ? 'rgba(58,55,51,0.08)' : 'transparent',
            padding: '6px 12px',
            borderRadius: 999,
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {mode}
        </button>
      )
    })}
  </div>
)

// Touch the imports used elsewhere to avoid tree-shake confusion in dev.
void RAIL_END_HOUR
