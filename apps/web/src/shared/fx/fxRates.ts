import { fetchApi } from '../apiBase'

/**
 * Live exchange rates (per 1 USD), kept in this browser for six hours. Fetched straight from a
 * keyless public source, or through our API when that isn't reachable (mainland China).
 * The app's conversions fall back to fixed rates until a first answer arrives.
 */
const DIRECT_URL = 'https://open.er-api.com/v6/latest/USD'
const CACHE_KEY = 'focusgo.fx.v1'
const FRESH_MS = 6 * 60 * 60 * 1000

export type FxSnapshot = { rates: Record<string, number>; updatedAt: number; fetchedAt: number }

let memo: FxSnapshot | null | undefined

export const readFxSnapshot = (): FxSnapshot | null => {
  if (memo !== undefined) return memo
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null') as FxSnapshot | null
    memo = parsed && parsed.rates && typeof parsed.rates.CNY === 'number' ? parsed : null
  } catch {
    memo = null
  }
  return memo
}

const store = (snapshot: FxSnapshot) => {
  memo = snapshot
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot))
  } catch {
    // kept in memory for this session
  }
}

/** CNY for one unit of `currency` from live rates, or null without them. */
export const liveCnyPer = (currency: string): number | null => {
  const snapshot = readFxSnapshot()
  const perUsd = snapshot?.rates[currency]
  return snapshot && perUsd ? snapshot.rates.CNY / perUsd : null
}

const fromDirect = async (signal?: AbortSignal) => {
  const response = await fetch(DIRECT_URL, { signal })
  if (!response.ok) throw new Error(`fx ${response.status}`)
  const body = (await response.json()) as { result?: string; base_code?: string; rates?: Record<string, number>; time_last_update_unix?: number }
  if (body.result !== 'success' || body.base_code !== 'USD' || !body.rates?.CNY) throw new Error('fx body')
  return { rates: body.rates, updatedAt: (body.time_last_update_unix ?? Date.now() / 1000) * 1000 }
}

const fromApi = async () => {
  const response = await fetchApi('/fx/latest')
  if (!response.ok) throw new Error(`fx api ${response.status}`)
  const body = (await response.json()) as { rates?: Record<string, number>; updatedAt?: number }
  if (!body.rates?.CNY) throw new Error('fx api body')
  return { rates: body.rates, updatedAt: body.updatedAt ?? Date.now() }
}

let inflight: Promise<FxSnapshot | null> | null = null

/** Fresh rates from the cache, or fetched; the last ones known if both sources fail. */
export const loadFxRates = (force = false): Promise<FxSnapshot | null> => {
  const cached = readFxSnapshot()
  if (!force && cached && Date.now() - cached.fetchedAt < FRESH_MS) return Promise.resolve(cached)
  inflight ??= (async () => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 6000)
    try {
      const result = await fromDirect(controller.signal).catch(() => fromApi())
      const snapshot = { ...result, fetchedAt: Date.now() }
      store(snapshot)
      return snapshot
    } catch {
      return cached
    } finally {
      window.clearTimeout(timer)
      inflight = null
    }
  })()
  return inflight
}

/** Test seam: forget the in-memory copy. */
export const resetFxMemo = () => {
  memo = undefined
}
