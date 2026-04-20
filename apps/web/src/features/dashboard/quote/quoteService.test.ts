import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDashboardQuote, getLocalDashboardQuote, sanitizeChineseQuotes } from './quoteService'

const jsonResponse = (data: unknown, ok = true) =>
  ({
    ok,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as Response

const textResponse = (data: string, ok = true) =>
  ({
    ok,
    json: async () => JSON.parse(data) as unknown,
    text: async () => data,
  }) as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('quoteService', () => {
  it('falls back from DWYL to JamesFT for English quotes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('dwyl/quotes')) return jsonResponse([], false)
      if (url.includes('JamesFT/Database-Quotes-JSON')) {
        return jsonResponse([{ quoteText: 'Keep going', quoteAuthor: 'Unknown' }])
      }
      throw new Error(`unexpected url: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const quote = await getDashboardQuote('en')

    expect(quote).toMatchObject({
      content: 'Keep going',
      author: 'Unknown',
      source: 'JamesFT/Database-Quotes-JSON',
      language: 'en',
    })
  })

  it('falls back to the local quote pack when every remote source fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return textResponse('', false)
      }),
    )

    const quote = await getDashboardQuote('zh')

    expect(quote.source).toBe('focus-go/local-selected-quotes')
    expect(quote.content.length).toBeGreaterThan(0)
    expect(quote.author.length).toBeGreaterThan(0)
  })

  it('prefers the curated local Chinese quote pack', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const quote = await getDashboardQuote('zh')

    expect(quote.source).toBe('focus-go/local-selected-quotes')
    expect(quote.language).toBe('zh')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('filters invalid Chinese quote candidates', () => {
    const quotes = sanitizeChineseQuotes([
      { content: 'Keep going', author: 'Unknown', source: 'test' },
      { content: '', author: 'Unknown', source: 'test' },
      { content: '这是一段明显过长的中文内容，会超过当前顶部 quote 区域可以稳定承载的长度，所以应该被过滤掉。', author: 'Unknown', source: 'test' },
      { content: '行稳致远。', author: 'Unknown', source: 'test' },
    ])

    expect(quotes).toEqual([{ content: '行稳致远。', author: '中文谚语', source: 'test' }])
  })

  it('returns a local fallback quote immediately when requested', () => {
    const quote = getLocalDashboardQuote('en')

    expect(quote.source).toBe('snakeek/wisdom-quotes')
    expect(quote.language).toBe('en')
  })
})
