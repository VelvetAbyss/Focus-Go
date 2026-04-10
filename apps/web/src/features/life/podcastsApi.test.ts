import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractNeteaseRadioId, importNeteasePodcast, isNeteasePodcastUrl, NETEASE_CHANNEL_PRESETS } from './podcastsApi'

vi.mock('../../store/auth', () => ({
  getAuth: () => ({ accessToken: 'token-123' }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('podcastsApi', () => {
  it('detects and parses netease channel urls', () => {
    expect(isNeteasePodcastUrl('https://music.163.com/djradio?id=796756498')).toBe(true)
    expect(extractNeteaseRadioId('https://music.163.com/#/djradio?id=795087630')).toBe('795087630')
    expect(NETEASE_CHANNEL_PRESETS).toHaveLength(2)
  })

  it('imports a netease podcast through the api', async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          podcast: {
            source: 'netease',
            sourceId: '796756498',
            collectionId: 796756498,
            name: 'Just Some Collections',
            author: '我最爱吃螺蛳粉',
            episodes: [{ id: '2539083386', title: 'alice cullen 【playlist】', audioUrl: 'https://example.com/audio.mp3' }],
          },
        }),
      }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com')

    const podcast = await importNeteasePodcast('https://music.163.com/djradio?id=796756498')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(podcast.source).toBe('netease')
    expect(podcast.episodes[0]?.audioUrl).toContain('audio.mp3')
  })

  it('surfaces backend status details when import fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: false,
          status: 404,
          text: async () => 'Cannot POST /podcasts/netease/import',
        }) as Response,
      ),
    )
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com')

    await expect(importNeteasePodcast('https://music.163.com/djradio?id=796756498')).rejects.toThrow(
      'Podcast request failed: 404 Cannot POST /podcasts/netease/import',
    )
  })
})
