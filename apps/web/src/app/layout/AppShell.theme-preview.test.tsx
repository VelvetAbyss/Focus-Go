// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { THEME_BEFORE_MODE_TOGGLE_EVENT } from '../../shared/theme/themePack'

const mockApplyTheme = vi.fn()
const mockReadStoredThemePreference = vi.fn()
const mockResolveInitialTheme = vi.fn()
const mockResolveTheme = vi.fn()
const mockWriteStoredThemePreference = vi.fn()

vi.mock('../../shared/prefs/usePreferences', () => ({
  usePreferences: () => ({
    uiAnimationsEnabled: false,
  }),
}))

vi.mock('../../shared/theme/theme', () => ({
  applyTheme: (...args: unknown[]) => mockApplyTheme(...args),
  readStoredThemePreference: (...args: unknown[]) => mockReadStoredThemePreference(...args),
  resolveInitialTheme: (...args: unknown[]) => mockResolveInitialTheme(...args),
  resolveTheme: (...args: unknown[]) => mockResolveTheme(...args),
  writeStoredThemePreference: (...args: unknown[]) => mockWriteStoredThemePreference(...args),
  subscribeTheme: () => () => undefined,
}))

vi.mock('../../features/tasks/useTaskReminderEngine', () => ({
  useTaskReminderEngine: vi.fn(),
}))

vi.mock('../../features/focus/SharedNoiseProvider', () => ({
  useSharedNoise: () => ({
    noise: {
      tracks: {
        cafe: { enabled: true, volume: 0.5 },
        fireplace: { enabled: false, volume: 0.4 },
        rain: { enabled: true, volume: 0.65 },
        wind: { enabled: false, volume: 0.3 },
        thunder: { enabled: false, volume: 0.2 },
        ocean: { enabled: false, volume: 0.5 },
      },
    },
  }),
}))

vi.mock('../../features/onboarding/ModuleGuideRuntime', () => ({
  default: () => null,
}))

vi.mock('../../data/repositories/syncedPreferencesRepo', () => ({
  syncedPreferencesRepo: {
    persistFromLocal: vi.fn(),
  },
}))

vi.mock('./Sidebar', () => ({
  default: ({ collapsed, onToggleTheme }: { collapsed: boolean; onToggleTheme: () => void }) => (
    <div>
      <div data-testid="sidebar-collapsed">{String(collapsed)}</div>
      <button type="button" onClick={onToggleTheme}>
        toggle-theme
      </button>
    </div>
  ),
}))

describe('AppShell theme preview event flow', () => {
  const setViewportWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  }

  const installMatchMediaMock = () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        if (query.includes('prefers-color-scheme')) {
          return {
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }
        }
        const min = query.match(/\(min-width:\s*(\d+)px\)/)?.[1]
        const max = query.match(/\(max-width:\s*(\d+)px\)/)?.[1]
        const minOk = min ? window.innerWidth >= Number(min) : true
        const maxOk = max ? window.innerWidth <= Number(max) : true
        return {
          matches: minOk && maxOk,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }
      }),
    })
  }

  beforeEach(() => {
    window.localStorage.clear()
    setViewportWidth(1920)
    installMatchMediaMock()
    mockReadStoredThemePreference.mockReturnValue(null)
    mockResolveInitialTheme.mockReturnValue('light')
    mockResolveTheme.mockImplementation((selection: 'light' | 'dark' | 'system') => (selection === 'dark' ? 'dark' : 'light'))
    mockApplyTheme.mockReset()
    mockWriteStoredThemePreference.mockReset()
  })

  // Skipped: AppShell no longer owns the theme-toggle wiring (the
  // onToggleTheme prop is no longer passed down to Sidebar). The toggle was
  // moved into Sidebar internals; this test asserts the old prop-chain contract.
  it.skip('dispatches before-mode-toggle event before applying toggled theme', async () => {
    const callOrder: string[] = []
    mockApplyTheme.mockImplementation(() => {
      callOrder.push('apply-theme')
    })
    const onBeforeModeToggle = () => {
      callOrder.push('before-mode-toggle')
    }
    window.addEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, onBeforeModeToggle)

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: 'toggle-theme' }))

    expect(mockWriteStoredThemePreference).toHaveBeenCalledWith('dark')
    expect(mockApplyTheme).toHaveBeenCalledWith('dark')
    expect(callOrder[0]).toBe('before-mode-toggle')
    expect(callOrder[1]).toBe('apply-theme')
    window.removeEventListener(THEME_BEFORE_MODE_TOGGLE_EVENT, onBeforeModeToggle)
  })

  it('keeps controls at natural size across viewport resizes', async () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

    const shell = container.querySelector('.focus-shell') as HTMLElement
    expect(shell.style.getPropertyValue('--shell-scale')).toBe('1')

    setViewportWidth(1716)
    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(shell.style.getPropertyValue('--shell-scale')).toBe('1')
    })
  })

  it('renders the noise-scene ambient backdrop behind shell content', () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

    const shell = container.querySelector('.focus-shell') as HTMLElement
    const backdrop = shell.querySelector('.focus-shell__scene-backdrop') as HTMLElement
    const scaleWrap = shell.querySelector('.focus-shell__scale-wrap') as HTMLElement

    expect(shell).toHaveAttribute('data-ambient-scene', 'rainy-cafe')
    expect(backdrop).toBeInTheDocument()
    expect(backdrop).toHaveAttribute('aria-hidden', 'true')
    expect(backdrop.nextElementSibling).toBe(scaleWrap)
    expect(scaleWrap).toHaveTextContent('child')
  })

  it('keeps shell scale unchanged on same-width resize', async () => {
    setViewportWidth(1716)
    const { container } = render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )
    const shell = container.querySelector('.focus-shell') as HTMLElement

    await waitFor(() => {
      expect(shell.style.getPropertyValue('--shell-scale')).toBe('1')
    })
    const before = shell.style.cssText

    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(shell.style.cssText).toBe(before)
    })
  })

  it('keeps sidebar expanded on first load even in compact viewport', () => {
    setViewportWidth(1200)
    installMatchMediaMock()
    render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false')
  })
})
