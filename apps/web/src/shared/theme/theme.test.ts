// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { applyTheme } from './theme'

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
