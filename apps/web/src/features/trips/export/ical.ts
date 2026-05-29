import type { TripRecord, TripItineraryDay } from '../../../data/models/types'

/**
 * Zero-dependency iCalendar (.ics) generator for trips.
 *
 * Produces one VEVENT per itinerary activity, transport leg and stay. Events
 * with explicit start/end times become timed events (floating local time —
 * intentionally no TZID so they read as "wall-clock at destination"); events
 * with only a date become all-day events. RFC 5545 escaping + 75-octet line
 * folding are applied so the output imports cleanly into Apple/Google Calendar.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** YYYYMMDD from an ISO date string (YYYY-MM-DD). */
const toIcsDate = (iso: string): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  return `${m[1]}${m[2]}${m[3]}`
}

/** YYYYMMDDTHHMMSS local floating time, or null if inputs are malformed. */
const toIcsDateTime = (isoDate: string, hhmm: string): string | null => {
  const d = toIcsDate(isoDate)
  const t = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!d || !t) return null
  return `${d}T${pad(Number(t[1]))}${t[2]}00`
}

/** Add one day to a YYYYMMDD string (for all-day DTEND, which is exclusive). */
const nextDay = (yyyymmdd: string): string => {
  const y = Number(yyyymmdd.slice(0, 4))
  const mo = Number(yyyymmdd.slice(4, 6))
  const da = Number(yyyymmdd.slice(6, 8))
  const dt = new Date(Date.UTC(y, mo - 1, da))
  dt.setUTCDate(dt.getUTCDate() + 1)
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}`
}

/** Escape text per RFC 5545 (commas, semicolons, backslashes, newlines). */
const esc = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')

/** Fold a content line to <=75 octets with CRLF + space continuation. */
const fold = (line: string): string => {
  if (line.length <= 73) return line
  const chunks: string[] = []
  let rest = line
  let first = true
  while (rest.length > 0) {
    const limit = first ? 73 : 72
    chunks.push((first ? '' : ' ') + rest.slice(0, limit))
    rest = rest.slice(limit)
    first = false
  }
  return chunks.join('\r\n')
}

const utcStamp = (ms: number): string => {
  const d = new Date(ms)
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

type RawEvent = {
  uid: string
  summary: string
  location?: string
  description?: string
  /** date-only all-day event */
  date?: string
  /** timed event */
  start?: string
  end?: string
}

const itineraryEvents = (trip: TripRecord, days: TripItineraryDay[]): RawEvent[] => {
  const events: RawEvent[] = []
  for (const day of days) {
    if (!day.date) continue
    for (const item of day.items) {
      if (!item.title) continue
      const start = item.startTime ? toIcsDateTime(day.date, item.startTime) : null
      const end = item.endTime ? toIcsDateTime(day.date, item.endTime) : null
      const descParts = [item.notes, item.bookingRef ? `Booking: ${item.bookingRef}` : null].filter(Boolean) as string[]
      events.push({
        uid: `trip-${trip.id}-itin-${item.id}`,
        summary: item.title,
        location: item.location || item.geo?.address,
        description: descParts.join('\n') || undefined,
        ...(start ? { start, end: end ?? start } : { date: toIcsDate(day.date) ?? undefined }),
      })
    }
  }
  return events
}

const transportEvents = (trip: TripRecord): RawEvent[] =>
  trip.transport
    .filter((leg) => leg.date && (leg.from || leg.to))
    .map((leg) => {
      const start = leg.departTime ? toIcsDateTime(leg.date, leg.departTime) : null
      const end = leg.arriveTime ? toIcsDateTime(leg.date, leg.arriveTime) : null
      const descParts = [
        `${leg.method} · ${leg.status}`,
        leg.bookingRef ? `Booking: ${leg.bookingRef}` : null,
        leg.notes,
      ].filter(Boolean) as string[]
      return {
        uid: `trip-${trip.id}-transport-${leg.id}`,
        summary: `${leg.method}: ${leg.from || '?'} → ${leg.to || '?'}`,
        location: leg.from || undefined,
        description: descParts.join('\n') || undefined,
        ...(start ? { start, end: end ?? start } : { date: toIcsDate(leg.date) ?? undefined }),
      }
    })

const stayEvents = (trip: TripRecord): RawEvent[] =>
  trip.stays
    .filter((stay) => stay.name && stay.checkIn)
    .map((stay) => {
      const checkIn = toIcsDate(stay.checkIn)
      const checkOut = stay.checkOut ? toIcsDate(stay.checkOut) : null
      const descParts = [
        stay.status,
        stay.bookingRef ? `Booking: ${stay.bookingRef}` : null,
        stay.notes,
      ].filter(Boolean) as string[]
      return {
        uid: `trip-${trip.id}-stay-${stay.id}`,
        summary: `Stay: ${stay.name}`,
        location: stay.address || undefined,
        description: descParts.join('\n') || undefined,
        date: checkIn ?? undefined,
        // multi-day all-day span handled below via _checkOut
        _checkOut: checkOut,
      } as RawEvent & { _checkOut: string | null }
    })

export const buildTripIcs = (trip: TripRecord): string => {
  const now = Date.now()
  const dtstamp = utcStamp(now)

  const events: Array<RawEvent & { _checkOut?: string | null }> = [
    ...itineraryEvents(trip, trip.itinerary),
    ...transportEvents(trip),
    ...stayEvents(trip),
  ]

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Focus&Go//Trip Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(trip.title || 'Trip')}`,
  ]

  for (const ev of events) {
    if (!ev.date && !ev.start) continue
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}@focusgo`)
    lines.push(`DTSTAMP:${dtstamp}`)
    if (ev.start) {
      lines.push(`DTSTART:${ev.start}`)
      lines.push(`DTEND:${ev.end ?? ev.start}`)
    } else if (ev.date) {
      lines.push(`DTSTART;VALUE=DATE:${ev.date}`)
      const exclusiveEnd = ev._checkOut && ev._checkOut > ev.date ? ev._checkOut : nextDay(ev.date)
      lines.push(`DTEND;VALUE=DATE:${exclusiveEnd}`)
    }
    lines.push(`SUMMARY:${esc(ev.summary)}`)
    if (ev.location) lines.push(`LOCATION:${esc(ev.location)}`)
    if (ev.description) lines.push(`DESCRIPTION:${esc(ev.description)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n')
}

/** Trigger a browser download of the trip's .ics file. */
export const downloadTripIcs = (trip: TripRecord) => {
  const ics = buildTripIcs(trip)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const safeName = (trip.title || 'trip').replace(/[^\w一-龥-]+/g, '_').slice(0, 60)
  a.href = url
  a.download = `${safeName || 'trip'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
