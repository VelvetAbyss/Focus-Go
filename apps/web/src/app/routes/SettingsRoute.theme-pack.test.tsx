// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SettingsRoute from './SettingsRoute'
import { THEME_BEFORE_MODE_TOGGLE_EVENT, clearThemePackPreview, getThemePalette } from '../../shared/theme/themePack'

const mockDashboardGet = vi.fn()
const mockDashboardUpsert = vi.fn()

vi.mock('../../data/repositories/dashboardRepo', () => ({
  dashboardRepo: {
    get: (...args: unknown[]) => mockDashboardGet(...args),
    upsert: (...args: unknown[]) => mockDashboardUpsert(...args),
  },
}))

vi.mock('../../data/db', () => ({
  db: {
    delete: vi.fn(),
  },
}))

vi.mock('../../shared/prefs/usePreferences', () => ({
  usePreferences: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    uiAnimationsEnabled: true,
    setUiAnimationsEnabled: vi.fn(),
    numberAnimationsEnabled: true,
    setNumberAnimationsEnabled: vi.fn(),
    defaultCurrency: 'USD',
    setDefaultCurrency: vi.fn(),
    weatherAutoLocationEnabled: true,
    setWeatherAutoLocationEnabled: vi.fn(),
    weatherManualCity: '',
    setWeatherManualCity: vi.fn(),
    weatherTemperatureUnit: 'celsius',
    setWeatherTemperatureUnit: vi.fn(),
    focusCompletionSoundEnabled: true,
    setFocusCompletionSoundEnabled: vi.fn(),
  }),
}))

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key: string, values?: Record<string, string>) => {
      if (key === 'settings.theme.forceHelp') return `Force ${values?.theme}`
      return key
    },
  }),
}))

const renderRoute = () =>
  render(
    <MemoryRouter>
      <SettingsRoute />
    </MemoryRouter>,
  )

const chooseThemePack = async (optionText: string) => {
  const user = userEvent.setup()
  await screen.findByText('settings.theme.light')
  await user.click(screen.getByRole('combobox', { name: 'settings.themePack.title' }))
  await user.click(await screen.findByRole('option', { name: optionText }))
}

describe('SettingsRoute theme pack preview', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {}
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {}
    }
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = () => {}
    }
    mockDashboardGet.mockResolvedValue({
      items: [],
      themeOverride: 'light',
    })
    mockDashboardUpsert.mockResolvedValue(null)
    clearThemePackPreview()
  })

  afterEach(() => {
    cleanup()
    clearThemePackPreview()
    vi.clearAllMocks()
  })

  it('previews selected theme pack immediately and does not persist it', async () => {
    renderRoute()
    await chooseThemePack('settings.themePack.option.b')

    const palette = getThemePalette('theme-b', 'light')
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--bg')).toBe(palette.bg)
    })
    expect(mockDashboardUpsert).not.toHaveBeenCalled()
  })

  it('cancels preview and clears inline theme variables', async () => {
    const user = userEvent.setup()
    renderRoute()
    await chooseThemePack('settings.themePack.option.c')
    await user.click(screen.getByRole('button', { name: 'settings.themePack.cancelPreview' }))

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
    })
  })

  it('clears preview on mode-toggle event and on route unmount', async () => {
    const { unmount } = renderRoute()
    await chooseThemePack('settings.themePack.option.b')
    const palette = getThemePalette('theme-b', 'light')
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--bg')).toBe(palette.bg)
    })

    window.dispatchEvent(new CustomEvent(THEME_BEFORE_MODE_TOGGLE_EVENT))
    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
    })

    await chooseThemePack('settings.themePack.option.b')
    unmount()

    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
  })
})
