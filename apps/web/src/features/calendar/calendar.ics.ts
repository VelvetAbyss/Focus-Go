import type { CalendarEvent } from './calendar.model'

const DAY_MS = 86_400_000

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

const unfoldIcsLines = (icsText: string): string[] => {
  const normalized = icsText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalized.split('\n')
  const lines: string[] = []

  rawLines.forEach((line) => {
    if (!line) return
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.trimStart()
      return
    }
    lines.push(line)
  })

  return lines
}

const parseIcsDateTime = (raw: string) => {
  const value = raw.trim()

  if (/^\d{8}$/.test(value)) {
    const y = Number(value.slice(0, 4))
    const m = Number(value.slice(4, 6)) - 1
    const d = Number(value.slice(6, 8))
    const date = new Date(y, m, d)
    return { date, isAllDay: true }
  }

  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/)
  if (!match) return null

  const [, y, m, d, hh, mm, ss, zulu] = match
  const second = Number(ss ?? '0')

  if (zulu === 'Z') {
    return {
      date: new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), second)),
      isAllDay: false,
    }
  }

  return {
    date: new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), second),
    isAllDay: false,
  }
}

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

export const parseIcsEvents = (icsText: string, subscriptionId: string): CalendarEvent[] => {
  const lines = unfoldIcsLines(icsText)
  const events: CalendarEvent[] = []

  let inEvent = false
  let uid = ''
  let summary = ''
  let dtStartRaw = ''

  const flushEvent = () => {
    if (!inEvent) return

    const parsedStart = dtStartRaw ? parseIcsDateTime(dtStartRaw) : null
    if (!parsedStart || !summary.trim()) return

    const kind = resolveEventKind(summary, subscriptionId)
    const title = kind === 'lunar' ? extractLunarMonthDay(summary) : summary.trim()
    const baseId = uid.trim() || `${subscriptionId}-${parsedStart.date.getTime()}-${title}`

    events.push({
      id: `${subscriptionId}-${baseId}`,
      subscriptionId,
      title,
      dateKey: toDateKey(parsedStart.date),
      timeLabel: parsedStart.isAllDay ? 'All day' : toTimeLabel(parsedStart.date),
      kind,
    })
  }

  lines.forEach((line) => {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      uid = ''
      summary = ''
      dtStartRaw = ''
      return
    }

    if (line === 'END:VEVENT') {
      flushEvent()
      inEvent = false
      return
    }

    if (!inEvent) return

    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) return
    const rawKey = line.slice(0, colonIdx)
    const value = line.slice(colonIdx + 1)
    const key = rawKey.split(';')[0].toUpperCase()

    if (key === 'UID') uid = value
    if (key === 'SUMMARY') summary = value
    if (key === 'DTSTART') dtStartRaw = value
  })

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
      const events = parseIcsEvents(text, subscriptionId)
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
