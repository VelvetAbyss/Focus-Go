import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { MapAdapter, MapViewProps, ReverseGeocodeResult, SearchResult } from './MapAdapter'
import 'leaflet/dist/leaflet.css'

// Leaflet's default marker icon paths assume a CDN-served bundle. In a Vite
// build the assets aren't co-located with the bundle, so the default marker
// silently 404s. Wire up the URLs via Vite asset imports so markers always
// render without per-call configuration.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// One-time bootstrap to point Leaflet at the bundled marker images.
const setupLeafletIcons = () => {
  const proto = (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  if (proto._getIconUrl !== undefined) delete proto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x as unknown as string,
    iconUrl: markerIcon as unknown as string,
    shadowUrl: markerShadow as unknown as string,
  })
}
setupLeafletIcons()

const FitBounds = ({ positions }: { positions: Array<[number, number]> }) => {
  const map = useMap()
  useEffect(() => {
    if (!positions.length) return
    if (positions.length === 1) {
      map.setView(positions[0], Math.max(map.getZoom(), 13))
      return
    }
    const bounds = L.latLngBounds(positions)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, positions])
  return null
}

const ClickHandler = ({ onMapClick }: { onMapClick?: (p: { lat: number; lng: number }) => void }) => {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

const buildColoredIcon = (color: string): L.DivIcon =>
  L.divIcon({
    className: 'fg-map-pin',
    html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:${color};box-shadow:0 1px 4px color-mix(in srgb, var(--text-primary) 25%, transparent),0 0 0 2px #FDFAF7;color:var(--bg-elevated);font:600 11px/1 Inter,sans-serif;">●</span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -12],
  })

export const OSMMapView = ({ markers, routes, center, zoom = 12, onMarkerClick, onMapClick, height = 420, className }: MapViewProps) => {
  const positions = useMemo<Array<[number, number]>>(
    () => markers.map((m) => [m.position.lat, m.position.lng]),
    [markers],
  )
  const fallbackCenter: [number, number] = center
    ? [center.lat, center.lng]
    : positions[0] ?? [35.6762, 139.6503] // Tokyo as a friendly default
  return (
    <div className={className} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid color-mix(in srgb, var(--text-primary) 9%, transparent)' }}>
      <MapContainer center={fallbackCenter} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.position.lat, m.position.lng]}
            icon={buildColoredIcon(m.color ?? '#7C5A3A')}
            eventHandlers={{ click: () => onMarkerClick?.(m.id) }}
          >
            {m.label ? <Popup>{m.label}</Popup> : null}
          </Marker>
        ))}
        {(routes ?? []).map((r) => (
          <Polyline
            key={r.id}
            positions={r.positions.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: r.color ?? '#7C5A3A', weight: 3, opacity: 0.7 }}
          />
        ))}
        <ClickHandler onMapClick={onMapClick} />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  )
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

type NominatimResult = {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type?: string
  address?: { country_code?: string; city?: string; town?: string; village?: string; road?: string }
}

const searchPOI = async (query: string): Promise<SearchResult[]> => {
  const trimmed = query.trim()
  if (!trimmed) return []
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=8&q=${encodeURIComponent(trimmed)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const data = (await res.json()) as NominatimResult[]
  return data.map((r) => ({
    id: String(r.place_id),
    name: r.display_name.split(',')[0],
    address: r.display_name,
    position: { lat: Number(r.lat), lng: Number(r.lon) },
    raw: r,
  }))
}

const reverseGeocode = async (pos: { lat: number; lng: number }): Promise<ReverseGeocodeResult | null> => {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResult
  return {
    name: data.display_name?.split(',')[0],
    address: data.display_name,
    countryCode: data.address?.country_code?.toUpperCase(),
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- adapter object colocated with its MapView component
export const osmAdapter: MapAdapter = {
  id: 'osm',
  isAvailable: () => true,
  MapView: OSMMapView,
  searchPOI,
  reverseGeocode,
}
