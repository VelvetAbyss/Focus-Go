import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchRemoteMedia } from './mediaApi'

describe('mediaApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('searches TMDB in zh-CN first and merges the en-US fallback without duplicates', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ id: 1, media_type: 'tv', name: '繁花', first_air_date: '2023-12-27' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { id: 1, media_type: 'tv', name: 'Blossoms Shanghai', first_air_date: '2023-12-27' },
            { id: 2, media_type: 'movie', title: 'Blossoms', release_date: '2024-01-01' },
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const results = await searchRemoteMedia('繁花')

    expect(fetchMock.mock.calls[0]?.[0]).toContain('language=zh-CN')
    expect(fetchMock.mock.calls[1]?.[0]).toContain('language=en-US')
    expect(results.map((item) => item.tmdbId)).toEqual([1, 2])
    expect(results[0]?.title).toBe('繁花')
  })
})
