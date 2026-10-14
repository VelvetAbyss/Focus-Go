import { describe, expect, it } from 'vitest'
import { cleanOwnQuote, MAX_OWN_QUOTE_LENGTH, MAX_OWN_QUOTES, normalizeQuoteState } from './quoteStorage'
import { ownQuoteIndexForDay, skipToOwnQuote } from './quoteService'

describe('cleanOwnQuote', () => {
  it('keeps one line without the quotes the header adds itself', () => {
    expect(cleanOwnQuote('  “先做十分钟，\n再决定要不要停。”  ')).toBe('先做十分钟， 再决定要不要停。')
    expect(cleanOwnQuote('"Keep going."')).toBe('Keep going.')
    expect(cleanOwnQuote('「慢一点也没关系」')).toBe('慢一点也没关系')
  })

  it('caps the length', () => {
    expect(cleanOwnQuote('字'.repeat(MAX_OWN_QUOTE_LENGTH + 20))).toHaveLength(MAX_OWN_QUOTE_LENGTH)
  })
})

describe('normalizeQuoteState', () => {
  it('falls back to the default library with no lines', () => {
    expect(normalizeQuoteState(null)).toEqual({ library: 'default', mine: [] })
    expect(normalizeQuoteState({ library: 'other', mine: 'x' })).toEqual({ library: 'default', mine: [] })
  })

  it('keeps the author of a kept library line, trimmed, and drops a blank one', () => {
    const state = normalizeQuoteState({
      library: 'default',
      mine: [
        { id: 'a', text: '千里之行，始于足下。', author: '  《道德经》 ', addedAt: 1 },
        { id: 'b', text: '先做十分钟', author: '   ', addedAt: 2 },
      ],
    })
    expect(state.mine).toEqual([
      { id: 'a', text: '千里之行，始于足下。', author: '《道德经》', addedAt: 1 },
      { id: 'b', text: '先做十分钟', addedAt: 2 },
    ])
  })

  it('drops broken, blank and repeated lines and keeps the newest ones', () => {
    const state = normalizeQuoteState({
      library: 'mine',
      mine: [
        { id: 'a', text: '第一句', addedAt: 1 },
        { id: 'a', text: '重复的 id', addedAt: 2 },
        { id: 'b', text: '   ', addedAt: 3 },
        { id: 'c', text: 42, addedAt: 4 },
        { id: 'd', text: '第二句', addedAt: Number.NaN },
        { id: 'e', text: '第三句', addedAt: 5 },
      ],
    })
    expect(state).toEqual({
      library: 'mine',
      mine: [
        { id: 'a', text: '第一句', addedAt: 1 },
        { id: 'e', text: '第三句', addedAt: 5 },
      ],
    })

    const many = Array.from({ length: MAX_OWN_QUOTES + 5 }, (_, index) => ({ id: `q${index}`, text: `第${index}句`, addedAt: index + 1 }))
    const kept = normalizeQuoteState({ library: 'mine', mine: many }).mine
    expect(kept).toHaveLength(MAX_OWN_QUOTES)
    expect(kept[0].id).toBe('q5')
  })
})

describe('own quote rotation', () => {
  const day = new Date(2026, 9, 10, 9, 30)

  it('keeps one line for the whole day and walks to the next one the day after', () => {
    const morning = ownQuoteIndexForDay(new Date(2026, 9, 10, 0, 1), 3)
    expect(ownQuoteIndexForDay(new Date(2026, 9, 10, 23, 59), 3)).toBe(morning)
    expect(ownQuoteIndexForDay(new Date(2026, 9, 11, 8, 0), 3)).toBe((morning + 1) % 3)
  })

  it('has nothing to show without lines', () => {
    expect(ownQuoteIndexForDay(day, 0)).toBe(-1)
    expect(skipToOwnQuote(day, 0, 0)).toBe(0)
  })

  it('can bring any line up today, so a line just written shows at once', () => {
    for (let count = 1; count <= 5; count++) {
      for (let index = 0; index < count; index++) {
        expect(ownQuoteIndexForDay(day, count, skipToOwnQuote(day, count, index))).toBe(index)
      }
    }
  })
})
