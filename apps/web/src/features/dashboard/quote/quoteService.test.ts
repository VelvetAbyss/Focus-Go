import { describe, expect, it } from 'vitest'
import { QUOTE_COUNT, quoteForDay } from './quoteService'
import { QUOTES } from './quotes'

const CJK = /[㐀-鿿]/

describe('quote library', () => {
  it('has a real mix of Chinese and international lines', () => {
    const home = QUOTES.filter((quote) => quote.origin === 'zh').length
    const away = QUOTES.filter((quote) => quote.origin === 'intl').length
    expect(QUOTES.length).toBeGreaterThanOrEqual(100)
    expect(home).toBeGreaterThanOrEqual(40)
    expect(away).toBeGreaterThanOrEqual(40)
  })

  it('carries both languages and a source for every line', () => {
    for (const quote of QUOTES) {
      expect(quote.zh, quote.en).toMatch(CJK)
      expect(quote.en, quote.zh).not.toMatch(CJK)
      expect(quote.by.zh.trim(), quote.zh).not.toBe('')
      expect(quote.by.en.trim(), quote.en).not.toBe('')
    }
  })

  it('fits the header and uses typographic punctuation', () => {
    for (const quote of QUOTES) {
      expect(quote.zh.length, quote.zh).toBeLessThanOrEqual(40)
      expect(quote.en.length, quote.en).toBeLessThanOrEqual(130)
      // The header wraps the line in curly quotes; straight ones would clash.
      expect(quote.zh, quote.zh).not.toMatch(/["']/)
      expect(quote.en, quote.en).not.toMatch(/["]/)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(QUOTES.map((quote) => quote.zh)).size).toBe(QUOTES.length)
    expect(new Set(QUOTES.map((quote) => quote.en)).size).toBe(QUOTES.length)
  })
})

describe('quoteForDay', () => {
  const day = new Date(2026, 8, 28, 9, 30)

  it('keeps one line for the whole day', () => {
    const morning = quoteForDay(new Date(2026, 8, 28, 0, 1), 'zh')
    const night = quoteForDay(new Date(2026, 8, 28, 23, 59), 'zh')
    expect(night).toEqual(morning)
  })

  it('shows the same line in both languages, noting the original when translated', () => {
    const zh = quoteForDay(day, 'zh')
    const en = quoteForDay(day, 'en')
    expect(en.id).toBe(zh.id)
    expect(zh.content).toMatch(CJK)
    expect(en.content).not.toMatch(CJK)
    const translated = zh.original ?? en.original
    expect(translated).not.toBeNull()
    expect(zh.original === null).not.toBe(en.original === null)
  })

  it('moves to a new line each day and on "another quote"', () => {
    const today = quoteForDay(day, 'zh')
    const tomorrow = quoteForDay(new Date(2026, 8, 29), 'zh')
    const another = quoteForDay(day, 'zh', 1)
    expect(tomorrow.id).not.toBe(today.id)
    expect(another.id).toBe(tomorrow.id)
  })

  it('walks through every line before repeating', () => {
    const seen = new Set<number>()
    for (let offset = 0; offset < QUOTE_COUNT; offset++) seen.add(quoteForDay(day, 'en', offset).id)
    expect(seen.size).toBe(QUOTE_COUNT)
    expect(quoteForDay(day, 'en', QUOTE_COUNT).id).toBe(quoteForDay(day, 'en').id)
  })

  it('alternates Chinese and international lines without long runs', () => {
    let run = 1
    let longest = 1
    for (let offset = 1; offset < QUOTE_COUNT; offset++) {
      const same = QUOTES[quoteForDay(day, 'zh', offset).id].origin === QUOTES[quoteForDay(day, 'zh', offset - 1).id].origin
      run = same ? run + 1 : 1
      longest = Math.max(longest, run)
    }
    expect(longest).toBeLessThanOrEqual(2)
  })
})
