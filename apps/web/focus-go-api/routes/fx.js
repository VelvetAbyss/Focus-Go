import { Router } from 'express'

// Exchange rates for the dashboard's rate card. Calls one fixed upstream (no user input, so
// nothing to steer), keeps the answer for six hours, and answers from the stale copy if the
// upstream is down. It exists because the upstream isn't reliably reachable from mainland China.

export const FX_UPSTREAM = 'https://open.er-api.com/v6/latest/USD'
const FX_TTL_MS = 6 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 8_000
const KEPT = ['CNY', 'USD', 'CAD', 'EUR', 'GBP', 'JPY', 'HKD', 'AUD', 'MXN']

/** The upstream body reduced to the currencies the app uses, or null when it doesn't look right. */
export const pickRates = (body) => {
  if (!body || body.result !== 'success' || typeof body.rates !== 'object' || body.base_code !== 'USD') return null
  const rates = {}
  for (const code of KEPT) {
    const value = body.rates[code]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) rates[code] = value
  }
  if (!rates.CNY) return null
  const updatedAt = Number(body.time_last_update_unix) * 1000
  return { base: 'USD', rates, updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now() }
}

export const createFxRouter = ({ fetchImpl = fetch, now = Date.now } = {}) => {
  const router = Router()
  let cached = null

  router.get('/latest', async (_req, res) => {
    if (cached && now() - cached.at < FX_TTL_MS) {
      res.set('Cache-Control', 'public, max-age=1800')
      return res.json(cached.data)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const response = await fetchImpl(FX_UPSTREAM, { signal: controller.signal, headers: { accept: 'application/json' } })
      const data = response.ok ? pickRates(await response.json()) : null
      if (!data) throw new Error('Unexpected upstream response')
      cached = { data, at: now() }
      res.set('Cache-Control', 'public, max-age=1800')
      return res.json(data)
    } catch {
      if (cached) return res.json({ ...cached.data, stale: true })
      return res.status(502).json({ error: 'Exchange rates are unavailable right now' })
    } finally {
      clearTimeout(timer)
    }
  })

  return router
}
