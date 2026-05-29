import { CN_COUNTRY_CODES, type MapAdapter, type MapProviderId } from './MapAdapter'
import { osmAdapter } from './OSMAdapter'

export * from './MapAdapter'
export { OSMMapView } from './OSMAdapter'

/**
 * Pick the best available map adapter for a given country.
 *
 * Strategy:
 *   - In China (CN/HK/MO/TW), prefer Amap, then Mapbox, then OSM.
 *   - Elsewhere, prefer Mapbox, then OSM.
 *
 * Adapters whose API keys are missing (or who decide they aren't usable for
 * other reasons) return false from isAvailable(), so we transparently fall
 * through. OSM is always available — there is no "no map" branch to worry
 * about in callers.
 */
export const pickMapProvider = (countryCode?: string): MapAdapter => {
  const isCN = countryCode && CN_COUNTRY_CODES.has(countryCode.toUpperCase())
  const ordered: MapAdapter[] = isCN
    ? [/* amapAdapter, mapboxAdapter — wired in follow-up */ osmAdapter]
    : [/* mapboxAdapter — wired in follow-up */ osmAdapter]
  for (const adapter of ordered) {
    if (adapter.isAvailable()) return adapter
  }
  return osmAdapter
}

export const getAdapterById = (id: MapProviderId): MapAdapter => {
  if (id === 'osm') return osmAdapter
  // Mapbox / Amap pending; fall back to OSM until they ship.
  return osmAdapter
}
