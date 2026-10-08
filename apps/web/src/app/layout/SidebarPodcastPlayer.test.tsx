// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LifePodcast } from '../../data/models/types'
import SidebarPodcastPlayer from './SidebarPodcastPlayer'

const mocks = vi.hoisted(() => ({
  rows: [] as LifePodcast[],
  update: vi.fn(), play: vi.fn(), pause: vi.fn(), seek: vi.fn(), openDetail: vi.fn(),
  progress: { currentTime: 30, duration: 120 },
}))
vi.mock('../../shared/i18n/useI18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../shared/prefs/usePreferences', () => ({ usePreferences: () => ({ neteaseExperimentalPlaybackEnabled: false }) }))
vi.mock('../../store/auth', () => ({ subscribeAuth: () => () => {} }))
vi.mock('../../data/repositories/podcastsRepo', () => ({ podcastsRepo: { list: async () => mocks.rows, update: mocks.update } }))
vi.mock('../../features/life/podcastPlayback', () => ({
  getPlaybackProgress: () => mocks.progress,
  subscribePlaybackProgress: () => () => {},
  subscribePodcastPlayback: () => () => {},
  dispatchOpenPodcastPlayer: mocks.openDetail,
  pausePodcastPlayback: mocks.pause,
  playPodcastEpisode: mocks.play,
  seekTo: mocks.seek,
  stopNeteasePlaybackIfDisabled: vi.fn(),
  isNeteaseExperimentalPlaybackEnabled: () => false,
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.rows = [{
    id: 'sidebar-podcast', createdAt: 1, updatedAt: 1,
    source: 'itunes', sourceId: 'fixture', collectionId: 1,
    name: 'A quiet workday', author: 'Fixture',
    selectedEpisodeId: 'one',
    episodes: [{ id: 'one', title: 'First episode' }, { id: 'two', title: 'Second episode' }],
  }]
  mocks.update.mockImplementation(async (_id: string, patch: Partial<LifePodcast>) => ({ ...mocks.rows[0], ...patch }))
})
afterEach(cleanup)

describe('sidebar podcast controls', () => {
  it('opens details from keyboard-focusable controls and seeks with a native range', async () => {
    render(<SidebarPodcastPlayer collapsed={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'shell.podcast.open' }))
    expect(mocks.openDetail).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'shell.podcast.previous' })).toBeDisabled()
    const seek = screen.getByRole('slider', { name: 'shell.podcast.progress' })
    expect(seek).toHaveValue('25')
    fireEvent.change(seek, { target: { value: '40' } })
    expect(mocks.seek).toHaveBeenCalledWith(.4)
    fireEvent.click(screen.getByRole('button', { name: 'shell.podcast.next' }))
    await waitFor(() => expect(mocks.play).toHaveBeenCalled())
    expect(mocks.update).toHaveBeenCalledWith('sidebar-podcast', { selectedEpisodeId: 'two', isPlaying: true })
  })

  it('retains pause and play controls when collapsed', async () => {
    mocks.rows[0].isPlaying = true
    const view = render(<SidebarPodcastPlayer collapsed />)
    fireEvent.click(await screen.findByRole('button', { name: 'shell.podcast.pause' }))
    expect(mocks.pause).toHaveBeenCalledWith('sidebar-podcast')
    expect(screen.queryByRole('slider')).toBeNull()
    view.unmount()
    mocks.rows[0].isPlaying = false
    render(<SidebarPodcastPlayer collapsed />)
    fireEvent.click(await screen.findByRole('button', { name: 'shell.podcast.play' }))
    await waitFor(() => expect(mocks.play).toHaveBeenCalled())
  })

  it('keeps default Netease playback external and disables unsupported seeking', async () => {
    mocks.rows[0].source = 'netease'
    mocks.rows[0].externalUrl = 'https://music.163.com/'
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<SidebarPodcastPlayer collapsed={false} />)
    fireEvent.click(await screen.findByRole('button', { name: 'shell.podcast.play' }))
    expect(open).toHaveBeenCalledWith('https://music.163.com/', '_blank', 'noopener,noreferrer')
    expect(mocks.play).not.toHaveBeenCalled()
    expect(screen.getByRole('slider')).toBeDisabled()
    open.mockRestore()
  })
})
