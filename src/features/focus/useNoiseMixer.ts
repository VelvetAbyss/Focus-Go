import { useCallback, useEffect, useRef } from 'react'
import type { NoiseTrackId, NoiseSettings } from '../../data/models/types'
import { NOISE_SOURCES, NOISE_TRACKS } from './noise'

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export const useNoiseMixer = (noise: NoiseSettings) => {
  const audiosRef = useRef<Record<NoiseTrackId, HTMLAudioElement> | null>(null)
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

  useEffect(() => {
    const audios = {} as Record<NoiseTrackId, HTMLAudioElement>
    for (const track of NOISE_TRACKS) {
      const audio = new Audio(NOISE_SOURCES[track.id])
      audio.loop = true
      audio.preload = 'auto'
      audio.volume = 0
      audios[track.id] = audio
    }

    audiosRef.current = audios

    return () => {
      for (const track of NOISE_TRACKS) {
        const audio = audios[track.id]
        cancelFade(track.id)
        audio.pause()
      }
      audiosRef.current = null
    }
  }, [cancelFade])

  useEffect(() => {
    const audios = audiosRef.current
    if (!audios) return

    for (const track of NOISE_TRACKS) {
      const settings = noise.tracks[track.id]
      const audio = audios[track.id]
      audio.loop = noise.loop ?? true
      const targetVolume = clamp01((noise.masterVolume ?? 1) * settings.volume)
      const shouldPlay = noise.playing && settings.enabled
      if (shouldPlay) {
        if (audio.paused) {
          audio.volume = 0
          const result = audio.play()
          if (result) {
            result
              .then(() => fadeTo(track.id, audio, targetVolume))
              .catch(() => {
                // Autoplay restrictions or decode errors: stay silent until next user gesture.
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
  }, [fadeTo, noise])
}
