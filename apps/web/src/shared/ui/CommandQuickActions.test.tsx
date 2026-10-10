// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Command } from 'cmdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// cmdk measures its list; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver
Element.prototype.scrollIntoView ??= () => {}

const timer = { state: { running: false, status: 'idle', durationMinutes: 25 }, start: vi.fn(), pause: vi.fn(), resume: vi.fn() }
const salary = { settings: null as unknown, activeBreakStartAt: null as number | null }
const startBreak = vi.fn()
const stopBreak = vi.fn()

vi.mock('../i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string, values?: Record<string, unknown>) => (values?.n !== undefined ? `${key} ${values.n}` : key) }),
}))
vi.mock('../../features/auth/AuthGateContext', () => ({ useAuthGate: () => ({ requireAuth: (action: () => void) => action() }) }))
vi.mock('../../features/focus/useSharedFocusTimer', () => ({ useSharedFocusTimer: () => timer }))
vi.mock('../../features/salary/useSalaryState', () => ({
  useSalaryState: () => salary,
  startBreak: () => startBreak(),
  stopBreak: () => stopBreak(),
}))

import CommandQuickActions from './CommandQuickActions'

const renderActions = (needle = '') => {
  const run = vi.fn((fn: () => void) => fn())
  render(
    <Command shouldFilter={false}>
      <Command.List>
        <CommandQuickActions needle={needle} run={run} />
      </Command.List>
    </Command>,
  )
  return run
}

beforeEach(() => {
  timer.state = { running: false, status: 'idle', durationMinutes: 25 }
  salary.settings = null
  salary.activeBreakStartAt = null
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('CommandQuickActions', () => {
  it('starts a focus session of the timer length and closes the palette', () => {
    const run = renderActions()
    fireEvent.click(screen.getByText('commandPalette.do.startFocus 25'))
    expect(run).toHaveBeenCalledTimes(1)
    expect(timer.start).toHaveBeenCalledWith(25)
  })

  it('offers pause while running and resume while paused', () => {
    timer.state = { running: true, status: 'running', durationMinutes: 25 }
    renderActions()
    fireEvent.click(screen.getByText('commandPalette.do.pauseFocus'))
    expect(timer.pause).toHaveBeenCalled()
    cleanup()

    timer.state = { running: false, status: 'paused', durationMinutes: 25 }
    renderActions()
    fireEvent.click(screen.getByText('commandPalette.do.resumeFocus'))
    expect(timer.resume).toHaveBeenCalled()
  })

  it('offers breaks only once the pay widgets are set up', () => {
    renderActions()
    expect(screen.queryByText('commandPalette.do.startBreak')).not.toBeInTheDocument()
    cleanup()

    salary.settings = { monthlySalary: 1 }
    renderActions()
    fireEvent.click(screen.getByText('commandPalette.do.startBreak'))
    expect(startBreak).toHaveBeenCalled()
    cleanup()

    salary.activeBreakStartAt = Date.now()
    renderActions()
    fireEvent.click(screen.getByText('commandPalette.do.stopBreak'))
    expect(stopBreak).toHaveBeenCalled()
  })

  it('filters by the query, in either language', () => {
    salary.settings = { monthlySalary: 1 }
    renderActions('摸鱼')
    expect(screen.getByText('commandPalette.do.startBreak')).toBeInTheDocument()
    expect(screen.queryByText(/startFocus/)).not.toBeInTheDocument()
    cleanup()
    renderActions('pomodoro')
    expect(screen.getByText('commandPalette.do.startFocus 25')).toBeInTheDocument()
  })
})
