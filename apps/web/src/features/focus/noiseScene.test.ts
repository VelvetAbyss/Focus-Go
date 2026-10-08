import { describe, expect, it } from 'vitest'
import { cloneNoiseTracks, createDefaultNoiseSettings, findMatchingNoiseScenePreset, NOISE_SCENE_PRESETS } from './noise'

describe('scene identity', () => {
  it.each(NOISE_SCENE_PRESETS)('keeps $id while mixing volume or muting tracks', (preset) => {
    const tracks = cloneNoiseTracks(preset.tracks)
    for (const track of Object.values(tracks)) track.volume = 0
    expect(findMatchingNoiseScenePreset(tracks)?.id).toBe(preset.id)
    tracks.rain.volume = 0.123
    expect(findMatchingNoiseScenePreset(tracks)?.id).toBe(preset.id)
  })
  it('returns to the plain desk when all tracks are disabled', () => {
    const tracks = createDefaultNoiseSettings().tracks
    for (const track of Object.values(tracks)) track.enabled = false
    expect(findMatchingNoiseScenePreset(tracks)).toBeUndefined()
  })
})
