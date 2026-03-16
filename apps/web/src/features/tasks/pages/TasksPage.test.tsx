// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../TasksBoard', () => ({
  default: () => <div data-testid="tasks-board" />,
}))

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'modules.tasks.title': 'Tasks',
        'modules.tasks.board': 'Board',
        'modules.tasks.analytics': 'Analytics',
        'modules.tasks.viewAria': 'Tasks page view',
      })[key] ?? key,
  }),
}))

import TasksPage from './TasksPage'

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

describe('TasksPage viewport adaptation', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('applies compact ultrawide viewport bands for short wide screens', () => {
    setViewport(1728, 864)

    render(<TasksPage />)

    const page = screen.getByText('Tasks').closest('.tasks-page')
    expect(page).toHaveAttribute('data-height-band', 'compact')
    expect(page).toHaveAttribute('data-ratio-band', 'ultrawide')
    expect(page).toHaveStyle('--tasks-page-viewport-height: 864px')
  })

  it('renders analytics instead of list in the top-level switch', () => {
    render(<TasksPage />)

    const switcher = screen.getByRole('tablist', { name: 'Tasks page view' })
    expect(within(switcher).getByRole('tab', { name: 'Board' })).toBeInTheDocument()
    expect(within(switcher).getByRole('tab', { name: 'Analytics' })).toBeInTheDocument()
    expect(within(switcher).queryByRole('tab', { name: 'List' })).not.toBeInTheDocument()
  })

  it('migrates a stored list mode preference to analytics', () => {
    window.localStorage.setItem('tasks_page_view_mode', 'list')

    render(<TasksPage />)

    const switcher = screen.getByRole('tablist', { name: 'Tasks page view' })
    expect(within(switcher).getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true')
    expect(window.localStorage.getItem('tasks_page_view_mode')).toBe('analytics')
  })

  it('keeps panel and frame from clipping container shadows', () => {
    render(<TasksPage />)

    const panel = document.querySelector('.tasks-page-shell__panel')
    const frame = document.querySelector('.tasks-page-shell__panel-frame')

    expect(panel).toBeInTheDocument()
    expect(panel?.className).not.toContain('overflow-hidden')
    expect(frame).toBeInTheDocument()
    expect(frame?.className).not.toContain('overflow-hidden')
  })
})
