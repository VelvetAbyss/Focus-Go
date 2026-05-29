import type { ReactNode } from 'react'

export type LatLng = { lat: number; lng: number }

export type MapMarker = {
  id: string
  position: LatLng
  label?: string
  color?: string
  icon?: string
  payload?: unknown
}

export type MapRoute = {
  id: string
  positions: LatLng[]
  color?: string
}

export type SearchResult = {
  id: string
  name: string
  address?: string
  position: LatLng
  raw?: unknown
}

export type ReverseGeocodeResult = {
  name?: string
  address?: string
  countryCode?: string
}

export type MapProviderId = 'osm' | 'mapbox' | 'amap'

export type MapViewProps = {
  markers: MapMarker[]
  routes?: MapRoute[]
  center?: LatLng
  zoom?: number
  onMarkerClick?: (markerId: string) => void
  onMapClick?: (position: LatLng) => void
  height?: number | string
  className?: string
  children?: ReactNode
}

/**
 * MapAdapter abstracts away provider differences so the rest of the app can
 * stay rendering-agnostic. Implementations live in OSMAdapter, MapboxAdapter,
 * AmapAdapter and are picked by pickProvider() based on the trip's countryCode.
 */
export interface MapAdapter {
  id: MapProviderId
  /** True if this adapter is fully usable in the current environment. */
  isAvailable(): boolean
  /** React component that mounts the map. */
  MapView: (props: MapViewProps) => ReactNode
  /** POI / address search. */
  searchPOI(query: string, near?: LatLng): Promise<SearchResult[]>
  /** Reverse-geocode a coordinate to a human label. */
  reverseGeocode(pos: LatLng): Promise<ReverseGeocodeResult | null>
}

export const CN_COUNTRY_CODES = new Set(['CN', 'HK', 'MO', 'TW'])
