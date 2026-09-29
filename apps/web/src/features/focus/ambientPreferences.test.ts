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
})
