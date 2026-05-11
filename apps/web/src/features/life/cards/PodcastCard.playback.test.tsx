// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LifePodcast } from '../../../data/models/types'
import { NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY } from '../../../shared/prefs/preferences'
import { resetPodcastPlaybackForTests } from '../podcastPlayback'

let currentPodcast: LifePodcast
const listMock = vi.fn()
const updateMock = vi.fn()
const removeMock = vi.fn()
let openMock: ReturnType<typeof vi.fn>

vi.mock('../lifeI18n', () => ({
  useLifeI18n: () => ({
    t: (key: string, values?: Record<string, string | number>) => {
      const messages: Record<string, string> = {
        'life.podcast.stats': '{{podcasts}} podcasts · {{episodes}} episodes',
        'life.podcast.error.noPlayable': 'No playable episode',
        'life.podcast.error.sourceUnavailable': 'Source unavailable',
        'life.podcast.error.playbackBlocked': 'Playback blocked',
        'life.podcast.error.playbackFailed': 'Playback failed',
        'life.podcast.error.import.login': 'Login required',
        'life.podcast.error.import.notDeployed': 'Not deployed',
        'life.podcast.error.import.invalidSession': 'Invalid session',
        'life.podcast.error.import.limit': 'Limit {{limit}}',
        'life.podcast.error.import.failed': 'Import failed',
        'life.podcast.error.refresh.notDeployed': 'Not deployed',
        'life.podcast.error.refresh.invalidSession': 'Invalid session',
        'life.podcast.error.refresh.failed': 'Refresh failed',
        'life.podcast.error.searchFailed': 'Search failed',
        'life.podcast.netease': 'Netease',
        'life.podcast.apple': 'Apple',
      }
      const template = messages[key] ?? key
      return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name) => String(values?.[name] ?? `{{${name}}}`))
    },
  }),
}))

vi.mock('../../../data/repositories/podcastsRepo', () => ({
  podcastsRepo: {
    list: () => listMock(),
    update: (...args: unknown[]) => updateMock(...args),
    create: vi.fn(),
    remove: (...args: unknown[]) => removeMock(...args),
  },
}))

vi.mock('../../../shared/prefs/usePreferences', () => ({
  usePreferences: () => ({
    neteaseExperimentalPlaybackEnabled: window.localStorage.getItem(NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY) === 'true',
  }),
}))

vi.mock('../components/PodcastCardSurface', () => ({
  PodcastCardSurface: ({
    selected,
    onTogglePlaying,
    onRemoveItem,
  }: {
    selected: LifePodcast | null
    onTogglePlaying: (id: string) => void
    onRemoveItem: (id: string) => void
  }) => (
    <>
      <button type="button" onClick={() => selected && onTogglePlaying(selected.id)}>
        {selected?.isPlaying ? 'Pause' : 'Play'}
      </button>
      <button type="button" onClick={() => selected && onRemoveItem(selected.id)}>Remove</button>
    </>
  ),
}))

import PodcastCard from './PodcastCard'

const playMock = vi.fn(async () => undefined)
const pauseMock = vi.fn()
const audioInstances: Array<{
  src: string
  play: typeof playMock
  pause: typeof pauseMock
  currentTime: number
  onended: (() => void | Promise<void>) | null
}> = []

class AudioMock {
  src = ''
  currentTime = 0
  onended: (() => void | Promise<void>) | null = null
  play = playMock
  pause = pauseMock

  constructor() {
    audioInstances.push(this)
  }
}

describe('PodcastCard playback', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    resetPodcastPlaybackForTests()
    playMock.mockClear()
    pauseMock.mockClear()
    audioInstances.length = 0
    removeMock.mockReset()
    window.localStorage.clear()
    openMock = vi.fn()
    currentPodcast = {
      id: 'podcast-1',
      createdAt: 1,
      updatedAt: 1,
      source: 'netease',
      sourceId: '795087630',
      collectionId: 795087630,
      name: 'ChilL 2 DiE',
      author: '我最爱吃螺蛳粉',
      externalUrl: 'https://music.163.com/djradio?id=795087630',
      episodes: [
        {
          id: 'episode-1',
          title: 'Nohone - Breath',
          audioUrl: 'https://example.com/audio.mp3',
          externalUrl: 'https://music.163.com/program?id=episode-1',
        },
      ],
      selectedEpisodeId: 'episode-1',
      isPlaying: false,
      lastSyncedAt: 1,
    }
    listMock.mockImplementation(async () => [currentPodcast])
    updateMock.mockImplementation(async (_id: string, patch: Partial<LifePodcast>) => {
      currentPodcast = { ...currentPodcast, ...patch, updatedAt: currentPodcast.updatedAt + 1 }
      return currentPodcast
    })
    vi.stubGlobal('Audio', AudioMock as unknown as typeof Audio)
    window.open = openMock as unknown as typeof window.open
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com')
  })

  it('plays netease episodes through the stable stream endpoint', async () => {
    window.localStorage.setItem(NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY, 'true')
    render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))
    expect(audioInstances[0]?.src).toContain('/podcasts/netease/stream?programId=episode-1')
  })

  it('does not play netease in app when experimental playback is disabled', async () => {
    window.localStorage.setItem('focusgo.podcast.neteaseExperimentalPlayback.enabled', 'false')

    render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))

    await waitFor(() => expect(openMock).toHaveBeenCalled())
    expect(playMock).not.toHaveBeenCalled()
  })

  it('keeps playback alive after the card unmounts', async () => {
    window.localStorage.setItem(NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY, 'true')
    const { unmount } = render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))
    const pauseCallsBeforeUnmount = pauseMock.mock.calls.length

    unmount()

    expect(pauseMock.mock.calls.length).toBe(pauseCallsBeforeUnmount)
  })

  it('continues with the next episode when the current episode ends', async () => {
    window.localStorage.setItem(NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY, 'true')
    currentPodcast = {
      ...currentPodcast,
      episodes: [
        ...currentPodcast.episodes,
        {
          id: 'episode-2',
          title: 'Next',
          externalUrl: 'https://music.163.com/program?id=episode-2',
        },
      ],
    }
    render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))

    await audioInstances[0]?.onended?.()

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2))
    expect(currentPodcast.selectedEpisodeId).toBe('episode-2')
    expect(currentPodcast.isPlaying).toBe(true)
    expect(audioInstances[0]?.src).toContain('/podcasts/netease/stream?programId=episode-2')
  })

  it('stops active netease playback when the podcast is removed', async () => {
    window.localStorage.setItem('focusgo.podcast.neteaseExperimentalPlayback.enabled', 'true')
    removeMock.mockResolvedValue(undefined)
    const { rerender } = render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))

    window.localStorage.setItem('focusgo.podcast.neteaseExperimentalPlayback.enabled', 'false')
    fireEvent(window, new StorageEvent('storage', {
      key: 'focusgo.podcast.neteaseExperimentalPlayback.enabled',
      newValue: 'false',
    }))

    rerender(<PodcastCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

    await waitFor(() => expect(pauseMock).toHaveBeenCalled())
  })
})
