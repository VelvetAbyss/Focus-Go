import { Router } from 'express'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'

// ICS feeds for the calendar page. Most calendar hosts send no CORS headers, so the
// browser can't read them directly. This fetches a feed server-side, so a user's
// private calendar link never goes to a third-party proxy.
//
// Guard rails, because it fetches a user-supplied URL:
// - http(s) (and webcal) on the default ports only;
// - every hop's host must resolve to public addresses (no loopback, private,
//   link-local, CGNAT or ULA ranges); redirects are followed by hand and re-checked;
// - 10s timeout, 5 MB cap, and the body must look like a calendar;
// - the built-in holiday presets work signed out; any other URL needs a session.

const FETCH_TIMEOUT_MS = 10_000
const MAX_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 3
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const CACHE_MAX_ENTRIES = 200

// Same list as the web app's calendar presets (CalendarPage CALENDAR_PRESET_SUBSCRIPTIONS).
export const CALENDAR_PRESET_URLS = new Set([
  'https://ical.muhan.org/rest.ics',
  'https://ical.muhan.org/work.ics',
  'https://calendar.google.com/calendar/ical/en.usa.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  'https://calendar.google.com/calendar/ical/en.uk.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  'https://calendar.google.com/calendar/ical/en.japanese.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  'https://calendar.google.com/calendar/ical/en.singapore.official%23holiday%40group.v.calendar.google.com/public/basic.ics',
  'https://raw.githubusercontent.com/PanderMusubi/lunar-phase-calendar/master/GB/en/moon-phases.ics',
  'https://raw.githubusercontent.com/KaitoHH/24-jieqi-ics/master/23_solar_terms_2015-01-01_2050-12-31.ics',
])

const isPrivateIPv4 = (ip) => {
  const [a, b, c] = ip.split('.').map(Number)
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

export const isPublicAddress = (ip) => {
  const family = isIP(ip)
  if (family === 4) return !isPrivateIPv4(ip)
  if (family !== 6) return false
  const lower = ip.toLowerCase()
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return !isPrivateIPv4(mapped[1])
  return !(
    lower === '::' || lower === '::1' ||
    lower.startsWith('fc') || lower.startsWith('fd') || // ULA
    lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb') || // link-local
    lower.startsWith('ff') // multicast
  )
}

/** Normalizes a feed URL (webcal → https) or returns null if it isn't fetchable. */
export const normalizeFeedUrl = (raw) => {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let url
  try {
    url = new URL(raw.trim().replace(/^webcals?:\/\//i, 'https://'))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return null
  return url
}

const assertPublicHost = async (url, lookup) => {
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (addresses.length === 0 || !addresses.every((entry) => isPublicAddress(entry.address))) {
    const error = new Error('Host not allowed')
    error.statusCode = 400
    throw error
  }
}

const readLimited = async (response) => {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      await reader.cancel()
      const error = new Error('Feed too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
}

export const createCalendarRouter = ({ fetchImpl = fetch, lookup = dnsLookup, requireAuth } = {}) => {
  if (!requireAuth) throw new Error('Calendar router requires requireAuth')
  const router = Router()
  const cache = new Map()

  const fetchFeed = async (start) => {
    let url = start
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      await assertPublicHost(url, lookup)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const response = await fetchImpl(url.href, {
          redirect: 'manual',
          signal: controller.signal,
          headers: { Accept: 'text/calendar, text/plain;q=0.8, */*;q=0.1', 'User-Agent': 'Focus&go calendar' },
        })
        if (response.status >= 300 && response.status < 400) {
          const next = normalizeFeedUrl(new URL(response.headers.get('location') ?? '', url).href)
          if (!next) break
          url = next
          continue
        }
        if (!response.ok) {
          const error = new Error(`Upstream responded ${response.status}`)
          error.statusCode = 502
          throw error
        }
        const text = await readLimited(response)
        if (!text.includes('BEGIN:VCALENDAR')) {
          const error = new Error('Not a calendar feed')
          error.statusCode = 422
          throw error
        }
        return text
      } finally {
        clearTimeout(timer)
      }
    }
    const error = new Error('Too many redirects')
    error.statusCode = 502
    throw error
  }

  router.get('/ics', async (req, res, next) => {
    const url = normalizeFeedUrl(req.query.url)
    if (!url) return res.status(400).json({ error: 'A valid http(s) feed URL is required' })
    const handle = async () => {
      try {
        const key = url.href
        const cached = cache.get(key)
        let text = cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.text : null
        if (!text) {
          text = await fetchFeed(url)
          // Only the shared presets are cached: private feeds stay per-request.
          if (CALENDAR_PRESET_URLS.has(key)) {
            if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value)
            cache.set(key, { text, at: Date.now() })
          }
        }
        res.set('Content-Type', 'text/calendar; charset=utf-8')
        res.set('Cache-Control', 'private, max-age=3600')
        res.send(text)
      } catch (error) {
        const status = error.name === 'AbortError' ? 504 : error.statusCode || 502
        res.status(status).json({ error: error.name === 'AbortError' ? 'Upstream timed out' : error.message })
      }
    }
    if (CALENDAR_PRESET_URLS.has(url.href)) return handle()
    return requireAuth(req, res, (error) => (error ? next(error) : handle()))
  })

  return router
}
