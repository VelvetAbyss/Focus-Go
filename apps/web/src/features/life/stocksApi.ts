export type RemoteStockCandidate = {
  symbol: string
  name: string
  exchange?: string
  currency: string
  lastPrice?: number
  change?: number
  changePercent?: number
  chartPoints?: number[]
  lastSyncedAt?: number
}

type QuotePayload = Record<string, unknown> & {
  status?: string
  message?: string
  name?: string
  exchange?: string
  currency?: string
  open?: string | number
  low?: string | number
  high?: string | number
  close?: string | number
  price?: string | number
  change?: string | number
  percent_change?: string | number
}

const getTwelveDataKey = () => import.meta.env.VITE_TWELVEDATA_API_KEY?.trim()

const fetchJson = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Request failed: ${response.status}`)
  return response.json() as Promise<T>
}

const toNumber = (value: unknown) => {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(numeric) ? numeric : undefined
}

export const hasTwelveDataKey = () => Boolean(getTwelveDataKey())

export const searchRemoteStocks = async (query: string, signal?: AbortSignal): Promise<RemoteStockCandidate[]> => {
  const accessKey = getTwelveDataKey()
  if (!accessKey) return []

  const tickerUrl = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=8&apikey=${encodeURIComponent(accessKey)}`
  const tickerPayload = await fetchJson<{ data?: Array<Record<string, unknown>>; status?: string; message?: string }>(tickerUrl, signal)
  if (tickerPayload.status === 'error') throw new Error(tickerPayload.message ?? 'Search failed')

  const tickers = (tickerPayload.data ?? [])
    .filter((item) => String(item.instrument_type ?? '').toLowerCase() === 'common_stock' || String(item.instrument_type ?? '').toLowerCase() === 'etf')
    .slice(0, 6)

  const enriched = await Promise.all(
    tickers.map<Promise<RemoteStockCandidate | null>>(async (item) => {
      const symbol = String(item.symbol ?? '').toUpperCase()
      if (!symbol) return null
      const quoteUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(accessKey)}`
      const quote = await fetchJson<QuotePayload>(quoteUrl, signal).catch(() => ({}) as QuotePayload)
      if (quote.status === 'error') {
        return {
          symbol,
          name: String(item.instrument_name ?? item.symbol ?? symbol),
          exchange: typeof item.exchange === 'string' ? item.exchange : undefined,
          currency: typeof item.currency === 'string' ? item.currency : 'USD',
          lastSyncedAt: Date.now(),
        } satisfies RemoteStockCandidate
      }

      const chartPoints = [quote.open, quote.low, quote.high, quote.close]
        .map(toNumber)
        .filter((value): value is number => typeof value === 'number')

      return {
        symbol,
        name: String(item.instrument_name ?? quote.name ?? symbol),
        exchange: typeof item.exchange === 'string' ? item.exchange : typeof quote.exchange === 'string' ? quote.exchange : undefined,
        currency: typeof item.currency === 'string' ? item.currency : typeof quote.currency === 'string' ? quote.currency : 'USD',
        lastPrice: toNumber(quote.close ?? quote.price),
        change: toNumber(quote.change),
        changePercent: toNumber(quote.percent_change),
        chartPoints: chartPoints.length ? chartPoints : undefined,
        lastSyncedAt: Date.now(),
      } satisfies RemoteStockCandidate
    }),
  )

  return enriched.filter((item): item is RemoteStockCandidate => item !== null)
}
