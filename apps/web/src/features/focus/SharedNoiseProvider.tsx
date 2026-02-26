/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { NoiseSettings, NoiseTrackId, NoiseTrackSettings } from '../../data/models/types'
import { focusRepo } from '../../data/repositories/focusRepo'
import { createDefaultNoiseSettings, DEFAULT_NOISE_PRESET } from './noise'
import { useNoiseMixer } from './useNoiseMixer'

const NOISE_SESSION_KEY = 'focusgo.noise.sessionId'

const createSessionId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const getSessionState = () => {
  const existing = window.sessionStorage.getItem(NOISE_SESSION_KEY)
  if (existing) return { sessionId: existing, resumedFromSameSession: true }
  const next = createSessionId()
  window.sessionStorage.setItem(NOISE_SESSION_KEY, next)
  return { sessionId: next, resumedFromSameSession: false }
}

type SharedNoiseContextValue = {
  noise: NoiseSettings
  setNoise: (next: NoiseSettings) => void
  toggleNoisePlaying: () => void
  setNoiseTrackEnabled: (trackId: NoiseTrackId, enabled: boolean) => void
  setNoiseTrackVolume: (trackId: NoiseTrackId, volume: number) => void
  setNoiseMasterVolume: (volume: number) => void
}

const SharedNoiseContext = createContext<SharedNoiseContextValue | null>(null)

export const SharedNoiseProvider = ({ children }: { children: ReactNode }) => {
  const [noise, setNoise] = useState<NoiseSettings>(createDefaultNoiseSettings())
  const [ready, setReady] = useState(false)
  const readyRef = useRef(false)

  useEffect(() => {
    readyRef.current = ready
  }, [ready])

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      const { resumedFromSameSession } = getSessionState()
      const settings = await focusRepo.get()
      if (cancelled) return

      const preset = settings?.noisePreset ?? DEFAULT_NOISE_PRESET
      const storedNoise = settings?.noise ?? createDefaultNoiseSettings()
      const mergedNoise: NoiseSettings = {
        playing: resumedFromSameSession ? storedNoise.playing : false,
        loop: storedNoise.loop ?? preset.loop,
        masterVolume: storedNoise.masterVolume ?? 0.6,
        tracks: { ...preset.tracks, ...storedNoise.tracks },
      }

      setNoise(mergedNoise)

      const needsNoisePreset = !settings?.noisePreset
      const shouldPersistPlayingReset = !resumedFromSameSession && storedNoise.playing !== mergedNoise.playing
      if (needsNoisePreset || shouldPersistPlayingReset || !settings) {
        await focusRepo.upsert({
          focusMinutes: settings?.focusMinutes ?? 25,
          breakMinutes: settings?.breakMinutes ?? 5,
          longBreakMinutes: settings?.longBreakMinutes ?? 15,
          noise: mergedNoise,
          noisePreset: settings?.noisePreset ?? DEFAULT_NOISE_PRESET,
          volume: settings?.volume,
          timer: settings?.timer,
        })
      }

      if (!cancelled) setReady(true)
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void focusRepo.updateNoise(noise)
  }, [noise, ready])

  const setNoiseTrack = useCallback((trackId: NoiseTrackId, patch: Partial<NoiseTrackSettings>) => {
    setNoise((prev) => ({
      ...prev,
      tracks: {
        ...prev.tracks,
        [trackId]: {
          ...prev.tracks[trackId],
          ...patch,
        },
      },
    }))
  }, [])

  const toggleNoisePlaying = useCallback(() => {
    setNoise((prev) => ({ ...prev, playing: !prev.playing }))
  }, [])

  const setNoiseTrackEnabled = useCallback((trackId: NoiseTrackId, enabled: boolean) => {
    setNoiseTrack(trackId, { enabled })
  }, [setNoiseTrack])

  const setNoiseTrackVolume = useCallback((trackId: NoiseTrackId, volume: number) => {
    setNoiseTrack(trackId, { volume })
  }, [setNoiseTrack])

  const setNoiseMasterVolume = useCallback((volume: number) => {
    setNoise((prev) => ({ ...prev, masterVolume: volume }))
  }, [])

  const handlePlaybackBlocked = useCallback(() => {
    if (!readyRef.current) return
    setNoise((prev) => (prev.playing ? { ...prev, playing: false } : prev))
  }, [])

  useNoiseMixer(noise, handlePlaybackBlocked)

  const value = useMemo<SharedNoiseContextValue>(() => ({
    noise,
    setNoise,
    toggleNoisePlaying,
    setNoiseTrackEnabled,
    setNoiseTrackVolume,
    setNoiseMasterVolume,
  }), [noise, toggleNoisePlaying, setNoiseTrackEnabled, setNoiseTrackVolume, setNoiseMasterVolume])

  return <SharedNoiseContext.Provider value={value}>{children}</SharedNoiseContext.Provider>
}

export const useSharedNoise = () => {
  const ctx = useContext(SharedNoiseContext)
  if (!ctx) throw new Error('useSharedNoise must be used within SharedNoiseProvider')
  return ctx
}
