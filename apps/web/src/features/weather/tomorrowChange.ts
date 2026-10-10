import type { WeatherDay } from './weatherApi'

export type TomorrowChange = {
  /** Change in the daily high, rounded; 0 unless it is big enough to dress for. */
  delta: number
  rain: boolean
}

const RAIN_LIKELY = 60

/**
 * What about tomorrow is worth a line this morning: a swing in the high of
 * 6°C (10°F) or more, or rain likely. Null when nothing is.
 */
export const tomorrowChange = (days: WeatherDay[], unit: 'celsius' | 'fahrenheit' = 'celsius'): TomorrowChange | null => {
  const [today, tomorrow] = days
  if (!today || !tomorrow) return null
  const swing = Math.round(tomorrow.tempMax - today.tempMax)
  const delta = Math.abs(swing) >= (unit === 'fahrenheit' ? 10 : 6) ? swing : 0
  const rain = (tomorrow.precipitationProbability ?? 0) >= RAIN_LIKELY
  return delta !== 0 || rain ? { delta, rain } : null
}
