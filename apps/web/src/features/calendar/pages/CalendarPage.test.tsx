// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaskItem } from '../../tasks/tasks.types'

const simpleIcs = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:test-1
DTSTART;VALUE=DATE:20260212
SUMMARY:劳动节
END:VEVENT
END:VCALENDAR`

let tasksDb: TaskItem[] = []
const emitTasksChangedMock = vi.fn()

vi.mock('../../../data/repositories/tasksRepo', () => ({
  tasksRepo: {
    list: vi.fn(async () => tasksDb),
    add: vi.fn(async (payload: Partial<TaskItem>) => {
      const now = Date.now()
      const created = {
        id: `task-${now}`,
        createdAt: now,
        updatedAt: now,
        title: payload.title ?? '',
        description: payload.description ?? '',
        status: payload.status ?? 'todo',
        priority: payload.priority ?? null,
        dueDate: payload.dueDate,
        tags: payload.tags ?? [],
        subtasks: payload.subtasks ?? [],
        progressLogs: [],
        activityLogs: [],
      } as TaskItem
      tasksDb = [created, ...tasksDb]
      return created
    }),
  },
}))

vi.mock('../../tasks/taskSync', () => ({
  emitTasksChanged: (...args: unknown[]) => emitTasksChangedMock(...args),
  subscribeTasksChanged: () => () => undefined,
}))

import { tasksRepo } from '../../../data/repositories/tasksRepo'
import CalendarPage from './CalendarPage'

describe('CalendarPage', () => {
  beforeEach(() => {
    tasksDb = []
    emitTasksChangedMock.mockReset()
    window.localStorage.clear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => simpleIcs }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('right panel renders compact calendar event and task sections', () => {
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    expect(scoped.getByRole('heading', { name: 'Calendar Event' })).toBeInTheDocument()
    expect(scoped.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    expect(scoped.getByRole('textbox', { name: 'New task title' })).toBeInTheDocument()
    expect(scoped.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('applies cjk class for chinese calendar event row', () => {
    const now = new Date()
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    window.localStorage.setItem(
      'focusgo.calendar.icsEvents.v1',
      JSON.stringify({
        'system-cn-lunar': [
          {
            id: 'cjk-event',
            subscriptionId: 'system-cn-lunar',
            title: '春节',
            dateKey,
            kind: 'lunar',
          },
        ],
      })
    )

    const view = render(<CalendarPage />)
    const eventList = view.container.querySelector('[aria-label="Calendar events list"]')
    expect(eventList).not.toBeNull()
    expect(within(eventList as HTMLElement).getByText('春节')).toHaveClass('is-cjk')
  })

  it('applies cjk class for mixed text row', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    const mixedTitle = 'Fix 春节 banner'

    await user.type(scoped.getByRole('textbox', { name: 'New task title' }), mixedTitle)
    await user.click(scoped.getByRole('button', { name: 'Add' }))

    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()
    expect(within(tasksList as HTMLElement).getByText(mixedTitle)).toHaveClass('is-cjk')
  })

  it('creates task for selected date and renders immediately', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    const now = new Date()
    const expectedDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    await user.type(scoped.getByRole('textbox', { name: 'New task title' }), 'Calendar created task')
    await user.click(scoped.getByRole('button', { name: 'Add' }))

    expect(tasksRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Calendar created task',
        status: 'todo',
        priority: null,
        dueDate: expectedDateKey,
      })
    )
    expect(emitTasksChangedMock).toHaveBeenCalledWith('calendar:selected-day-create')
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()
    expect(within(tasksList as HTMLElement).getByText('Calendar created task')).toBeInTheDocument()
    expect(scoped.getByRole('textbox', { name: 'New task title' })).toHaveValue('')
  })

  it('renders added selected-day task in month grid cell', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    const taskTitle = 'Grid task'

    await user.type(scoped.getByRole('textbox', { name: 'New task title' }), taskTitle)
    await user.click(scoped.getByRole('button', { name: 'Add' }))

    const selectedCell = view.container.querySelector('.calendar-month-grid__cell.is-selected')
    expect(selectedCell).not.toBeNull()
    expect(within(selectedCell as HTMLElement).getByText(taskTitle)).toHaveClass('calendar-chip--task')
  })

  it('month title renders once in main area', () => {
    const view = render(<CalendarPage />)
    const monthTitle = view.container.querySelectorAll('.calendar-main-title')
    expect(monthTitle.length).toBe(1)
    expect(view.container.querySelectorAll('.calendar-v2__left-header h2').length).toBe(0)
  })

  it('right panel does not render removed elements', () => {
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    expect(scoped.queryByPlaceholderText('Search events')).not.toBeInTheDocument()
    expect(scoped.queryByRole('heading', { name: 'Selected day' })).not.toBeInTheDocument()
    expect(scoped.queryByText('No tasks for this day')).not.toBeInTheDocument()
    expect(scoped.queryByText('No events')).not.toBeInTheDocument()
  })

  it('does not create task when title is empty', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    await user.click(scoped.getByRole('button', { name: 'Add' }))

    expect(tasksRepo.add).not.toHaveBeenCalled()
  })

  it('updates subscription color for system/account/custom via preset swatches', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    const getRowDot = (name: string) => {
      const row = scoped.getByText(name).closest('.calendar-subscriptions__item')
      expect(row).not.toBeNull()
      return (row as HTMLElement).querySelector('.calendar-subscriptions__dot') as HTMLElement
    }

    await user.click(scoped.getByRole('button', { name: 'Open color picker for Chinese Lunar Calendar' }))
    const systemSwatch = await screen.findByRole('button', { name: 'Set Chinese Lunar Calendar color to #0f766e' })
    await user.click(systemSwatch)

    await user.click(scoped.getByRole('button', { name: 'Open color picker for Google Calendar (M1 Read-Only)' }))
    const accountSwatch = await screen.findByRole('button', { name: 'Set Google Calendar (M1 Read-Only) color to #f59e0b' })
    await user.click(accountSwatch)

    await user.click(scoped.getByRole('button', { name: 'Add calendar account' }))
    await user.click(screen.getByRole('button', { name: 'ICS / webcal' }))
    await user.type(screen.getByLabelText('Name'), 'Team Public Calendar')
    await user.type(screen.getByLabelText('ICS URL'), 'https://example.com/team.ics')
    await user.click(screen.getByRole('button', { name: 'Add ICS subscription' }))

    await user.click(scoped.getByRole('button', { name: 'Open color picker for Team Public Calendar' }))
    const customSwatch = await screen.findByRole('button', { name: 'Set Team Public Calendar color to #10b981' })
    await user.click(customSwatch)

    expect(getRowDot('Chinese Lunar Calendar')).toHaveStyle({ background: '#0f766e' })
    expect(getRowDot('Google Calendar (M1 Read-Only)')).toHaveStyle({ background: '#f59e0b' })
    expect(getRowDot('Team Public Calendar')).toHaveStyle({ background: '#10b981' })

    const lunarChip = view.container.querySelector('.calendar-chip[data-subscription-id="system-cn-lunar"]')
    expect(lunarChip).not.toBeNull()
    expect(lunarChip?.getAttribute('style')).toContain('#0f766e')
  }, 15000)

  it('delete uses confirmation dialog and item can be restored from manage deleted', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    await user.click(scoped.getByRole('button', { name: 'Remove Chinese Lunar Calendar' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(scoped.queryByText('Chinese Lunar Calendar')).not.toBeInTheDocument()

    await user.click(scoped.getByRole('button', { name: /Manage deleted/i }))
    const deletedPanel = scoped.getByText('Chinese Lunar Calendar').closest('.calendar-subscriptions__deleted-item')
    expect(deletedPanel).not.toBeNull()
    await user.click(within(deletedPanel as HTMLElement).getByRole('button', { name: /Restore/i }))

    expect(scoped.getByText('Chinese Lunar Calendar')).toBeInTheDocument()
  })

  it('selected cell keeps stable visual class on click', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)

    const monthGrid = view.container.querySelector('.calendar-month-grid')
    expect(monthGrid).not.toBeNull()
    const dateCells = monthGrid?.querySelectorAll<HTMLButtonElement>('.calendar-month-grid__cell') ?? []
    expect(dateCells.length).toBeGreaterThan(1)

    await user.click(dateCells[1])

    const selectedCells = monthGrid?.querySelectorAll('.calendar-month-grid__cell.is-selected') ?? []
    expect(selectedCells.length).toBe(1)
    expect(selectedCells[0]).toBe(dateCells[1])
  })

  it('date switch clears right-panel task input draft', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const input = within(view.container).getByRole('textbox', { name: 'New task title' })
    await user.type(input, 'draft text')
    expect(input).toHaveValue('draft text')

    const monthGrid = view.container.querySelector('.calendar-month-grid')
    const dateCells = monthGrid?.querySelectorAll<HTMLButtonElement>('.calendar-month-grid__cell') ?? []
    expect(dateCells.length).toBeGreaterThan(1)
    await user.click(dateCells[1])

    expect(input).toHaveValue('')
  })
})
