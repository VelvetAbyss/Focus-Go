import type { CalendarEvent } from './calendar.model'

const DAY_MS = 86_400_000
const RECURRENCE_PAST_DAYS = 365
const RECURRENCE_FUTURE_DAYS = 730
const RECURRENCE_MAX_INSTANCES = 500

type IcalEvent = {
  uid: string | null
  summary: string | null
  startDate: { toJSDate: () => Date; isDate: boolean } | null
  isRecurring: () => boolean
  iterator: () => { next: () => { toJSDate: () => Date } | null }
}

type IcalComponent = {
  getAllSubcomponents: (name: string) => unknown[]
}

type IcalModule = {
  parse: (text: string) => unknown
  Component: new (jcal: unknown) => IcalComponent
  Event: new (vevent: unknown) => IcalEvent
}

let icalPromise: Promise<IcalModule | null> | null = null
const loadIcal = (): Promise<IcalModule | null> => {
  if (!icalPromise) {
    icalPromise = import('ical.js')
      .then((mod) => (mod.default ?? mod) as unknown as IcalModule)
      .catch(() => null)
  }
  return icalPromise
}

const toDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toTimeLabel = (date: Date) =>
  date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const extractLunarMonthDay = (summary: string) => {
  const match = summary.match(/(闰?[正一二三四五六七八九十冬腊]+月(?:初[一二三四五六七八九十]|十[一二三四五六七八九]?|廿[一二三四五六七八九]?|三十))/)
  return match?.[1] ?? summary.trim()
}

const resolveEventKind = (summary: string, subscriptionId: string): CalendarEvent['kind'] => {
  if (subscriptionId === 'system-cn-lunar' || /农历|正月|腊月|初[一二三四五六七八九十]|廿[一二三四五六七八九]/.test(summary)) {
    return 'lunar'
  }

  if (/holiday|节|假|元旦|春节|清明|端午|中秋|国庆/i.test(summary)) {
    return 'holiday'
  }

  return 'event'
}

const buildEvent = (
  subscriptionId: string,
  uid: string,
  summary: string,
  occurrence: Date,
  isAllDay: boolean,
  index: number,
): CalendarEvent => {
  const kind = resolveEventKind(summary, subscriptionId)
  const title = kind === 'lunar' ? extractLunarMonthDay(summary) : summary.trim()
  const baseId = uid.trim() || `${subscriptionId}-${occurrence.getTime()}-${title}`
  const idSuffix = index > 0 ? `-${index}` : ''
  return {
    id: `${subscriptionId}-${baseId}${idSuffix}`,
    subscriptionId,
    title,
    dateKey: toDateKey(occurrence),
    timeLabel: isAllDay ? 'All day' : toTimeLabel(occurrence),
    kind,
  }
}

export const parseIcsEvents = async (icsText: string, subscriptionId: string): Promise<CalendarEvent[]> => {
  const ical = await loadIcal()
  if (!ical) return []

  const jcal = ical.parse(icsText)
  const root = new ical.Component(jcal)
  const vevents = root.getAllSubcomponents('vevent')
  const events: CalendarEvent[] = []

  const windowStart = Date.now() - RECURRENCE_PAST_DAYS * DAY_MS
  const windowEnd = Date.now() + RECURRENCE_FUTURE_DAYS * DAY_MS

  for (const vevent of vevents) {
    let event: IcalEvent
    try {
      event = new ical.Event(vevent)
    } catch {
      continue
    }

    const summary = event.summary?.trim()
    if (!summary || !event.startDate) continue

    const uid = event.uid ?? ''
    const isAllDay = event.startDate.isDate === true

    if (!event.isRecurring()) {
      const occurrence = event.startDate.toJSDate()
      events.push(buildEvent(subscriptionId, uid, summary, occurrence, isAllDay, 0))
      continue
    }

    const iterator = event.iterator()
    let index = 0
    for (let i = 0; i < RECURRENCE_MAX_INSTANCES; i += 1) {
      const next = iterator.next()
      if (!next) break
      const occurrence = next.toJSDate()
      const ts = occurrence.getTime()
      if (ts > windowEnd) break
      if (ts < windowStart) continue
      events.push(buildEvent(subscriptionId, uid, summary, occurrence, isAllDay, index))
      index += 1
    }
  }

  return events
}

const readBody = async (response: Response) => response.text()

const buildProxyUrls = (url: string) => {
  const encoded = encodeURIComponent(url)
  const nonProtocol = url.replace(/^https?:\/\//, '')
  return [
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://r.jina.ai/http://${nonProtocol}`,
  ]
}

const fetchTextFrom = async (url: string, fetchImpl: typeof fetch) => {
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  return readBody(response)
}

export const fetchIcsEventsWithFallback = async (
  url: string,
  subscriptionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<CalendarEvent[]> => {
  const candidates = [url, ...buildProxyUrls(url)]
  const failures: string[] = []

  for (const candidate of candidates) {
    try {
      const text = await fetchTextFrom(candidate, fetchImpl)
      const events = await parseIcsEvents(text, subscriptionId)
      if (events.length === 0) {
        throw new Error('No events found in ICS feed')
      }
      return events
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(failures.join(' | '))
}

export const filterEventsInMonth = (events: CalendarEvent[], monthDate: Date) => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1)
  const min = start.getTime()
  const max = end.getTime()

  return events.filter((event) => {
    const date = new Date(`${event.dateKey}T12:00:00`).getTime()
    return date >= min && date < max + DAY_MS
  })
}
