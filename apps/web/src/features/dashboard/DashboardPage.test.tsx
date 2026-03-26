// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ONBOARDING_STATUS_KEY, ONBOARDING_STEP_KEY } from '../onboarding/onboarding.runtime'

const getMock = vi.fn()

vi.mock('../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'dashboard.page': 'Dashboard',
        'dashboard.manageVisibility': 'Manage widgets visibility',
        'dashboard.hideWidget': 'Hide widget',
        'tasks.cancel': 'Cancel',
        'onboarding.welcome.eyebrow': 'First step',
        'onboarding.welcome.title': 'See how your day fits together',
        'onboarding.welcome.description': 'Description',
        'onboarding.welcome.start': 'Open dashboard',
        'onboarding.welcome.skip': 'Skip',
        'onboarding.dashboard.eyebrow': 'Your workspace',
        'onboarding.dashboard.title': 'Everything for today, in one calm surface',
        'onboarding.dashboard.description': 'Overview description',
        'onboarding.dashboard.tasksCta': 'Create first task',
        'onboarding.dashboard.focusCta': 'Open Focus',
        'onboarding.dashboard.diaryCta': 'Open Diary',
        'onboarding.dashboard.dismiss': 'Got it',
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
  default: () => <div>Header</div>,
}))

vi.mock('./layoutSyncAdapter', () => ({
  syncDashboardLayout: vi.fn(),
}))

vi.mock('../../data/repositories/dashboardRepo', () => ({
  dashboardRepo: {
    get: (...args: unknown[]) => getMock(...args),
    upsert: vi.fn(),
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


vi.mock('../premium/PremiumProvider', () => ({
  usePremiumGate: () => ({
    isPremium: false,
    canUse: () => ({ allowed: true }),
    openUpgradeModal: vi.fn(),
    guard: vi.fn(async (_key: unknown, action: () => void) => { action(); return true }),
  }),
}))

import DashboardPage from './DashboardPage'

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
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

  it('shows welcome modal for not started state and starts dashboard onboarding', async () => {
    renderDashboard()

    expect(screen.getByText('See how your day fits together')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }))

    await waitFor(() => expect(screen.getByText('Everything for today, in one calm surface')).toBeInTheDocument())
    expect(screen.queryByText('Tasks route')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(ONBOARDING_STATUS_KEY)).toBe('in_progress')
    expect(window.localStorage.getItem(ONBOARDING_STEP_KEY)).toBe('dashboard_overview')
  })

  it('shows dashboard overview when onboarding is already in progress', async () => {
    window.localStorage.setItem(ONBOARDING_STATUS_KEY, 'in_progress')
    window.localStorage.setItem(ONBOARDING_STEP_KEY, 'dashboard_overview')

    renderDashboard()

    await waitFor(() => expect(screen.getByText('Everything for today, in one calm surface')).toBeInTheDocument())
  })

  it('does not show welcome modal after skip', () => {
    window.localStorage.setItem(ONBOARDING_STATUS_KEY, 'skipped')

    renderDashboard()

    expect(screen.queryByText('See how your day fits together')).not.toBeInTheDocument()
    expect(screen.getByText('Header')).toBeInTheDocument()
  })
})
