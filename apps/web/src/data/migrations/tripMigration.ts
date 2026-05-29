import type {
  TripChecklistGroup,
  TripDayNote,
  TripGeoPoint,
  TripItineraryDay,
  TripItineraryItem,
  TripRecord,
  TripStayItem,
  TripTransportItem,
  TripFoodItem,
} from '../models/types'

const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

const parseTimeRange = (raw: string | undefined): { start?: string; end?: string } => {
  if (!raw) return {}
  const trimmed = raw.trim()
  if (!trimmed) return {}
  const m = trimmed.match(/^([01]?\d|2[0-3]):[0-5]\d/)
  const start = m ? m[0] : undefined
  const sepMatch = trimmed.match(/[-–~](\s*)([01]?\d|2[0-3]):[0-5]\d/)
  const end = sepMatch ? sepMatch[0].replace(/^[-–~]\s*/, '') : undefined
  return { start, end }
}

const padHHMM = (raw?: string): string | undefined => {
  if (!raw) return undefined
  return HHMM_RE.test(raw) ? raw.padStart(5, '0') : undefined
}

const ensureGeo = (existing: TripGeoPoint | undefined, location: string | undefined): TripGeoPoint | undefined => {
  if (existing) return existing
  if (!location || !location.trim()) return undefined
  return undefined
}

const migrateItem = (item: TripItineraryItem): TripItineraryItem => {
  let { startTime, endTime, geo } = item
  if (!startTime || !endTime) {
    const { start, end } = parseTimeRange(item.time)
    if (!startTime && start) startTime = padHHMM(start)
    if (!endTime && end) endTime = padHHMM(end)
  }
  if (!geo) geo = ensureGeo(geo, item.location)
  return {
    ...item,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(geo ? { geo } : {}),
  }
}

const migrateDay = (day: TripItineraryDay): TripItineraryDay => ({
  ...day,
  items: Array.isArray(day.items) ? day.items.map(migrateItem) : [],
  dayNotes: Array.isArray(day.dayNotes) ? (day.dayNotes as TripDayNote[]) : day.dayNotes,
})

const migrateTransport = (item: TripTransportItem): TripTransportItem => item
const migrateStay = (item: TripStayItem): TripStayItem => item
const migrateFood = (item: TripFoodItem): TripFoodItem => item
const migrateChecklistGroup = (group: TripChecklistGroup): TripChecklistGroup => ({
  ...group,
  items: Array.isArray(group.items) ? group.items : [],
})

export const migrateTripIn = (trip: TripRecord): TripRecord => {
  if (!trip) return trip
  return {
    ...trip,
    itinerary: Array.isArray(trip.itinerary) ? trip.itinerary.map(migrateDay) : [],
    transport: Array.isArray(trip.transport) ? trip.transport.map(migrateTransport) : [],
    stays: Array.isArray(trip.stays) ? trip.stays.map(migrateStay) : [],
    food: Array.isArray(trip.food) ? trip.food.map(migrateFood) : [],
    checklist: Array.isArray(trip.checklist) ? trip.checklist.map(migrateChecklistGroup) : [],
    homeCurrency: trip.homeCurrency ?? trip.budgetCurrency,
  }
}

export const __testing = { parseTimeRange, padHHMM, migrateItem }
