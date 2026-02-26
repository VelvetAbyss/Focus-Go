// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../shared/ui/toast/ToastProvider'
import AppRoutes from './AppRoutes'

const mockUseLabs = vi.fn()

vi.mock('../../features/labs/LabsContext', () => ({
  useLabs: () => mockUseLabs(),
}))

vi.mock('../../features/labs/labsI18n', () => ({
  useLabsI18n: () => ({ toast: { rssAccessDenied: 'RSS denied', habitAccessDenied: 'Habits denied' } }),
}))

vi.mock('./DashboardRoute', () => ({ default: () => <div>Dashboard Page</div> }))
vi.mock('./SettingsRoute', () => ({ default: () => <div>Settings Page</div> }))
vi.mock('../../features/tasks/pages/TasksPage', () => ({ default: () => <div>Tasks Page</div> }))
vi.mock('../../features/focus/pages/FocusPage', () => ({ default: () => <div>Focus Page</div> }))
vi.mock('../../features/calendar/pages/CalendarPage', () => ({ default: () => <div>Calendar Page</div> }))
vi.mock('../../features/notes/pages/NotesPage', () => ({ default: () => <div>Notes Page</div> }))
vi.mock('../../features/diary/pages/ReviewPage', () => ({ default: () => <div>Review Page</div> }))
vi.mock('../../features/labs/pages/LabsPage', () => ({ default: () => <div>Labs Page</div> }))
vi.mock('../../features/rss/pages/RssPage', () => ({ default: () => <div>RSS Page</div> }))
vi.mock('../../features/habits/pages/HabitTrackerPage', () => ({ default: () => <div>Habits Page</div> }))

const renderRoutes = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </MemoryRouter>,
  )

describe('AppRoutes guarded routes', () => {
  beforeEach(() => {
    mockUseLabs.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects /rss to /labs when access is denied', async () => {
    mockUseLabs.mockReturnValue({ ready: true, canAccessRssFeature: false, canAccessHabitFeature: false })
    renderRoutes('/rss')

    expect(await screen.findByText('Labs Page')).toBeInTheDocument()
    expect(await screen.findByText('RSS denied')).toBeInTheDocument()
  })

  it('renders RSS page when access is allowed', async () => {
    mockUseLabs.mockReturnValue({ ready: true, canAccessRssFeature: true, canAccessHabitFeature: true })
    renderRoutes('/rss')

    expect(await screen.findByText('RSS Page')).toBeInTheDocument()
  })

  it('redirects /habits to /labs when access is denied', async () => {
    mockUseLabs.mockReturnValue({ ready: true, canAccessRssFeature: true, canAccessHabitFeature: false })
    renderRoutes('/habits')

    expect(await screen.findByText('Labs Page')).toBeInTheDocument()
    expect(await screen.findByText('Habits denied')).toBeInTheDocument()
  })

  it('renders habits page when access is allowed', async () => {
    mockUseLabs.mockReturnValue({ ready: true, canAccessRssFeature: true, canAccessHabitFeature: true })
    renderRoutes('/habits')

    expect(await screen.findByText('Habits Page')).toBeInTheDocument()
  })
})
