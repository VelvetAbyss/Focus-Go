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
import SeekBar from '../../shared/ui/SeekBar'
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

  const title = activeEpisode?.title ?? podcast.name
  const playLabel = isPlaying ? t('shell.podcast.pause') : t('shell.podcast.play')

  // Expanded, it reads like a nav row: cover in the icon column, the episode
  // on the label line, play at the end; the timeline sits under the label,
  // bracketed by previous and next episode.
  return (
    <div className={`sidebar-podcast-player${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="sidebar-tool__row">
        <button type="button" className="sidebar-podcast-player__cover"
          onClick={handleOpenDetail} title={t('shell.podcast.open')} aria-label={t('shell.podcast.open')}>
          {podcast.artworkUrl
            ? <img src={podcast.artworkUrl} alt="" />
            : <span className="sidebar-podcast-player__emoji" aria-hidden="true">{podcast.coverEmoji ?? '🎙'}</span>}
        </button>
        {!collapsed && <button type="button" className="sidebar-tool__label sidebar-podcast-player__info sidebar-reveal"
          onClick={handleOpenDetail} title={`${title} · ${podcast.name}`}>
          {title}
        </button>}
        <button type="button" className="sidebar-tool__play" aria-pressed={isPlaying}
          onClick={() => void handleToggle()} aria-label={playLabel} title={playLabel}>
          <SidebarControlIcon active={isPlaying} size={15} />
        </button>
      </div>
      {!collapsed && <div className="sidebar-tool__sub sidebar-reveal">
        <button type="button" className="sidebar-tool__skip"
          onClick={() => void handleSkip('prev')} disabled={!hasPrev} aria-label={t('shell.podcast.previous')} title={t('shell.podcast.previous')}>
          <SkipBack size={12} aria-hidden="true" />
        </button>
        <SeekBar currentTime={progress?.currentTime ?? 0} duration={progress?.duration ?? 0}
          seed={activeEpisode?.id ?? podcast.id} disabled={isNeteaseDefaultMode} label={t('shell.podcast.progress')} onSeek={seekTo} />
        <button type="button" className="sidebar-tool__skip"
          onClick={() => void handleSkip('next')} disabled={!hasNext} aria-label={t('shell.podcast.next')} title={t('shell.podcast.next')}>
          <SkipForward size={12} aria-hidden="true" />
        </button>
      </div>}
    </div>
  )
}

export default SidebarPodcastPlayer
