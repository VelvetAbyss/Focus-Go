import { useEffect, useState } from 'react'
import type { TripRecord } from '../../data/models/types'
import { getForecast, type WeatherDay } from '../../lib/services/weather'

/**
 * Fetch the per-day forecast for a trip and return it keyed by ISO date so the
 * Itinerary section can render a chip on each day header.
 *
 * We pick the "anchor" coordinate in this order:
 *   1. trip.destinationGeo (set explicitly via overview map picker — wired later)
 *   2. the first activity with geo across all days
 *
 * Returns an empty map when no anchor exists, so callers don't need a special
 * null-check; they just iterate.
 */
export const useTripWeather = (trip: TripRecord | null): { weatherByDate: Record<string, WeatherDay>; loading: boolean } => {
  const [weatherByDate, setWeatherByDate] = useState<Record<string, WeatherDay>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!trip) {
      setWeatherByDate({})
      return
    }
    const anchor = trip.destinationGeo?.lat != null && trip.destinationGeo?.lng != null
      ? { lat: trip.destinationGeo.lat, lng: trip.destinationGeo.lng }
      : trip.itinerary
          .flatMap((d) => d.items)
          .find((it) => it.geo?.lat != null && it.geo?.lng != null)?.geo as { lat: number; lng: number } | undefined
    if (!anchor) {
      setWeatherByDate({})
      return
    }
    if (!trip.startDate || !trip.endDate) {
      setWeatherByDate({})
      return
    }

    let cancelled = false
    setLoading(true)
    void (async () => {
      const data = await getForecast(anchor.lat, anchor.lng, trip.startDate, trip.endDate)
      if (cancelled) return
      const next: Record<string, WeatherDay> = {}
      if (data) for (const d of data) next[d.date] = d
      setWeatherByDate(next)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [trip])

  return { weatherByDate, loading }
}
