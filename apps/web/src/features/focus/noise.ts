import type { NoisePreset, NoiseSettings, NoiseTrackId } from '../../data/models/types'

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
    tracks,
  }
}
