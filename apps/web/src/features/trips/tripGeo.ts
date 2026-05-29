import type { TripRecord } from '../../data/models/types'
import type { LatLng } from '../../lib/maps'

/**
 * Best-effort synchronous coordinate for a trip, pulled from already-stored geo
 * data (no network). Falls back through destinationGeo → any itinerary/transport
 * /stay geo point. Returns null when nothing is stored — callers can then
 * geocode the destination string asynchronously.
 */
export const tripSyncCoord = (trip: TripRecord): LatLng | null => {
  const dg = trip.destinationGeo
  if (dg && typeof dg.lat === 'number' && typeof dg.lng === 'number') {
    return { lat: dg.lat, lng: dg.lng }
  }
  for (const day of trip.itinerary) {
    for (const item of day.items) {
      const g = item.geo
      if (g && typeof g.lat === 'number' && typeof g.lng === 'number') return { lat: g.lat, lng: g.lng }
    }
  }
  return null
}

/** A trip's display query for geocoding: destination, falling back to title. */
export const tripGeoQuery = (trip: TripRecord): string => (trip.destination || trip.title || '').trim()
