import type { LifePodcast, LifePodcastEpisode } from '../../data/models/types'
import { podcastsRepo } from '../../data/repositories/podcastsRepo'
import { buildNeteaseStreamUrl } from './podcastsApi'

export const PODCAST_PLAYBACK_CHANGED_EVENT = 'focusgo:podcast-playback-changed'

type PlaybackState = {
  podcastId: string
  episodeId: string
}

let sharedAudio: HTMLAudioElement | null = null
let activePlayback: PlaybackState | null = null

const dispatchPlaybackChange = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PODCAST_PLAYBACK_CHANGED_EVENT))
}

const getAudio = () => {
  if (!sharedAudio) {
    sharedAudio = new Audio()
    sharedAudio.preload = 'none'
    sharedAudio.onended = async () => {
      if (!activePlayback) return
      await podcastsRepo.update(activePlayback.podcastId, { isPlaying: false })
      activePlayback = null
      dispatchPlaybackChange()
    }
  }
  return sharedAudio
}

const resolveEpisodeUrl = (podcast: LifePodcast, episode: LifePodcastEpisode) => {
  if (podcast.source === 'netease') return buildNeteaseStreamUrl(episode.id, Date.now())
  return episode.audioUrl
}

export const playPodcastEpisode = async (podcast: LifePodcast, episode: LifePodcastEpisode) => {
  const sourceUrl = resolveEpisodeUrl(podcast, episode)
  if (!sourceUrl) throw new Error('This episode has no playable audio URL yet.')

  const audio = getAudio()
  if (activePlayback && activePlayback.podcastId !== podcast.id) {
    await podcastsRepo.update(activePlayback.podcastId, { isPlaying: false })
  }

  audio.pause()
  audio.src = sourceUrl
  audio.currentTime = 0
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
  audio.pause()
  if (podcastId) {
    await podcastsRepo.update(podcastId, { isPlaying: false })
  }
  activePlayback = null
  dispatchPlaybackChange()
}

export const subscribePodcastPlayback = (listener: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PODCAST_PLAYBACK_CHANGED_EVENT, listener)
  return () => window.removeEventListener(PODCAST_PLAYBACK_CHANGED_EVENT, listener)
}
