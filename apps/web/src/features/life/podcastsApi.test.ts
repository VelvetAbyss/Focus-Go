import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractNeteaseRadioId,
  hydrateRemotePodcastCandidate,
  importNeteasePodcast,
  isNeteasePodcastUrl,
  NETEASE_CHANNEL_PRESETS,
  searchRemotePodcasts,
} from './podcastsApi'

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
            externalUrl: 'https://music.163.com/djradio?id=796756498',
            episodes: [{
              id: '2539083386',
              title: 'alice cullen 【playlist】',
              audioUrl: 'https://example.com/audio.mp3',
              externalUrl: 'https://music.163.com/program?id=2539083386',
            }],
          },
        }),
      }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com')

    const podcast = await importNeteasePodcast('https://music.163.com/djradio?id=796756498')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(podcast.source).toBe('netease')
    expect(podcast.externalUrl).toBe('https://music.163.com/djradio?id=796756498')
    expect(podcast.episodes[0]?.externalUrl).toBe('https://music.163.com/program?id=2539083386')
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

  it('maps apple external urls on search and lookup', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            collectionId: 11,
            collectionName: 'Search Pod',
            artistName: 'Host',
            collectionViewUrl: 'https://podcasts.apple.com/podcast/id11',
          }],
        }),
      } satisfies Partial<Response>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{
            kind: 'podcast-episode',
            trackId: 22,
            trackName: 'Ep 1',
            episodeUrl: 'https://cdn.example.com/ep1.mp3',
            trackViewUrl: 'https://podcasts.apple.com/episode/id22',
          }],
        }),
      } satisfies Partial<Response>)
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const [candidate] = await searchRemotePodcasts('search pod')
    const hydrated = await hydrateRemotePodcastCandidate(candidate!)

    expect(candidate?.externalUrl).toBe('https://podcasts.apple.com/podcast/id11')
    expect(hydrated.episodes[0]?.externalUrl).toBe('https://podcasts.apple.com/episode/id22')
  })
})
