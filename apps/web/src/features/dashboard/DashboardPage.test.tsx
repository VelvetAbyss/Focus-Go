// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const getMock = vi.fn()

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'dashboard.page': 'Dashboard',
        'dashboard.manageVisibility': 'Manage widgets visibility',
        'dashboard.manageWidgets': 'Manage widgets',
        'dashboard.hideWidget': 'Hide widget',
        'dashboard.toggleVisibility': 'Toggle {{name}}',
        'dashboard.editLayout': 'Edit layout',
        'dashboard.done': 'Done',
        'tasks.cancel': 'Cancel',
      }[key] ?? key),
  }),
}))

vi.mock('react-grid-layout', () => ({
  GridLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useContainerWidth: () => ({ width: 1200, containerRef: { current: null }, mounted: true }),
}))

vi.mock('../../hooks/use-is-breakpoint', () => ({
  useIsBreakpoint: () => false,
}))

vi.mock('../../shared/ui/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}))

vi.mock('./DashboardHeader', () => ({
  default: ({
    onToggleLayoutEdit,
    onToggleWidgetsPanel,
    page,
    onSetPage,
  }: {
    onToggleLayoutEdit: () => void
    onToggleWidgetsPanel: () => void
    page: 'main' | 'life' | 'news'
    onSetPage: (page: 'main' | 'life' | 'news') => void
  }) => (
    <div>
      <button type="button" aria-pressed={page === 'main'} onClick={() => onSetPage('main')}>Focus</button>
      <button type="button" aria-pressed={page === 'life'} onClick={() => onSetPage('life')}>Life</button>
      <button type="button" aria-pressed={page === 'news'} onClick={() => onSetPage('news')}>News</button>
      <button type="button" onClick={onToggleLayoutEdit}>Edit layout</button>
      <button type="button" onClick={onToggleWidgetsPanel}>Manage widgets</button>
    </div>
  ),
}))

vi.mock('../../data/repositories/dashboardRepo', () => ({
  dashboardRepo: {
    get: (...args: unknown[]) => getMock(...args),
    upsert: vi.fn(),
  },
}))

vi.mock('../../data/repositories/syncedPreferencesRepo', () => ({
  SYNCED_PREFERENCES_UPDATED_EVENT: 'synced-preferences-updated',
  syncedPreferencesRepo: {
    persistFromLocal: vi.fn(),
  },
}))

vi.mock('./registry', () => ({
  getDashboardCards: () => [
    {
      id: 'tasks',
      title: 'Tasks',
      defaultVisible: true,
      defaultSize: { w: 4, h: 4 },
      render: () => <div>Tasks card</div>,
    },
  ],
}))

vi.mock('../life/LifeDashboard', () => ({
  default: () => <div>Life dashboard</div>,
}))

vi.mock('../news/NewsDashboard', () => ({
  default: () => <div>News dashboard</div>,
}))


vi.mock('../premium/PremiumProvider', () => ({
  usePremiumGate: () => ({
    isPremium: false,
    canUse: () => ({ allowed: true }),
    openUpgradeModal: vi.fn(),
    guard: vi.fn(async (_key: unknown, action: () => void) => { action(); return true }),
  }),
}))

import DashboardPage from './DashboardPage'

const renderDashboard = (initialEntries = ['/']) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<div>Tasks route</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('DashboardPage onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    getMock.mockReset()
    getMock.mockResolvedValue({
      items: [{ key: 'tasks', x: 0, y: 0, w: 4, h: 4 }],
      hiddenCardIds: [],
      themeOverride: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders stored dashboard cards', async () => {
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Tasks card')).toBeInTheDocument())
    expect(screen.getByRole('main', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows widget visibility panel when widgets panel is enabled in layout edit mode', async () => {
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Tasks card')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manage widgets' }))
    expect(screen.getByLabelText('Manage widgets visibility')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Toggle {{name}}' })).toBeInTheDocument()
  })

  it('hides the widgets panel when layout edit is turned off', async () => {
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Tasks card')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Manage widgets' }))
    await waitFor(() => expect(screen.getByLabelText('Manage widgets visibility')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))

    await waitFor(() => expect(screen.queryByLabelText('Manage widgets visibility')).not.toBeInTheDocument())
  })

  it('switches to the News workspace tab', async () => {
    renderDashboard()

    await waitFor(() => expect(screen.getByText('Tasks card')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'News' }))

    expect(await screen.findByText('News dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Tasks card')).not.toBeInTheDocument()
  })
})
