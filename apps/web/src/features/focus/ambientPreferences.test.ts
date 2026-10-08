// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('ambient background preference migration', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it('moves the old default idle scene to the white background', async () => {
    localStorage.setItem('focusgo.ambient.prefs.v2', JSON.stringify({
      frameRate: 24,
      effects: { idle: { windowLight: true, timeOfDayPalette: true, slowBreath: true } },
    }))

    const { getAmbientPreferences } = await import('./ambientPreferences')
    expect(getAmbientPreferences().frameRate).toBe(24)
    expect(getAmbientPreferences().effects.idle).toEqual({
      windowLight: false,
      timeOfDayPalette: false,
      slowBreath: false,
    })
    expect(JSON.parse(localStorage.getItem('focusgo.ambient.prefs.v3') ?? '{}').effects.idle.windowLight).toBe(false)
  })

  it('keeps a customised idle scene and later changes', async () => {
    localStorage.setItem('focusgo.ambient.prefs.v2', JSON.stringify({
      effects: { idle: { windowLight: true, timeOfDayPalette: false, slowBreath: false } },
    }))

    const { getAmbientPreferences, setSceneEffect } = await import('./ambientPreferences')
    expect(getAmbientPreferences().effects.idle.windowLight).toBe(true)
    setSceneEffect('idle', { slowBreath: true })
    vi.resetModules()

    const reloaded = await import('./ambientPreferences')
    expect(reloaded.getAmbientPreferences().effects.idle).toEqual({
      windowLight: true,
      timeOfDayPalette: false,
      slowBreath: true,
    })
  })

  it('bounds old glass preferences to the same readable range as the controls', async () => {
    localStorage.setItem('focusgo.ambient.prefs.v3', JSON.stringify({ surfaceOpacity: 0.2, glassBlur: 40 }))
    const { getAmbientPreferences, resetAmbientPreferences } = await import('./ambientPreferences')
    expect(getAmbientPreferences().surfaceOpacity).toBe(0.88)
    expect(getAmbientPreferences().glassBlur).toBe(8)
    expect(getAmbientPreferences().motionEnabled).toBe(false)
    resetAmbientPreferences()
    expect(getAmbientPreferences().frameRate).toBe(24)
    expect(document.documentElement.style.getPropertyValue('--ambient-backdrop-filter')).toBe('none')
  })

  it('persists an explicit motion choice and resets to a still environment', async () => {
    const { setAmbientPreferences } = await import('./ambientPreferences')
    setAmbientPreferences({ motionEnabled: true })
    vi.resetModules()
    const reloaded = await import('./ambientPreferences')
    expect(reloaded.getAmbientPreferences().motionEnabled).toBe(true)
    reloaded.resetAmbientPreferences()
    expect(reloaded.getAmbientPreferences().motionEnabled).toBe(false)
  })
})
