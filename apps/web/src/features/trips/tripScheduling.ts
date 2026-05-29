import type {
  TripItineraryDay,
  TripItineraryItem,
  TripRecord,
} from '../../data/models/types'

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

/**
 * Parse "HH:MM" → minutes since midnight. Returns null for invalid input.
 */
export const parseHHMM = (raw: string | undefined | null): number | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const m = trimmed.match(HHMM_RE)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export const minutesToHHMM = (minutes: number): string => {
  const safe = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(safe / 60)
  const m = Math.floor(safe % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type ItemBounds = {
  itemId: string
  startMin: number | null
  endMin: number | null
}

/**
 * Extract numeric bounds for an item, preferring startTime/endTime but falling
 * back to the legacy `time` field (which may be "HH:MM" or "HH:MM – HH:MM").
 */
export const getItemBounds = (item: TripItineraryItem): ItemBounds => {
  const startExplicit = parseHHMM(item.startTime)
  const endExplicit = parseHHMM(item.endTime)
  if (startExplicit != null || endExplicit != null) {
    const startMin = startExplicit
    const durationMin = typeof item.durationMin === 'number' && item.durationMin > 0 ? item.durationMin : null
    const endMin = endExplicit ?? (startMin != null && durationMin != null ? startMin + durationMin : null)
    return { itemId: item.id, startMin, endMin }
  }
  if (typeof item.time === 'string' && item.time.trim()) {
    const headMatch = item.time.match(/([01]?\d|2[0-3]):([0-5]\d)/)
    const start = headMatch ? Number(headMatch[1]) * 60 + Number(headMatch[2]) : null
    const tail = item.time.match(/[-–~]\s*([01]?\d|2[0-3]):([0-5]\d)/)
    const end = tail ? Number(tail[1]) * 60 + Number(tail[2]) : null
    return { itemId: item.id, startMin: start, endMin: end }
  }
  return { itemId: item.id, startMin: null, endMin: null }
}

export type TimeConflict = {
  a: string
  b: string
  overlapMin: number
}

/**
 * Detect overlapping items within a single day. An item with no bounds cannot
 * conflict with anything. End times missing fall back to start + 60min for the
 * purpose of overlap (a planned activity with no end is treated as ~1 hour).
 */
export const detectConflicts = (day: TripItineraryDay): TimeConflict[] => {
  const bounds = day.items
    .map(getItemBounds)
    .filter((b): b is ItemBounds & { startMin: number } => b.startMin != null)
    .map((b) => ({ ...b, endMin: b.endMin ?? b.startMin + 60 }))
    .sort((a, b) => a.startMin - b.startMin)
  const out: TimeConflict[] = []
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i]
      const b = bounds[j]
      if (b.startMin >= a.endMin) break
      const overlap = Math.min(a.endMin, b.endMin) - b.startMin
      if (overlap > 0) out.push({ a: a.itemId, b: b.itemId, overlapMin: overlap })
    }
  }
  return out
}

export type TimeGap = {
  afterItemId: string
  beforeItemId: string
  gapMin: number
  severity: 'tight' | 'normal' | 'large'
}

export const TIGHT_GAP_MIN = 15
export const LARGE_GAP_MIN = 240

export const computeGaps = (day: TripItineraryDay): TimeGap[] => {
  const bounds = day.items
    .map(getItemBounds)
    .filter((b): b is ItemBounds & { startMin: number; endMin: number } => b.startMin != null && b.endMin != null)
    .sort((a, b) => a.startMin - b.startMin)
  const out: TimeGap[] = []
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]
    const b = bounds[i + 1]
    const gap = b.startMin - a.endMin
    if (gap < 0) continue
    const severity: TimeGap['severity'] = gap < TIGHT_GAP_MIN ? 'tight' : gap > LARGE_GAP_MIN ? 'large' : 'normal'
    if (severity !== 'normal') out.push({ afterItemId: a.itemId, beforeItemId: b.itemId, gapMin: gap, severity })
  }
  return out
}

export type ItemLocator = { dayNum: number; itemId: string }
export type MoveTarget = { dayNum: number; index: number }

/**
 * Move an itinerary item between days / positions immutably. Returns a fresh
 * array of days; if the source can't be found, returns the input untouched.
 */
export const moveItem = (
  days: TripItineraryDay[],
  source: ItemLocator,
  target: MoveTarget,
): TripItineraryDay[] => {
  const sourceDay = days.find((d) => d.day === source.dayNum)
  if (!sourceDay) return days
  const item = sourceDay.items.find((it) => it.id === source.itemId)
  if (!item) return days
  return days.map((day) => {
    if (day.day === source.dayNum && day.day === target.dayNum) {
      const without = day.items.filter((it) => it.id !== source.itemId)
      const clamped = Math.max(0, Math.min(target.index, without.length))
      const next = [...without.slice(0, clamped), item, ...without.slice(clamped)]
      return { ...day, items: next }
    }
    if (day.day === source.dayNum) {
      return { ...day, items: day.items.filter((it) => it.id !== source.itemId) }
    }
    if (day.day === target.dayNum) {
      const clamped = Math.max(0, Math.min(target.index, day.items.length))
      const next = [...day.items.slice(0, clamped), item, ...day.items.slice(clamped)]
      return { ...day, items: next }
    }
    return day
  })
}

/**
 * Sort items within each day by start time (items without a start go to the end,
 * preserving their relative order).
 */
export const sortDayByTime = (day: TripItineraryDay): TripItineraryDay => {
  const indexed = day.items.map((item, originalIndex) => ({ item, originalIndex, bounds: getItemBounds(item) }))
  indexed.sort((a, b) => {
    if (a.bounds.startMin == null && b.bounds.startMin == null) return a.originalIndex - b.originalIndex
    if (a.bounds.startMin == null) return 1
    if (b.bounds.startMin == null) return -1
    return a.bounds.startMin - b.bounds.startMin
  })
  return { ...day, items: indexed.map(({ item }) => item) }
}

export const sortAllDaysByTime = (trip: TripRecord): TripRecord => ({
  ...trip,
  itinerary: trip.itinerary.map(sortDayByTime),
})
