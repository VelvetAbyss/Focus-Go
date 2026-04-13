import { useCallback, useEffect, useRef } from 'react'
import type { NoiseTrackId, NoiseSettings } from '../../data/models/types'
import { NOISE_SOURCES, NOISE_TRACKS } from './noise'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const useNoiseMixer = (noise: NoiseSettings, onPlaybackBlocked?: () => void) => {
  const audiosRef = useRef<Partial<Record<NoiseTrackId, HTMLAudioElement>> | null>(null)
  const blockedReportedRef = useRef(false)
  const fadeRafRef = useRef<Record<NoiseTrackId, number | null>>({
    cafe: null,
    fireplace: null,
    rain: null,
    wind: null,
    thunder: null,
    ocean: null,
  })

  const cancelFade = useCallback((trackId: NoiseTrackId) => {
    const raf = fadeRafRef.current[trackId]
    if (raf !== null) {
      cancelAnimationFrame(raf)
      fadeRafRef.current[trackId] = null
    }
  }, [])

  const fadeTo = useCallback(
    (trackId: NoiseTrackId, audio: HTMLAudioElement, target: number, onDone?: () => void) => {
      cancelFade(trackId)
      const start = audio.volume
      const duration = 280
      if (Math.abs(start - target) < 0.01) {
        audio.volume = target
        onDone?.()
        return
      }
      const startTime = performance.now()
      const step = (now: number) => {
        const t = Math.min((now - startTime) / duration, 1)
        audio.volume = clamp01(start + (target - start) * t)
        if (t < 1) {
          fadeRafRef.current[trackId] = requestAnimationFrame(step)
        } else {
          fadeRafRef.current[trackId] = null
          onDone?.()
        }
      }
      fadeRafRef.current[trackId] = requestAnimationFrame(step)
    },
    [cancelFade]
  )

  const ensureAudio = useCallback((trackId: NoiseTrackId) => {
    const audios = audiosRef.current
    if (!audios) return null
    const existing = audios[trackId]
    if (existing) return existing

    const audio = new Audio(NOISE_SOURCES[trackId])
    audio.loop = true
    audio.preload = 'none'
    audio.volume = 0
    audios[trackId] = audio
    return audio
  }, [])

  useEffect(() => {
    audiosRef.current = {}

    return () => {
      for (const track of NOISE_TRACKS) {
        const audio = audiosRef.current?.[track.id]
        if (!audio) continue
        cancelFade(track.id)
        audio.pause()
      }
      audiosRef.current = null
    }
  }, [cancelFade])

  useEffect(() => {
    const audios = audiosRef.current
    if (!audios) return
    if (!noise.playing) {
      blockedReportedRef.current = false
    }

    for (const track of NOISE_TRACKS) {
      const settings = noise.tracks[track.id]
      const targetVolume = clamp01((noise.masterVolume ?? 1) * settings.volume)
      const shouldPlay = noise.playing && settings.enabled
      const audio = shouldPlay ? ensureAudio(track.id) : audios[track.id]
      if (!audio) continue
      audio.loop = noise.loop ?? true
      if (shouldPlay) {
        if (audio.paused) {
          audio.volume = 0
          const result = audio.play()
          if (result) {
            result
              .then(() => fadeTo(track.id, audio, targetVolume))
              .catch(() => {
                // Autoplay restrictions or decode errors: stay silent until next user gesture.
                if (!blockedReportedRef.current) {
                  blockedReportedRef.current = true
                  onPlaybackBlocked?.()
                }
              })
          } else {
            fadeTo(track.id, audio, targetVolume)
          }
        } else {
          fadeTo(track.id, audio, targetVolume)
        }
      } else {
        if (!audio.paused) {
          fadeTo(track.id, audio, 0, () => audio.pause())
        } else {
          audio.volume = 0
        }
      }
    }
  }, [ensureAudio, fadeTo, noise, onPlaybackBlocked])
}
