import { Router, json } from 'express'

export const PUBLIC_PAGES = ['/', '/zh/', '/features/pomodoro/', '/zh/features/pomodoro/', '/features/local-first/', '/zh/features/local-first/', '/guides/task-to-focus/', '/zh/guides/task-to-focus/', '/about/', '/zh/about/', '/privacy/', '/zh/privacy/', '/terms/', '/zh/terms/']
const WEBSITE = 'https://nestflow.art'
const APPLICATION = 'https://app.nestflow.art'
const RETENTION_DAYS = 90

export function ensureAnonymousCounts(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS anonymous_daily_counts (
    day TEXT NOT NULL, event TEXT NOT NULL, page TEXT NOT NULL,
    language TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, event, page, language)
  )`)
}

export function pruneAnonymousCounts(database, now = Date.now()) {
  const cutoff = new Date(now - (RETENTION_DAYS - 1) * 86400000).toISOString().slice(0, 10)
  database.prepare('DELETE FROM anonymous_daily_counts WHERE day < ?').run(cutoff)
}

export function readAnonymousCounts(database, days = 28, now = Date.now()) {
  ensureAnonymousCounts(database)
  pruneAnonymousCounts(database, now)
  const requested = ['number', 'string'].includes(typeof days) ? Number(days) : 28
  const windowDays = Math.min(90, Math.max(1, Math.trunc(requested || 28)))
  const since = new Date(now - (windowDays - 1) * 86400000).toISOString().slice(0, 10)
  return { timezone: 'UTC', days: windowDays, since, unit: 'events, not unique users',
    rows: database.prepare('SELECT day, event, page, language, count FROM anonymous_daily_counts WHERE day >= ? ORDER BY day, event, page, language').all(since) }
}

export function createAnonymousCountsRouter({ database, now = Date.now, limitPerMinute = 600 }) {
  ensureAnonymousCounts(database)
  const router = Router()
  // One bounded global budget, with no IP/session identifiers or per-request rows.
  let minute = -1, received = 0, lastPruneDay = ''
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.sendStatus(405)
    if (![WEBSITE, APPLICATION].includes(req.get('origin'))) return res.sendStatus(403)
    if (req.get('DNT') === '1' || req.get('Sec-GPC') === '1') return res.sendStatus(204)
    if (req.get('cookie') || req.get('authorization') || Object.keys(req.query).length) return res.sendStatus(400)
    if (!req.is('application/json')) return res.sendStatus(415)
    const currentMinute = Math.floor(now() / 60000)
    if (minute !== currentMinute) { minute = currentMinute; received = 0 }
    if (++received > limitPerMinute) return res.sendStatus(429)
    return next()
  })
  router.post('/', json({ limit: 512 }), (req, res) => {
    const body = req.body
    if (!body || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'event,language,page') return res.sendStatus(400)
    const { event, page, language } = body
    if (!['en', 'zh-CN'].includes(language)) return res.sendStatus(400)
    const fromWebsite = req.get('origin') === WEBSITE
    if (fromWebsite) {
      if (!['website_view', 'app_open'].includes(event) || !PUBLIC_PAGES.includes(page)) return res.sendStatus(400)
      if (language !== (page.startsWith('/zh/') ? 'zh-CN' : 'en')) return res.sendStatus(400)
    } else if (event !== 'first_success' || page !== 'app') return res.sendStatus(400)
    try {
      const day = new Date(now()).toISOString().slice(0, 10)
      if (lastPruneDay !== day) {
        pruneAnonymousCounts(database, now())
        lastPruneDay = day
      }
      database.prepare(`INSERT INTO anonymous_daily_counts (day,event,page,language,count) VALUES (?,?,?,?,1)
        ON CONFLICT(day,event,page,language) DO UPDATE SET count=count+1`).run(day, event, page, language)
      return res.sendStatus(204)
    } catch {
      // Do not log incoming headers, payloads or network identifiers.
      return res.sendStatus(503)
    }
  })
  router.use((error, _req, res, _next) => res.sendStatus(error.type === 'entity.too.large' ? 413 : 400))
  return router
}
