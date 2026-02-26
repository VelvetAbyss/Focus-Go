// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { applyThemePackPreview, clearThemePackPreview, getThemePalette } from './themePack'

describe('themePack preview', () => {
  beforeEach(() => {
    clearThemePackPreview()
  })

  it('applies theme variables for selected pack and mode', () => {
    const palette = getThemePalette('theme-b', 'dark')

    applyThemePackPreview('theme-b', 'dark')

    const root = document.documentElement
    expect(root.style.getPropertyValue('--bg')).toBe(palette.bg)
    expect(root.style.getPropertyValue('--bg-elevated')).toBe(palette.bgElevated)
    expect(root.style.getPropertyValue('--bg-muted')).toBe(palette.bgMuted)
    expect(root.style.getPropertyValue('--accent')).toBe(palette.accent)
    expect(root.style.getPropertyValue('--accent-soft')).toBe(palette.accentSoft)
    expect(root.style.getPropertyValue('--primary')).toBe(palette.primaryHsl)
    expect(root.style.getPropertyValue('--ring')).toBe(palette.ringHsl)
  })

  it('clears preview variables', () => {
    applyThemePackPreview('theme-c', 'light')
    clearThemePackPreview()

    const root = document.documentElement
    expect(root.style.getPropertyValue('--bg')).toBe('')
    expect(root.style.getPropertyValue('--bg-elevated')).toBe('')
    expect(root.style.getPropertyValue('--bg-muted')).toBe('')
    expect(root.style.getPropertyValue('--accent')).toBe('')
    expect(root.style.getPropertyValue('--accent-soft')).toBe('')
    expect(root.style.getPropertyValue('--primary')).toBe('')
    expect(root.style.getPropertyValue('--ring')).toBe('')
  })

  it('switches variable set when mode changes', () => {
    const light = getThemePalette('theme-a', 'light')
    const dark = getThemePalette('theme-a', 'dark')

    applyThemePackPreview('theme-a', 'light')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(light.bg)

    applyThemePackPreview('theme-a', 'dark')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe(dark.bg)
  })
})
