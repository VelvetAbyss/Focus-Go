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

vi.mock('../../features/labs/LabsContext', () => ({
  useLabs: () => ({ ready: true, catalog: [] }),
}))

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

vi.mock('../../features/tasks/application/useQuickCapture', () => ({
  useQuickCapture: vi.fn(),
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
  default: ({ collapsed, onToggle, onToggleTheme }: { collapsed: boolean; onToggle: () => void; onToggleTheme: () => void }) => (
    <div>
      <button type="button" onClick={onToggle}>toggle-navigation</button>
      <a href="/tasks">Tasks</a>
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

  it('preserves browser zoom when the viewport resizes', async () => {
    const { container, unmount } = render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )

    const shell = container.querySelector('.focus-shell') as HTMLElement
    expect(shell.style.getPropertyValue('--shell-scale')).toBe('1')
    expect(document.documentElement).toHaveAttribute('data-ambient-scene', 'rainy-cafe')

    setViewportWidth(1716)
    window.dispatchEvent(new Event('resize'))

    await waitFor(() => {
      expect(shell.style.getPropertyValue('--shell-scale')).toBe('1')
    })
    unmount()
    expect(document.documentElement).not.toHaveAttribute('data-ambient-scene')
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

  it('starts the intermediate rail compact without overwriting the desktop preference', () => {
    setViewportWidth(1200)
    installMatchMediaMock()
    render(
      <MemoryRouter>
        <AppShell>
          <div>child</div>
        </AppShell>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('true')
    expect(localStorage.getItem('focusgo.sidebar.collapsed.v1')).toBeNull()
  })
  it('allows expanding the intermediate rail without replacing the saved desktop choice', async () => {
    setViewportWidth(1200)
    localStorage.setItem('focusgo.sidebar.collapsed.v1', '1')
    const user = userEvent.setup()
    render(<MemoryRouter><AppShell><div>child</div></AppShell></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'toggle-navigation' }))
    expect(screen.getByTestId('sidebar-collapsed')).toHaveTextContent('false')
    expect(localStorage.getItem('focusgo.sidebar.collapsed.v1')).toBe('1')
  })

  it('opens and closes navigation without unmounting the tools or route', async () => {
    setViewportWidth(615)
    const user = userEvent.setup()
    const { container } = render(<MemoryRouter><AppShell><input aria-label="draft" defaultValue="unsaved work" /></AppShell></MemoryRouter>)
    const route = screen.getByLabelText('draft')
    const sidebar = screen.getByTestId('sidebar-collapsed')
    const trigger = container.querySelector('.focus-shell__mobile-bar button') as HTMLButtonElement
    expect(container.querySelector('#workspace-navigation')).toHaveAttribute('inert')
    await user.click(trigger)
    expect(container.querySelector('main')).toHaveAttribute('inert')
    expect(container.querySelector('#workspace-navigation')).not.toHaveAttribute('inert')
    await user.keyboard('{Escape}')
    expect(container.querySelector('main')).not.toHaveAttribute('inert')
    expect(container.querySelector('#workspace-navigation')).toHaveAttribute('inert')
    expect(screen.getByLabelText('draft')).toBe(route)
    expect(screen.getByTestId('sidebar-collapsed')).toBe(sidebar)
    expect(route).toHaveValue('unsaved work')
    expect(trigger).toHaveFocus()
  })

})
