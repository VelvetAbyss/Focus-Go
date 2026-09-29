import type { LanguageCode } from '../../../shared/i18n/types'
import { QUOTES, type QuoteEntry } from './quotes'

export type DashboardQuote = {
  /** Stable position in the library, so the header can key its entrance. */
  id: number
  content: string
  author: string
  /** The line as first written, when the shown text is a translation. */
  original: { content: string; author: string } | null
  language: LanguageCode
}

/** Days since 1970-01-01 for the local calendar date. */
const dayNumber = (date: Date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)

const seededShuffle = <T,>(items: T[], seed: number) => {
  const out = [...items]
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The order days walk through: each side shuffled, then woven together in
 * proportion so Chinese and international lines alternate evenly.
 */
const buildOrder = (quotes: QuoteEntry[]) => {
  const indexes = quotes.map((_, index) => index)
  const home = seededShuffle(indexes.filter((index) => quotes[index].origin === 'zh'), 20260928)
  const away = seededShuffle(indexes.filter((index) => quotes[index].origin === 'intl'), 19700101)
  const order: number[] = []
  let h = 0
  let a = 0
  while (h < home.length || a < away.length) {
    const takeHome = a >= away.length || (h < home.length && h / home.length <= a / away.length)
    order.push(takeHome ? home[h++] : away[a++])
  }
  return order
}

const ORDER = buildOrder(QUOTES)

const present = (id: number, language: LanguageCode): DashboardQuote => {
  const entry = QUOTES[id]
  const shownSide = language === 'zh' ? 'zh' : 'intl'
  const translated = entry.origin !== shownSide
  const firstWritten = entry.origin === 'zh' ? { content: entry.zh, author: entry.by.zh } : { content: entry.en, author: entry.by.en }
  return {
    id,
    content: language === 'zh' ? entry.zh : entry.en,
    author: language === 'zh' ? entry.by.zh : entry.by.en,
    original: translated ? firstWritten : null,
    language,
  }
}

/**
 * The quote for a calendar day. The same day always gives the same line, in
 * either language; `skip` steps to the next ones for "another quote".
 */
export const quoteForDay = (date: Date, language: LanguageCode, skip = 0): DashboardQuote => {
  const position = (((dayNumber(date) + skip) % ORDER.length) + ORDER.length) % ORDER.length
  return present(ORDER[position], language)
}

export const QUOTE_COUNT = QUOTES.length
