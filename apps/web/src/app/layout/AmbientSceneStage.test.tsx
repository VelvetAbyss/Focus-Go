// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AMBIENT_PREFERENCES_DEFAULTS } from '../../features/focus/ambientPreferences'
import AmbientSceneStage from './AmbientSceneStage'

const state = vi.hoisted(() => ({
  prefs: {} as typeof AMBIENT_PREFERENCES_DEFAULTS,
  reduced: false, mediaListeners: new Set<() => void>(), visible: true,
}))
vi.mock('../../features/focus/ambientPreferences', async (original) => ({
  ...await original<typeof import('../../features/focus/ambientPreferences')>(),
  useAmbientPreferences: () => state.prefs,
}))
vi.mock('../../features/focus/SharedNoiseProvider', () => ({
  useSharedNoise: () => ({ noise: { masterVolume: 0.5, tracks: Object.fromEntries(['cafe', 'fireplace', 'rain', 'wind', 'thunder', 'ocean'].map(id => [id, { enabled: true, volume: 0.5 }])) } }),
}))
let connection: EventTarget & { saveData: boolean }
beforeEach(() => {
  vi.useFakeTimers()
  state.reduced = false; state.visible = true
  state.prefs = structuredClone(AMBIENT_PREFERENCES_DEFAULTS)
  state.prefs.motionEnabled = true
  state.mediaListeners.clear()
  delete document.documentElement.dataset.motion
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !state.visible })
  connection = Object.assign(new EventTarget(), { saveData: false })
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return state.reduced },
    addEventListener: (_: string, fn: () => void) => state.mediaListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => state.mediaListeners.delete(fn),
  }))
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const stage = (container: HTMLElement) => container.firstElementChild as HTMLElement

describe('ambient environment lifecycle', () => {
  it('defaults to a still environment and only animates when explicitly enabled', () => {
    state.prefs = structuredClone(AMBIENT_PREFERENCES_DEFAULTS)
    const { container, rerender } = render(<AmbientSceneStage scene="rainy-cafe" />)
    expect(stage(container).dataset.motion).toBe('still')
    state.prefs.motionEnabled = true
    rerender(<AmbientSceneStage scene="rainy-cafe" />)
    expect(stage(container).dataset.motion).toBe('running')
    state.prefs.motionEnabled = false
    rerender(<AmbientSceneStage scene="rainy-cafe" />)
    expect(stage(container).dataset.motion).toBe('still')
  })
  it('creates no canvas, rendering loop or timer across rapid scene switches', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame')
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
    const { container, rerender, unmount } = render(<AmbientSceneStage scene="rainy-cafe" />)
    for (const scene of ['stormy-night', 'cozy-fireside', 'ocean-breeze'] as const) rerender(<AmbientSceneStage scene={scene} />)
    act(() => vi.advanceTimersByTime(60_000))
    expect(canvas).not.toHaveBeenCalled()
    expect(raf).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(container.querySelector('canvas')).toBeNull()
    expect(stage(container).getAttribute('aria-hidden')).toBe('true')
    expect(state.mediaListeners.size).toBe(1)
    unmount()
    expect(state.mediaListeners.size).toBe(0)
  })
  it('pauses while hidden and never resumes against a reduced-motion preference', () => {
    state.visible = false
    const { container } = render(<AmbientSceneStage scene="stormy-night" />)
    expect(stage(container).dataset.paused).toBe('true')
    act(() => { state.reduced = true; state.visible = true; document.dispatchEvent(new Event('visibilitychange')) })
    expect(stage(container).dataset.paused).toBe('false')
    expect(stage(container).dataset.motion).toBe('still')
    act(() => { state.reduced = false; state.mediaListeners.forEach(fn => fn()) })
    expect(stage(container).dataset.motion).toBe('running')
  })
  it('reacts to OS, app and save-data changes and restores motion only when all allow it', async () => {
    const { container } = render(<AmbientSceneStage scene="ocean-breeze" />)
    act(() => { state.reduced = true; state.mediaListeners.forEach(fn => fn()) })
    expect(stage(container).dataset.motion).toBe('still')
    await act(async () => { document.documentElement.dataset.motion = 'reduce'; state.reduced = false; state.mediaListeners.forEach(fn => fn()) })
    expect(stage(container).dataset.motion).toBe('still')
    act(() => { connection.saveData = true; connection.dispatchEvent(new Event('change')) })
    await act(async () => { delete document.documentElement.dataset.motion })
    expect(stage(container).dataset.motion).toBe('still')
    act(() => { connection.saveData = false; connection.dispatchEvent(new Event('change')) })
    expect(stage(container).dataset.motion).toBe('running')
  })
  it('updates steam, logs, caustics and wave-layer preferences without document-global side effects', () => {
    const before = document.documentElement.style.cssText
    const { container, rerender, unmount } = render(<AmbientSceneStage scene="ocean-breeze" />)
    expect(container.querySelector('.ambient-waves--layered')).not.toBeNull()
    state.prefs.effects.oceanBreeze.parallaxLayers = false
    state.prefs.effects.oceanBreeze.surfaceCaustics = true
    state.prefs.effects.rainyCafe.steamFog = true
    state.prefs.effects.cozyFireside.logSilhouette = false
    rerender(<AmbientSceneStage scene="ocean-breeze" />)
    expect(container.querySelector('.ambient-waves--layered')).toBeNull()
    expect(stage(container).style.getPropertyValue('--rainy-cafe-steam-on')).toBe('1')
    expect(stage(container).style.getPropertyValue('--cozy-fireside-log-on')).toBe('0')
    expect(stage(container).style.getPropertyValue('--ocean-breeze-caustics-on')).toBe('1')
    unmount()
    expect(document.documentElement.style.cssText).toBe(before)
  })
  it('only schedules a coarse clock for opt-in daylight, cancels it while hidden and on unmount', () => {
    state.prefs.effects.idle.timeOfDayPalette = true
    state.prefs.effects.idle.slowBreath = true
    const { container, unmount } = render(<AmbientSceneStage scene="window-light" />)
    expect(stage(container).dataset.daylight).toMatch(/day|evening/)
    expect(container.querySelector('.ambient-daylight-breath')).not.toBeNull()
    expect(vi.getTimerCount()).toBe(1)
    act(() => { state.visible = false; document.dispatchEvent(new Event('visibilitychange')) })
    expect(vi.getTimerCount()).toBe(0)
    act(() => { state.visible = true; document.dispatchEvent(new Event('visibilitychange')) })
    expect(vi.getTimerCount()).toBe(1)
    unmount(); expect(vi.getTimerCount()).toBe(0)
  })
})
