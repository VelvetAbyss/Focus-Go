// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme, readStoredThemePreference, resolveTheme } from './theme'

describe('applyTheme', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    delete document.documentElement.dataset.theme
  })

  it('sets dark data-theme and dark class', () => {
    applyTheme('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('sets light data-theme and removes dark class', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light')

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('keeps class and dataset in sync across multiple toggles', () => {
    applyTheme('dark')
    applyTheme('light')
    applyTheme('dark')

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('theme preference helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('reads system theme preference from storage', () => {
    window.localStorage.setItem('focusgo.theme', 'system')
    expect(readStoredThemePreference()).toBe('system')
  })

  it('resolves explicit theme selection without media query', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })
})
