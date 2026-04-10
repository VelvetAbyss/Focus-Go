import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { podcastsRepo } from '../../data/repositories/podcastsRepo'
import type { LifePodcast } from '../../data/models/types'
import {
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

type Props = { collapsed: boolean }

const SidebarPodcastPlayer = ({ collapsed }: Props) => {
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
    return subscribePodcastPlayback(() => void sync())
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

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo((e.clientX - rect.left) / rect.width)
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

  return (
    <motion.div
      layout
      className={`sidebar-podcast-player${isPlaying ? ' is-playing' : ''}${collapsed ? ' is-collapsed' : ''}`}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <motion.div layout="position" className="sidebar-podcast-player__cover">
        {podcast.artworkUrl
          ? <img src={podcast.artworkUrl} alt={podcast.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', display: 'block' }} />
          : <span className="sidebar-podcast-player__emoji">{podcast.coverEmoji ?? '🎙'}</span>}
      </motion.div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            key="info"
            className="sidebar-podcast-player__info"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          >
            <p className="sidebar-podcast-player__title">{activeEpisode?.title ?? podcast.name}</p>
            <p className="sidebar-podcast-player__podcast-name">{podcast.name}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div layout="position" className="sidebar-podcast-player__controls">
        <button
          type="button"
          className="sidebar-podcast-player__btn sidebar-podcast-player__btn--skip"
          onClick={() => void handleSkip('prev')}
          disabled={!hasPrev}
          aria-label="Previous episode"
        >
          <SkipBack size={10} />
        </button>
        <button
          type="button"
          className={`sidebar-podcast-player__btn sidebar-podcast-player__btn--play${isPlaying ? ' is-playing' : ''}`}
          onClick={() => void handleToggle()}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isPlaying ? 'pause' : 'play'}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </motion.span>
          </AnimatePresence>
        </button>
        <button
          type="button"
          className="sidebar-podcast-player__btn sidebar-podcast-player__btn--skip"
          onClick={() => void handleSkip('next')}
          disabled={!hasNext}
          aria-label="Next episode"
        >
          <SkipForward size={10} />
        </button>
      </motion.div>

      {/* Progress bar — spans full bottom edge */}
      <div
        className="sidebar-podcast-player__progress"
        onClick={handleProgressClick}
        role="progressbar"
        aria-label="Playback progress"
      >
        <div
          className="sidebar-podcast-player__progress-fill"
          style={{ width: progress && progress.duration > 0 ? `${(progress.currentTime / progress.duration) * 100}%` : '0%' }}
        />
      </div>
    </motion.div>
  )
}

export default SidebarPodcastPlayer
