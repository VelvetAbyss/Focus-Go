import type { LifePodcast, LifePodcastEpisode } from '../../data/models/types'
import { podcastsRepo } from '../../data/repositories/podcastsRepo'
import { buildNeteaseStreamUrl } from './podcastsApi'
import { NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY } from '../../shared/prefs/preferences'

export const PODCAST_PLAYBACK_CHANGED_EVENT = 'focusgo:podcast-playback-changed'
export const PODCAST_PROGRESS_EVENT = 'focusgo:podcast-progress'
export const PODCAST_OPEN_PLAYER_EVENT = 'focusgo:podcast-open-player'

export const dispatchOpenPodcastPlayer = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PODCAST_OPEN_PLAYER_EVENT))
}

export const subscribeOpenPodcastPlayer = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PODCAST_OPEN_PLAYER_EVENT, listener)
  return () => window.removeEventListener(PODCAST_OPEN_PLAYER_EVENT, listener)
}

type PlaybackState = {
  podcastId: string
  episodeId: string
}

let sharedAudio: HTMLAudioElement | null = null
let activePlayback: PlaybackState | null = null
let pausedPlayback: (PlaybackState & { currentTime: number }) | null = null
let lastPositionSavedAt = 0
const POSITION_SAVE_INTERVAL_MS = 5000

const saveEpisodePosition = async (podcastId: string, episodeId: string, currentTime: number) => {
  const podcasts = await podcastsRepo.list()
  const podcast = podcasts.find((p) => p.id === podcastId)
  if (!podcast) return
  const episodes = podcast.episodes.map((ep) =>
    ep.id === episodeId ? { ...ep, savedPosition: currentTime } : ep,
  )
  await podcastsRepo.update(podcastId, { episodes })
}

export const isNeteaseExperimentalPlaybackEnabled = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY) === 'true'

const dispatchPlaybackChange = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PODCAST_PLAYBACK_CHANGED_EVENT))
}

const getAudio = () => {
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.preload = 'none'
    sharedAudio.ontimeupdate = () => {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(PODCAST_PROGRESS_EVENT))
      if (activePlayback && sharedAudio) {
        const now = Date.now()
        if (now - lastPositionSavedAt >= POSITION_SAVE_INTERVAL_MS) {
          lastPositionSavedAt = now
          saveEpisodePosition(activePlayback.podcastId, activePlayback.episodeId, sharedAudio.currentTime)
        }
      }
    }
    sharedAudio.onended = async () => {
      if (!activePlayback) return
      await saveEpisodePosition(activePlayback.podcastId, activePlayback.episodeId, 0)
      await podcastsRepo.update(activePlayback.podcastId, { isPlaying: false })
      activePlayback = null
      dispatchPlaybackChange()
    }
  }
  return sharedAudio
}

const resolveEpisodeUrl = (podcast: LifePodcast, episode: LifePodcastEpisode) => {
  if (podcast.source === 'netease') {
    if (!isNeteaseExperimentalPlaybackEnabled()) return undefined
    return buildNeteaseStreamUrl(episode.id, Date.now())
  }
  return episode.audioUrl
}

export const playPodcastEpisode = async (podcast: LifePodcast, episode: LifePodcastEpisode) => {
  const sourceUrl = resolveEpisodeUrl(podcast, episode)
  if (!sourceUrl) throw new Error('This episode has no playable audio URL yet.')

  const audio = getAudio()

  // Resume from saved position if it's the same episode
  const isSameEpisode =
    pausedPlayback?.podcastId === podcast.id && pausedPlayback?.episodeId === episode.id

  if (!isSameEpisode) {
    if (activePlayback && activePlayback.podcastId !== podcast.id) {
      await podcastsRepo.update(activePlayback.podcastId, { isPlaying: false })
    }
    audio.pause()
    audio.src = sourceUrl
    audio.currentTime = episode.savedPosition && episode.savedPosition > 0 ? episode.savedPosition : 0
    pausedPlayback = null
  } else {
    audio.currentTime = pausedPlayback!.currentTime
    pausedPlayback = null
  }

  activePlayback = { podcastId: podcast.id, episodeId: episode.id }

  try {
    await audio.play()
    dispatchPlaybackChange()
  } catch (error) {
    await podcastsRepo.update(podcast.id, { isPlaying: false })
    activePlayback = null
    dispatchPlaybackChange()
    throw error
  }
}

export const pausePodcastPlayback = async (podcastId?: string) => {
  const audio = getAudio()
  if (activePlayback) {
    pausedPlayback = { ...activePlayback, currentTime: audio.currentTime }
    await saveEpisodePosition(activePlayback.podcastId, activePlayback.episodeId, audio.currentTime)
  }
  audio.pause()
  if (podcastId) {
    await podcastsRepo.update(podcastId, { isPlaying: false })
  }
  activePlayback = null
  dispatchPlaybackChange()
}

export const stopNeteasePlaybackIfDisabled = async () => {
  if (!activePlayback || isNeteaseExperimentalPlaybackEnabled()) return
  const podcast = await podcastsRepo.list().then((rows) => rows.find((item) => item.id === activePlayback?.podcastId))
  if (podcast?.source !== 'netease') return
  await pausePodcastPlayback(podcast.id)
}

export const getPlaybackProgress = (): { currentTime: number; duration: number } | null => {
  if (!sharedAudio || !activePlayback) return null
  const { currentTime, duration } = sharedAudio
  return { currentTime, duration: isFinite(duration) && duration > 0 ? duration : 0 }
}

export const seekTo = (fraction: number) => {
  if (!sharedAudio) return
  const d = sharedAudio.duration
  if (isFinite(d) && d > 0) sharedAudio.currentTime = Math.max(0, Math.min(1, fraction)) * d
}

export const subscribePlaybackProgress = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PODCAST_PROGRESS_EVENT, listener)
  return () => window.removeEventListener(PODCAST_PROGRESS_EVENT, listener)
}

export const subscribePodcastPlayback = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PODCAST_PLAYBACK_CHANGED_EVENT, listener)
  return () => window.removeEventListener(PODCAST_PLAYBACK_CHANGED_EVENT, listener)
}
