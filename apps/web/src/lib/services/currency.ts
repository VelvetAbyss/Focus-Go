/**
 * Exchange-rate helper backed by exchangerate.host (no API key).
 *
 * We cache aggressively because rates don't move much over a day and a typical
 * trip has many expenses in the same currency pair. Failures return null so
 * callers can fall back to showing the raw amount without conversion.
 */

const SIX_HOURS = 6 * 60 * 60 * 1000

type CacheEntry = { rate: number | null; expiresAt: number }

const cache = new Map<string, CacheEntry>()

const cacheKey = (from: string, to: string, date?: string) => `${from}>${to}|${date ?? 'latest'}`

type LatestResponse = { result?: number; rates?: Record<string, number> }

const fetchRate = async (from: string, to: string, date?: string): Promise<number | null> => {
  const base = date && date !== 'latest' ? date : 'latest'
  // exchangerate.host: /<date>?base=USD&symbols=JPY  → { rates: { JPY: 150.4 } }
  const url = `https://api.exchangerate.host/${base}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as LatestResponse
  const rate = data.rates?.[to]
  return typeof rate === 'number' && rate > 0 ? rate : null
}

export const getRate = async (from: string, to: string, date?: string): Promise<number | null> => {
  const normalizedFrom = from?.trim().toUpperCase()
  const normalizedTo = to?.trim().toUpperCase()
  if (!normalizedFrom || !normalizedTo) return null
  if (normalizedFrom === normalizedTo) return 1

  const key = cacheKey(normalizedFrom, normalizedTo, date)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.rate

  try {
    const rate = await fetchRate(normalizedFrom, normalizedTo, date)
    cache.set(key, { rate, expiresAt: Date.now() + (rate ? SIX_HOURS : 5 * 60 * 1000) })
    return rate
  } catch {
    cache.set(key, { rate: null, expiresAt: Date.now() + 5 * 60 * 1000 })
    return null
  }
}

export const convert = async (amount: number, from: string, to: string, date?: string): Promise<number | null> => {
  if (!Number.isFinite(amount)) return null
  const rate = await getRate(from, to, date)
  if (rate == null) return null
  return amount * rate
}
