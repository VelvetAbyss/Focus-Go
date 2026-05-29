import { useMemo, useState } from 'react'
import type { TripItineraryDay, TripRecord } from '../../../data/models/types'
import { pickMapProvider, type MapMarker, type MapRoute } from '../../../lib/maps'
import { itineraryTypeStyle } from '../tripData'
import { EmptyJournal, InkButton, JournalLabel, ink, muted, subtleBorder, tx } from '../ui'

const DAY_PALETTE = [
  '#7C5A3A', // accent brown
  '#3D6B5C',
  '#3D5A8C',
  '#A65B2E',
  '#5C5246',
  '#8C5A8E',
  '#5E8C5A',
]

const dayColor = (index: number) => DAY_PALETTE[index % DAY_PALETTE.length]

type Props = {
  trip: TripRecord
}

const collectMarkers = (day: TripItineraryDay, color: string): MapMarker[] =>
  day.items
    .filter((it) => it.geo?.lat != null && it.geo?.lng != null)
    .map((it) => ({
      id: it.id,
      position: { lat: it.geo!.lat!, lng: it.geo!.lng! },
      label: `${it.title || '(untitled)'}${it.location ? ` — ${it.location}` : ''}`,
      color,
      icon: itineraryTypeStyle(it.type).text,
    }))

export const ItineraryMapView = ({ trip }: Props) => {
  const adapter = useMemo(() => pickMapProvider(trip.countryCode), [trip.countryCode])
  const days = trip.itinerary
  const [selectedDay, setSelectedDay] = useState<number | 'all'>('all')

  const { markers, routes } = useMemo(() => {
    if (selectedDay === 'all') {
      const allMarkers: MapMarker[] = []
      const allRoutes: MapRoute[] = []
      days.forEach((day, idx) => {
        const dayMarkers = collectMarkers(day, dayColor(idx))
        allMarkers.push(...dayMarkers)
        if (dayMarkers.length >= 2) {
          allRoutes.push({
            id: `route-${day.day}`,
            positions: dayMarkers.map((m) => m.position),
            color: dayColor(idx),
          })
        }
      })
      return { markers: allMarkers, routes: allRoutes }
    }
    const day = days.find((d) => d.day === selectedDay)
    if (!day) return { markers: [], routes: [] }
    const idx = days.findIndex((d) => d.day === selectedDay)
    const dayMarkers = collectMarkers(day, dayColor(idx))
    return {
      markers: dayMarkers,
      routes:
        dayMarkers.length >= 2
          ? [{ id: `route-${day.day}`, positions: dayMarkers.map((m) => m.position), color: dayColor(idx) }]
          : [],
    }
  }, [days, selectedDay])

  if (markers.length === 0) {
    return (
      <EmptyJournal
        icon="🗺"
        title="No pinned locations yet"
        hint="Add coordinates to an activity (use the 📍 button in list view) and they'll appear on the map."
      />
    )
  }

  const MapView = adapter.MapView

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <JournalLabel>Day</JournalLabel>
        <DaySelect
          value={selectedDay}
          days={days}
          onChange={setSelectedDay}
        />
        <span style={{ ...tx(11, 500, muted), marginLeft: 'auto' }}>
          {markers.length} pin{markers.length === 1 ? '' : 's'} · {adapter.id.toUpperCase()}
        </span>
      </div>
      <MapView markers={markers} routes={routes} height={420} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {days.map((day, idx) => {
          const dayHasPin = day.items.some((it) => it.geo?.lat != null)
          if (!dayHasPin) return null
          return (
            <button
              key={day.day}
              type="button"
              onClick={() => setSelectedDay(selectedDay === day.day ? 'all' : day.day)}
              style={{
                ...tx(11, 600, ink),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${subtleBorder}`,
                background: selectedDay === day.day ? 'rgba(58,55,51,0.08)' : '#FFFCF9',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: dayColor(idx) }} />
              Day {day.day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const DaySelect = ({
  value,
  days,
  onChange,
}: {
  value: number | 'all'
  days: TripItineraryDay[]
  onChange: (next: number | 'all') => void
}) => (
  <select
    value={String(value)}
    onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
    style={{
      ...tx(12, 500, ink),
      padding: '6px 10px',
      borderRadius: 999,
      border: `1px solid ${subtleBorder}`,
      background: '#FFFCF9',
      cursor: 'pointer',
    }}
    aria-label="Select day"
  >
    <option value="all">All days</option>
    {days.map((d) => (
      <option key={d.day} value={String(d.day)}>
        Day {d.day} — {d.label}
      </option>
    ))}
  </select>
)

// reference unused import to keep tree-shake happy in dev builds
void InkButton
