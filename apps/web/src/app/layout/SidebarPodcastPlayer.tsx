import { useCallback, useEffect, useState } from 'react'
import { SkipBack, SkipForward } from 'lucide-react'
import { podcastsRepo } from '../../data/repositories/podcastsRepo'
import type { LifePodcast } from '../../data/models/types'
import {
  dispatchOpenPodcastPlayer,
  getPlaybackProgress,
  isNeteaseExperimentalPlaybackEnabled,
  pausePodcastPlayback,
  playPodcastEpisode,
  seekTo,
  stopNeteasePlaybackIfDisabled,
  subscribePodcastPlayback,
  subscribePlaybackProgress,
} from '../../features/life/podcastPlayback'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { subscribeAuth } from '../../store/auth'
import SidebarControlIcon from './SidebarControlIcon'
import { useI18n } from '../../shared/i18n/useI18n'

type Props = { collapsed: boolean }

const SidebarPodcastPlayer = ({ collapsed }: Props) => {
  const { t } = useI18n()
  const { neteaseExperimentalPlaybackEnabled } = usePreferences()
  const [podcast, setPodcast] = useState<LifePodcast | null>(null)
  const [progress, setProgress] = useState<{ currentTime: number; duration: number } | null>(null)

  useEffect(() => {
    const update = () => setProgress(getPlaybackProgress())
    update()
    return subscribePlaybackProgress(update)
  }, [])

  const sync = useCallback(async () => {
    const rows = await podcastsRepo.list()
    const playing = rows.find((p) => p.isPlaying)
    const withSelected = rows.find((p) => p.selectedEpisodeId)
    setPodcast(playing ?? withSelected ?? rows[0] ?? null)
  }, [])

  useEffect(() => {
    void sync()
    const unsubscribePlayback = subscribePodcastPlayback(() => void sync())
    const unsubscribeAuth = subscribeAuth(() => void sync())
    return () => {
      unsubscribePlayback()
      unsubscribeAuth()
    }
  }, [sync])

  useEffect(() => {
    if (!neteaseExperimentalPlaybackEnabled) void stopNeteasePlaybackIfDisabled()
  }, [neteaseExperimentalPlaybackEnabled])

  if (!podcast) return null

  const episodes = podcast.episodes
  const activeEpisode = episodes.find((e) => e.id === podcast.selectedEpisodeId) ?? episodes[0] ?? null
  const activeIndex = episodes.findIndex((e) => e.id === activeEpisode?.id)
  const hasPrev = activeIndex > 0
  const hasNext = activeIndex >= 0 && activeIndex < episodes.length - 1
  const isPlaying = !!podcast.isPlaying
  const isNeteaseDefaultMode = podcast.source === 'netease' && !isNeteaseExperimentalPlaybackEnabled()
  const openExternal = (url?: string) => {
    if (!url || typeof window === 'undefined') return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleToggle = async () => {
    if (isPlaying) {
      await pausePodcastPlayback(podcast.id)
    } else if (activeEpisode) {
      if (isNeteaseDefaultMode) {
        openExternal(activeEpisode.externalUrl ?? podcast.externalUrl)
        return
      }
      const updated = await podcastsRepo.update(podcast.id, { isPlaying: true })
      if (updated) setPodcast(updated)
      try {
        await playPodcastEpisode(podcast, activeEpisode)
      } catch {
        await podcastsRepo.update(podcast.id, { isPlaying: false })
        void sync()
      }
    }
  }

  const handleOpenDetail = () => {
    dispatchOpenPodcastPlayer()
  }

  const handleSkip = async (dir: 'prev' | 'next') => {
    if (!activeEpisode) return
    const targetIndex = dir === 'prev' ? activeIndex - 1 : activeIndex + 1
    const target = episodes[targetIndex]
    if (!target) return
    if (isNeteaseDefaultMode) {
      const updated = await podcastsRepo.update(podcast.id, { selectedEpisodeId: target.id, isPlaying: false })
      if (updated) setPodcast(updated)
      openExternal(target.externalUrl ?? podcast.externalUrl)
      return
    }
    const updated = await podcastsRepo.update(podcast.id, { selectedEpisodeId: target.id, isPlaying: true })
    if (!updated) return
    setPodcast(updated)
    try {
      await playPodcastEpisode(updated, target)
    } catch {
      await podcastsRepo.update(podcast.id, { isPlaying: false })
      void sync()
    }
  }

  const playbackPercent = progress && progress.duration > 0 ? Math.max(0, Math.min(100, progress.currentTime / progress.duration * 100)) : 0

  return (
    <div className={`sidebar-podcast-player${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar-tool__row">
        <button type="button" className="sidebar-podcast-player__cover"
          onClick={handleOpenDetail} title={t('shell.podcast.open')} aria-label={t('shell.podcast.open')}>
          {podcast.artworkUrl
            ? <img src={podcast.artworkUrl} alt="" />
            : <span className="sidebar-podcast-player__emoji" aria-hidden="true">{podcast.coverEmoji ?? '🎙'}</span>}
        </button>
        {!collapsed && <button type="button" className="sidebar-podcast-player__info sidebar-reveal"
          onClick={handleOpenDetail} title={activeEpisode?.title ?? podcast.name}>
          <span className="sidebar-podcast-player__title">{activeEpisode?.title ?? podcast.name}</span>
          <span className="sidebar-podcast-player__podcast-name">{podcast.name}</span>
        </button>}
        {collapsed && <button type="button" className="sidebar-podcast-player__btn sidebar-podcast-player__btn--play"
          onClick={() => void handleToggle()} aria-label={isPlaying ? t('shell.podcast.pause') : t('shell.podcast.play')}>
          <SidebarControlIcon active={isPlaying} />
        </button>}
      </div>
      {!collapsed && <>
        <div className="sidebar-podcast-player__controls sidebar-reveal">
          <button type="button" className="sidebar-podcast-player__btn sidebar-podcast-player__btn--skip"
            onClick={() => void handleSkip('prev')} disabled={!hasPrev} aria-label={t('shell.podcast.previous')}>
            <SkipBack size={14} aria-hidden="true" />
          </button>
          <button type="button" className={`sidebar-podcast-player__btn sidebar-podcast-player__btn--play${isPlaying ? ' is-playing' : ''}`}
            onClick={() => void handleToggle()} aria-label={isPlaying ? t('shell.podcast.pause') : t('shell.podcast.play')}>
            <SidebarControlIcon active={isPlaying} />
          </button>
          <button type="button" className="sidebar-podcast-player__btn sidebar-podcast-player__btn--skip"
            onClick={() => void handleSkip('next')} disabled={!hasNext} aria-label={t('shell.podcast.next')}>
            <SkipForward size={14} aria-hidden="true" />
          </button>
          <input type="range" className="sidebar-podcast-player__seek" min={0} max={100} step={0.1}
            value={playbackPercent} disabled={!progress || progress.duration <= 0 || isNeteaseDefaultMode}
            aria-label={t('shell.podcast.progress')} onChange={(event) => seekTo(Number(event.target.value) / 100)} />
        </div>
      </>}
    </div>
  )
}

export default SidebarPodcastPlayer
