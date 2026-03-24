import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDashboardQuote, getLocalDashboardQuote } from './quoteService'

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

    expect(quote.source).toBe('snakeek/wisdom-quotes')
    expect(quote.content.length).toBeGreaterThan(0)
    expect(quote.author.length).toBeGreaterThan(0)
  })

  it('returns a local fallback quote immediately when requested', () => {
    const quote = getLocalDashboardQuote('en')

    expect(quote.source).toBe('snakeek/wisdom-quotes')
    expect(quote.language).toBe('en')
  })
})
