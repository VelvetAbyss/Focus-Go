import type { NoisePreset, NoiseSettings, NoiseTrackId } from '../../data/models/types'
import type { TranslationKey } from '../../shared/i18n/types'

export const NOISE_TRACKS: { id: NoiseTrackId; label: string }[] = [
  { id: 'cafe', label: 'Cafe ambience' },
  { id: 'fireplace', label: 'Fireplace' },
  { id: 'rain', label: 'Rain' },
  { id: 'wind', label: 'Wind' },
  { id: 'thunder', label: 'Thunder' },
  { id: 'ocean', label: 'Ocean' },
]

export const NOISE_SOURCES: Record<NoiseTrackId, string> = {
  cafe: '/Noise/Cafe ambience.mp3',
  fireplace: '/Noise/Fireplace.mp3',
  rain: '/Noise/Rain.mp3',
  wind: '/Noise/Wind.mp3',
  thunder: '/Noise/Thunder.mp3',
  ocean: '/Noise/Ocean.mp3',
}

export type NoiseScenePresetId = 'rainy-cafe' | 'stormy-night' | 'ocean-breeze' | 'cozy-fireside'

export type NoiseScenePreset = {
  id: NoiseScenePresetId
  emoji: string
  labelKey: TranslationKey
  tracks: NoiseSettings['tracks']
}

export const NOISE_SCENE_PRESETS: NoiseScenePreset[] = [
  {
    id: 'rainy-cafe',
    emoji: '☕',
    labelKey: 'focus.scene.rainyCafe',
    tracks: {
      cafe: { enabled: true, volume: 0.5 },
      fireplace: { enabled: false, volume: 0.4 },
      rain: { enabled: true, volume: 0.65 },
      wind: { enabled: false, volume: 0.3 },
      thunder: { enabled: false, volume: 0.2 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
  {
    id: 'stormy-night',
    emoji: '🌩',
    labelKey: 'focus.scene.stormyNight',
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: true, volume: 0.6 },
      rain: { enabled: true, volume: 0.8 },
      wind: { enabled: true, volume: 0.4 },
      thunder: { enabled: true, volume: 0.35 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
  {
    id: 'ocean-breeze',
    emoji: '🌊',
    labelKey: 'focus.scene.oceanBreeze',
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: false, volume: 0.4 },
      rain: { enabled: false, volume: 0.5 },
      wind: { enabled: true, volume: 0.35 },
      thunder: { enabled: false, volume: 0.2 },
      ocean: { enabled: true, volume: 0.75 },
    },
  },
  {
    id: 'cozy-fireside',
    emoji: '🔥',
    labelKey: 'focus.scene.cozyFireside',
    tracks: {
      cafe: { enabled: false, volume: 0.5 },
      fireplace: { enabled: true, volume: 0.7 },
      rain: { enabled: true, volume: 0.3 },
      wind: { enabled: false, volume: 0.2 },
      thunder: { enabled: false, volume: 0.15 },
      ocean: { enabled: false, volume: 0.5 },
    },
  },
]

export const cloneNoiseTracks = (tracks: NoiseSettings['tracks']): NoiseSettings['tracks'] => ({
  cafe: { ...tracks.cafe },
  fireplace: { ...tracks.fireplace },
  rain: { ...tracks.rain },
  wind: { ...tracks.wind },
  thunder: { ...tracks.thunder },
  ocean: { ...tracks.ocean },
})

export const findMatchingNoiseScenePreset = (tracks: NoiseSettings['tracks']) =>
  NOISE_SCENE_PRESETS.find((preset) =>
    NOISE_TRACKS.every((track) => {
      const current = tracks[track.id]
      const target = preset.tracks[track.id]
      return current.enabled === target.enabled && Math.abs(current.volume - target.volume) < 0.001
    })
  )

export const DEFAULT_NOISE_PRESET: NoisePreset = {
  presetId: 'default',
  presetName: 'Default',
  scope: 'focus-center',
  isPlaying: false,
  loop: true,
  tracks: {
    cafe: { enabled: false, volume: 0.6 },
    fireplace: { enabled: true, volume: 0.6 },
    rain: { enabled: true, volume: 0.6 },
    wind: { enabled: true, volume: 0.6 },
    thunder: { enabled: true, volume: 0.6 },
    ocean: { enabled: true, volume: 0.6 },
  },
}

export const createDefaultNoiseSettings = (): NoiseSettings => {
  const tracks = {
    cafe: { enabled: false, volume: 0.3 },
    fireplace: { enabled: false, volume: 0.3 },
    rain: { enabled: false, volume: 0.3 },
    wind: { enabled: false, volume: 0.3 },
    thunder: { enabled: false, volume: 0.3 },
    ocean: { enabled: false, volume: 0.3 },
  } satisfies NoiseSettings['tracks']

  return {
    playing: false,
    loop: true,
    masterVolume: 0.6,
    sleepEndsAt: null,
    sleepDurationMinutes: null,
    tracks,
  }
}
