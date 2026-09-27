// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PremiumProvider } from '../../features/premium/PremiumProvider'
import { ToastProvider } from '../../shared/ui/toast/ToastProvider'
import AppRoutes from './AppRoutes'
import { ROUTES } from './routes'

const routeTestState = vi.hoisted(() => ({ tasksThrows: false }))

vi.mock('../../features/labs/LabsContext', () => ({
  useLabs: () => ({ isEnabled: () => true }),
}))

vi.mock('./NotFoundPage', () => ({ default: () => <div>Not Found Page</div> }))
vi.mock('./DashboardRoute', () => ({ default: () => <div>Dashboard Page</div> }))
vi.mock('../../features/tasks/pages/TasksPage', () => ({
  default: () => {
    if (routeTestState.tasksThrows) throw new Error('boom')
    return <div>Tasks Page</div>
  },
}))

const renderRoutes = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <PremiumProvider>
          <AppRoutes />
        </PremiumProvider>
      </ToastProvider>
    </MemoryRouter>,
  )

describe('AppRoutes fallbacks', () => {
  beforeEach(() => {
    routeTestState.tasksThrows = false
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the 404 page for an unknown path instead of a blank screen', async () => {
    renderRoutes('/definitely-not-a-route')
    expect(await screen.findByText('Not Found Page')).toBeInTheDocument()
  })

  it('still resolves known routes with the catch-all in place', async () => {
    renderRoutes(ROUTES.TASKS)
    expect(await screen.findByText('Tasks Page')).toBeInTheDocument()
  })

  it('catches a render error in a route and shows a recoverable fallback', async () => {
    // The boundary logs the caught error; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    routeTestState.tasksThrows = true

    renderRoutes(ROUTES.TASKS)

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Tasks Page')).not.toBeInTheDocument()
  })
})
