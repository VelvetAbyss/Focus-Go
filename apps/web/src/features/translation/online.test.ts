// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { translateOnline } from './online'

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('free anonymous online translation', () => {
  it('sends only the text and language pair, splitting UTF-8 safely and preserving paragraphs', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'Translated.' } })))
    vi.stubGlobal('fetch', fetcher)
    const result = await translateOnline('中'.repeat(180) + '\n\n第二段', 'zh', 'en', new AbortController().signal)
    expect(result).toBe('Translated. Translated.\n\nTranslated.')
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const [request] of fetcher.mock.calls as unknown as [URL][]) {
      expect(request.origin).toBe('https://api.mymemory.translated.net')
      expect([...request.searchParams.keys()].sort()).toEqual(['langpair', 'q'])
      expect(new TextEncoder().encode(request.searchParams.get('q')!).length).toBeLessThanOrEqual(450)
    }
  })

  it('stops the remaining requests when quota is exhausted and remembers the stop for today', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ responseStatus: 200, quotaFinished: true, responseData: { translatedText: 'LIMIT REACHED' } })))
    vi.stubGlobal('fetch', fetcher)
    const run = () => translateOnline('first\n\nsecond', 'en', 'zh', new AbortController().signal)
    await expect(run()).rejects.toMatchObject({ code: 'quota' })
    await expect(run()).rejects.toMatchObject({ code: 'quota' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('stops an in-flight multi-paragraph job after another request exhausts the quota', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve }))
      .mockResolvedValue(new Response('limited', { status: 429 }))
    vi.stubGlobal('fetch', fetcher)
    const first = translateOnline('first\n\nsecond', 'en', 'zh', new AbortController().signal)
    await expect(translateOnline('another', 'en', 'zh', new AbortController().signal)).rejects.toMatchObject({ code: 'quota' })
    finish(new Response(JSON.stringify({ responseStatus: 200, responseData: { translatedText: 'Translated.' } })))
    await expect(first).rejects.toMatchObject({ code: 'quota' })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit' })
  })

  it('handles HTTP rate limiting without retrying or showing the error as a translation', async () => {
    const fetcher = vi.fn(async () => new Response('limited', { status: 429 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(translateOnline('Hello', 'en', 'zh', new AbortController().signal)).rejects.toMatchObject({ code: 'quota' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed or error responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ responseStatus: 400, responseData: { translatedText: 'Bad language' } }))))
    await expect(translateOnline('Hello', 'en', 'zh', new AbortController().signal)).rejects.toMatchObject({ code: 'network' })
  })

  it('never retries network errors or switches to a paid provider', async () => {
    const fetcher = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    vi.stubGlobal('fetch', fetcher)
    await expect(translateOnline('Hello', 'en', 'zh', new AbortController().signal)).rejects.toMatchObject({ code: 'network' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
