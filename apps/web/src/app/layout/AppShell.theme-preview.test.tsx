// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell'
import { THEME_BEFORE_MODE_TOGGLE_EVENT } from '../../shared/theme/themePack'

const mockApplyTheme = vi.fn()
const mockReadStoredThemePreference = vi.fn()
const mockResolveInitialTheme = vi.fn()
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
  writeStoredThemePreference: (...args: unknown[]) => mockWriteStoredThemePreference(...args),
}))

vi.mock('./Sidebar', () => ({
  default: ({ onToggleTheme }: { onToggleTheme: () => void }) => (
    <button type="button" onClick={onToggleTheme}>
      toggle-theme
    </button>
  ),
}))

describe('AppShell theme preview event flow', () => {
  beforeEach(() => {
    mockReadStoredThemePreference.mockReturnValue(null)
    mockResolveInitialTheme.mockReturnValue('light')
    mockApplyTheme.mockReset()
    mockWriteStoredThemePreference.mockReset()
  })

  it('dispatches before-mode-toggle event before applying toggled theme', async () => {
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
})
