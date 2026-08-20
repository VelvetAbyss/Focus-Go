import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, MapPin, Loader2 } from 'lucide-react'
import type { TripRecord } from '../../../data/models/types'
import type { LatLng, MapMarker } from '../../../lib/maps'
import { OSMMapView, getAdapterById } from '../../../lib/maps'
import type { LifeTranslate } from '../../life/lifeI18n'
import { statusColor, tripDuration } from '../tripData'
import { tripGeoQuery, tripSyncCoord } from '../tripGeo'
import { ink, muted, pf, subtleBorder, tx } from '../ui'

type Props = {
  trips: TripRecord[]
  t: LifeTranslate
  onOpen: (id: string) => void
}

type Resolved = Record<string, LatLng | null>

const CACHE_PREFIX = 'fg:atlas:geo:'

const readCache = (query: string): LatLng | null | undefined => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + query.toLowerCase())
    if (raw == null) return undefined
    if (raw === 'null') return null
    const parsed = JSON.parse(raw) as LatLng
    return typeof parsed.lat === 'number' && typeof parsed.lng === 'number' ? parsed : undefined
  } catch {
    return undefined
  }
}

const writeCache = (query: string, value: LatLng | null) => {
  try {
    localStorage.setItem(CACHE_PREFIX + query.toLowerCase(), value ? JSON.stringify(value) : 'null')
  } catch {
    /* ignore quota / disabled storage */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** World atlas: pins every trip on a map, colored by status, click to open. */
export const TripsAtlasView = ({ trips, t, onOpen }: Props) => {
  const [resolved, setResolved] = useState<Resolved>({})
  const [pending, setPending] = useState(0)
  const runRef = useRef(0)

  // Seed synchronous + cached coordinates immediately.
  const seeded = useMemo(() => {
    const out: Resolved = {}
    for (const trip of trips) {
      const sync = tripSyncCoord(trip)
      if (sync) { out[trip.id] = sync; continue }
      const query = tripGeoQuery(trip)
      if (query) {
        const cached = readCache(query)
        if (cached !== undefined) out[trip.id] = cached
      }
    }
    return out
  }, [trips])

  useEffect(() => {
    setResolved(seeded)
    // Geocode any trips still missing a coordinate, sequentially (Nominatim etiquette).
    const missing = trips.filter((trip) => seeded[trip.id] === undefined && tripGeoQuery(trip))
    if (!missing.length) { setPending(0); return }
    const run = ++runRef.current
    setPending(missing.length)
    let cancelled = false
    ;(async () => {
      for (const trip of missing) {
        if (cancelled || run !== runRef.current) return
        const query = tripGeoQuery(trip)
        let coord: LatLng | null = null
        try {
          const results = await getAdapterById('osm').searchPOI(query)
          coord = results[0]?.position ?? null
        } catch {
          coord = null
        }
        writeCache(query, coord)
        if (cancelled || run !== runRef.current) return
        setResolved((prev) => ({ ...prev, [trip.id]: coord }))
        setPending((n) => Math.max(0, n - 1))
        await sleep(1100)
      }
    })()
    return () => { cancelled = true }
  }, [trips, seeded])

  const located = useMemo(
    () => trips.filter((trip) => resolved[trip.id]),
    [trips, resolved],
  )

  const markers = useMemo<MapMarker[]>(
    () =>
      located.map((trip) => {
        const pos = resolved[trip.id]!
        return {
          id: trip.id,
          position: pos,
          label: `${trip.coverEmoji ?? '✈️'} ${trip.title}`,
          color: statusColor(trip.status).text,
          payload: trip,
        }
      }),
    [located, resolved],
  )

  const countryCount = useMemo(() => {
    const set = new Set<string>()
    for (const trip of trips) if (trip.countryCode) set.add(trip.countryCode.toUpperCase())
    return set.size
  }, [trips])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <Stat value={located.length} label={t('life.trips.atlas.placed')} />
        {countryCount > 0 ? <Stat value={countryCount} label={t('life.trips.atlas.countries')} /> : null}
        {pending > 0 ? (
          <span style={{ ...tx(12, 500, muted), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={13} style={{ animation: 'spin 0.9s linear infinite' }} /> {t('life.trips.atlas.locating', { count: pending })}
          </span>
        ) : null}
      </div>

      <OSMMapView markers={markers} height={520} onMarkerClick={(id) => onOpen(id)} />

      {located.length > 0 ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {located.map((trip) => {
            const sc = statusColor(trip.status)
            return (
              <button
                key={trip.id}
                onClick={() => onOpen(trip.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  border: `1px solid ${subtleBorder}`,
                  background: 'var(--bg-elevated)',
                  borderRadius: 999,
                  padding: '7px 12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = sc.border }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = subtleBorder }}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sc.text, flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{trip.coverEmoji ?? '✈️'}</span>
                <span style={tx(12, 600, ink)}>{trip.title}</span>
                {trip.destination ? <span style={tx(11, 400, muted)}>· {trip.destination}</span> : null}
                <span style={tx(10, 500, muted)}>· {t('life.trips.daysCount', { count: tripDuration(trip) })}</span>
                <ArrowRight size={12} style={{ opacity: 0.4 }} />
              </button>
            )
          })}
        </div>
      ) : pending === 0 ? (
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center', padding: '48px 0', textAlign: 'center' }}>
          <MapPin size={28} style={{ opacity: 0.35 }} />
          <p style={pf(18, 600, ink)}>{t('life.trips.atlas.emptyTitle')}</p>
          <p style={tx(13, 400, muted)}>{t('life.trips.atlas.emptyDesc')}</p>
        </div>
      ) : null}
    </div>
  )
}

const Stat = ({ value, label }: { value: number; label: string }) => (
  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
    <span style={pf(22, 600, ink)}>{value}</span>
    <span style={{ ...tx(11, 500, muted), letterSpacing: '0.04em' }}>{label}</span>
  </span>
)

export default TripsAtlasView
