// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LifePodcast } from '../../../data/models/types'

let currentPodcast: LifePodcast
const listMock = vi.fn()
const updateMock = vi.fn()

vi.mock('../../../data/repositories/podcastsRepo', () => ({
  podcastsRepo: {
    list: () => listMock(),
    update: (...args: unknown[]) => updateMock(...args),
    create: vi.fn(),
    remove: vi.fn(),
  },
}))

vi.mock('../components/PodcastCardSurface', () => ({
  PodcastCardSurface: ({ selected, onTogglePlaying }: { selected: LifePodcast | null; onTogglePlaying: (id: string) => void }) => (
    <button type="button" onClick={() => selected && onTogglePlaying(selected.id)}>
      {selected?.isPlaying ? 'Pause' : 'Play'}
    </button>
  ),
}))

import PodcastCard from './PodcastCard'

const playMock = vi.fn(async () => undefined)
const pauseMock = vi.fn()
const audioInstances: Array<{ src: string; play: typeof playMock; pause: typeof pauseMock; currentTime: number }> = []

class AudioMock {
  src = ''
  currentTime = 0
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
    playMock.mockClear()
    pauseMock.mockClear()
    audioInstances.length = 0
    currentPodcast = {
      id: 'podcast-1',
      createdAt: 1,
      updatedAt: 1,
      source: 'netease',
      sourceId: '795087630',
      collectionId: 795087630,
      name: 'ChilL 2 DiE',
      author: '我最爱吃螺蛳粉',
      episodes: [
        {
          id: 'episode-1',
          title: 'Nohone - Breath',
          audioUrl: 'https://example.com/audio.mp3',
        },
      ],
      selectedEpisodeId: 'episode-1',
      isPlaying: false,
      lastSyncedAt: 1,
    }
    listMock.mockResolvedValue([currentPodcast])
    updateMock.mockImplementation(async (_id: string, patch: Partial<LifePodcast>) => {
      currentPodcast = { ...currentPodcast, ...patch, updatedAt: currentPodcast.updatedAt + 1 }
      return currentPodcast
    })
    vi.stubGlobal('Audio', AudioMock as unknown as typeof Audio)
    vi.stubEnv('VITE_API_BASE', 'https://api.example.com')
  })

  it('plays netease episodes through the stable stream endpoint', async () => {
    render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))
    expect(audioInstances[0]?.src).toContain('/podcasts/netease/stream?programId=episode-1')
  })

  it('keeps playback alive after the card unmounts', async () => {
    const { unmount } = render(<PodcastCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Play' }))
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1))
    const pauseCallsBeforeUnmount = pauseMock.mock.calls.length

    unmount()

    expect(pauseMock.mock.calls.length).toBe(pauseCallsBeforeUnmount)
  })
})
