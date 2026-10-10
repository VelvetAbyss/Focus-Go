/**
 * The dashboard quote's own state: which library the header draws from and
 * the lines you wrote to yourself. One JSON value in localStorage, carried
 * across devices inside the synced preferences (syncedPreferencesRepo). No React.
 */

export type QuoteLibrary = 'default' | 'mine'

export type OwnQuote = {
  id: string
  text: string
  /** Who said it, for a library line you kept; absent for your own words. */
  author?: string
  addedAt: number
}

export type QuoteState = {
  library: QuoteLibrary
  /** Oldest first; the day's rotation walks them in this order. */
  mine: OwnQuote[]
}

export const QUOTE_STORAGE_KEY = 'focusgo.dashboard.quotes'
export const MAX_OWN_QUOTES = 100
// Room for the longest library line (130 in English), so a kept line is never cut.
export const MAX_OWN_QUOTE_LENGTH = 140
const MAX_AUTHOR_LENGTH = 60

export const EMPTY_QUOTE_STATE: QuoteState = { library: 'default', mine: [] }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

// The header adds its own curly quotes, so a pasted pair around the line goes.
const WRAPPING_QUOTES = /^["“”'‘’「『]+|["“”'‘’」』]+$/g

/** A line as typed, made ready to keep: one line, no wrapping quotes, capped. */
export const cleanOwnQuote = (text: string) =>
  text.replace(/\s+/g, ' ').trim().replace(WRAPPING_QUOTES, '').trim().slice(0, MAX_OWN_QUOTE_LENGTH)

export const normalizeQuoteState = (raw: unknown): QuoteState => {
  if (!isRecord(raw)) return EMPTY_QUOTE_STATE
  const mine: OwnQuote[] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(raw.mine) ? raw.mine : []) {
    if (!isRecord(item) || typeof item.id !== 'string' || seen.has(item.id)) continue
    if (typeof item.text !== 'string' || typeof item.addedAt !== 'number' || !Number.isFinite(item.addedAt)) continue
    const text = cleanOwnQuote(item.text)
    if (!text) continue
    seen.add(item.id)
    const author = typeof item.author === 'string' ? item.author.trim().slice(0, MAX_AUTHOR_LENGTH) : ''
    mine.push(author ? { id: item.id, text, author, addedAt: item.addedAt } : { id: item.id, text, addedAt: item.addedAt })
  }
  return { library: raw.library === 'mine' ? 'mine' : 'default', mine: mine.slice(-MAX_OWN_QUOTES) }
}

export const readQuoteState = (): QuoteState => {
  if (typeof window === 'undefined') return EMPTY_QUOTE_STATE
  try {
    const raw = window.localStorage.getItem(QUOTE_STORAGE_KEY)
    return raw ? normalizeQuoteState(JSON.parse(raw)) : EMPTY_QUOTE_STATE
  } catch {
    return EMPTY_QUOTE_STATE
  }
}

export const writeQuoteState = (state: QuoteState) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUOTE_STORAGE_KEY, JSON.stringify(normalizeQuoteState(state)))
  } catch {
    // Storage full or blocked: the change is not kept.
  }
}
