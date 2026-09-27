// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { AMBIENT_PREFERENCES_DEFAULTS } from '../../../../features/focus/ambientPreferences'
import { createDefaultNoiseSettings } from '../../../../features/focus/noise'
import { createRainyCafeScene } from './rainy-cafe'
import { createStormyNightScene } from './stormy-night'
import type { SceneRuntime, SceneSignals } from './types'

// A 2D context whose every method is a no-op, so scenes can run their tick in jsdom.
const stubCanvas = () => {
  const ctx = new Proxy({}, { get: () => vi.fn(() => ({ addColorStop: vi.fn() })) })
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', { value: 1920 })
  Object.defineProperty(canvas, 'clientHeight', { value: 1080 })
  canvas.getContext = (() => ctx) as unknown as HTMLCanvasElement['getContext']
  return canvas
}

const runtime: SceneRuntime = {
  theme: 'dark',
  prefs: AMBIENT_PREFERENCES_DEFAULTS,
  seed: 0.42,
  emit: () => {},
}

const signals = (intensity: number): SceneSignals => {
  const tracks = createDefaultNoiseSettings().tracks
  return {
    noise: {
      cafe: tracks.cafe,
      fireplace: tracks.fireplace,
      rain: { ...tracks.rain, enabled: true, volume: 0.8 },
      wind: tracks.wind,
      thunder: tracks.thunder,
      ocean: tracks.ocean,
    },
    masterVolume: 1,
    cursor: { x: -9999, y: -9999, inside: false },
    intensity,
    now: new Date(),
  }
}

describe.each([
  ['rainy-cafe', createRainyCafeScene],
  ['stormy-night', createStormyNightScene],
])('%s scene', (_name, create) => {
  it('survives a first frame whose intensity ramp comes out negative', () => {
    const scene = create()
    scene.init(stubCanvas(), runtime)
    // A rAF timestamp can precede the layer's enteredAt by up to a frame (~16ms).
    expect(() => scene.tick(16, runtime, signals(-0.02))).not.toThrow()
    expect(() => scene.tick(16, runtime, signals(Number.NaN))).not.toThrow()
    expect(() => scene.tick(16, runtime, signals(1))).not.toThrow()
    expect(scene.particleCount()).toBeGreaterThan(0)
  })
})
