// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const createTask = (patch: Partial<TaskItem> = {}): TaskItem => {
  const now = Date.now()
  return {
    id: patch.id ?? `task-${now}-${Math.random().toString(16).slice(2)}`,
    createdAt: patch.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
    title: patch.title ?? 'Untitled',
    description: patch.description ?? '',
    status: patch.status ?? 'todo',
    priority: patch.priority ?? null,
    dueDate: patch.dueDate,
    startDate: patch.startDate,
    endDate: patch.endDate,
    reminderAt: patch.reminderAt,
    reminderFiredAt: patch.reminderFiredAt,
    tags: patch.tags ?? [],
    subtasks: patch.subtasks ?? [],
    progressLogs: patch.progressLogs ?? [],
    activityLogs: patch.activityLogs ?? [],
  }
}

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
        startDate: payload.startDate,
        endDate: payload.endDate,
        reminderAt: payload.reminderAt,
        reminderFiredAt: payload.reminderFiredAt,
        tags: payload.tags ?? [],
        subtasks: payload.subtasks ?? [],
        progressLogs: [],
        activityLogs: [],
      } as TaskItem
      tasksDb = [created, ...tasksDb]
      return created
    }),
    remove: vi.fn(async (id: string) => {
      tasksDb = tasksDb.filter((task) => task.id !== id)
    }),
    update: vi.fn(async (task: TaskItem) => {
      tasksDb = tasksDb.map((item) => (item.id === task.id ? task : item))
      return task
    }),
  },
}))

vi.mock('../../tasks/taskSync', () => ({
  emitTasksChanged: (...args: unknown[]) => emitTasksChangedMock(...args),
  subscribeTasksChanged: () => () => undefined,
}))

vi.mock('../../../shared/prefs/useMotionPreference', () => ({
  useMotionPreference: () => ({ reduceMotion: false }),
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
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return []
        }
        root = null
        rootMargin = ''
        thresholds = []
      }
    )
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = vi.fn()
    }
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
      'focusgo.calendar.subscriptions.v1',
      JSON.stringify([
        {
          id: 'custom-cjk',
          name: '农历',
          sourceType: 'custom',
          provider: 'ics',
          color: '#0ea5e9',
          enabled: true,
          syncPermission: 'read',
          order: 0,
          url: 'https://example.com/lunar.ics',
        },
      ])
    )
    window.localStorage.setItem(
      'focusgo.calendar.icsEvents.v1',
      JSON.stringify({
        'custom-cjk': [
          {
            id: 'cjk-event',
            subscriptionId: 'custom-cjk',
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
        tags: ['red'],
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
    expect(within(selectedCell as HTMLElement).getByText(taskTitle)).toHaveClass('calendar-chip--task-red')
  })

  it('today cell keeps red border while selected state remains', () => {
    const view = render(<CalendarPage />)
    const selectedCell = view.container.querySelector('.calendar-month-grid__cell.is-selected')
    expect(selectedCell).not.toBeNull()
    expect(selectedCell).toHaveClass('is-today')
  })

  it('task with date range appears on each covered day', async () => {
    const today = toDateKey(new Date())
    const [year, month] = today.split('-')
    const startDate = `${year}-${month}-10`
    const endDate = `${year}-${month}-12`
    tasksDb = [
      createTask({
        id: 'range-task',
        title: 'Range task',
        startDate,
        endDate,
      }),
    ]

    const view = render(<CalendarPage />)

    await waitFor(() => {
      const cells = Array.from(view.container.querySelectorAll('.calendar-month-grid__cell'))
      const withRangeTask = cells.filter((cell) => within(cell as HTMLElement).queryByText('Range task'))
      expect(withRangeTask.length).toBe(3)
    })
  })

  it('right panel tasks render as cards with metadata', async () => {
    const today = toDateKey(new Date())
    const reminderAt = new Date(`${today}T10:30:00`).getTime()
    tasksDb = [
      createTask({
        id: 'card-task',
        title: 'Card task',
        dueDate: today,
        priority: 'high',
        tags: ['work', 'urgent', 'q1'],
        reminderAt,
      }),
    ]

    const view = render(<CalendarPage />)
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()
    await waitFor(() => {
      expect(within(tasksList as HTMLElement).getByText('Card task')).toBeInTheDocument()
    })
    const card = (tasksList as HTMLElement).querySelector('.calendar-task-card')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText('high')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('work')).toBeInTheDocument()
  })

  it('editing reminder/date range from right card updates task and re-renders', async () => {
    const user = userEvent.setup()
    const today = toDateKey(new Date())
    const [year, month] = today.split('-')
    const nextStart = `${year}-${month}-18`
    const nextEnd = `${year}-${month}-20`
    const reminderDateTime = `${nextStart}T09:30`
    tasksDb = [
      createTask({
        id: 'editable-task',
        title: 'Editable task',
        dueDate: today,
      }),
    ]

    const view = render(<CalendarPage />)
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()
    await within(tasksList as HTMLElement).findByText('Editable task')
    await user.click(within(tasksList as HTMLElement).getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Start date'))
    await user.type(screen.getByLabelText('Start date'), nextStart)
    await user.clear(screen.getByLabelText('End date'))
    await user.type(screen.getByLabelText('End date'), nextEnd)
    await user.clear(screen.getByLabelText('Reminder'))
    await user.type(screen.getByLabelText('Reminder'), reminderDateTime)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(tasksRepo.update).toHaveBeenCalled()
      expect(tasksRepo.update).toHaveBeenLastCalledWith(
        expect.objectContaining({
          id: 'editable-task',
          startDate: nextStart,
          endDate: nextEnd,
          reminderAt: expect.any(Number),
        })
      )
    })
  })

  it('renders existing selected-day task in red even without red tag', async () => {
    const today = toDateKey(new Date())
    tasksDb = [
      createTask({
        id: 'legacy-no-red-tag',
        title: 'Legacy task',
        dueDate: today,
        tags: [],
      }),
    ]

    const view = render(<CalendarPage />)

    await waitFor(() => {
      const selectedCell = view.container.querySelector('.calendar-month-grid__cell.is-selected')
      expect(selectedCell).not.toBeNull()
      const chip = within(selectedCell as HTMLElement).getByText('Legacy task')
      expect(chip).toHaveClass('calendar-chip--task-red')
    })
  })

  it('double-clicking a date creates a task (not calendar event)', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const today = toDateKey(new Date())

    const selectedCell = view.container.querySelector('.calendar-month-grid__cell.is-selected')
    expect(selectedCell).not.toBeNull()
    await user.dblClick(selectedCell as HTMLElement)

    expect(screen.getByRole('heading', { name: 'Create task' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Title'), 'Double click task')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(tasksRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Double click task',
        status: 'todo',
        priority: null,
        dueDate: today,
        tags: ['red'],
      })
    )
    expect(emitTasksChangedMock).toHaveBeenCalledWith('calendar:grid-doubleclick-create')

    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()
    expect(within(tasksList as HTMLElement).getByText('Double click task')).toBeInTheDocument()

    const eventsList = view.container.querySelector('[aria-label="Calendar events list"]')
    expect(eventsList).not.toBeNull()
    expect(within(eventsList as HTMLElement).queryByText('Double click task')).not.toBeInTheDocument()
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

  it('shakes task input on empty submit', async () => {
    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    const input = scoped.getByRole('textbox', { name: 'New task title' })
    const form = input.closest('form')
    expect(form).not.toBeNull()

    fireEvent.submit(form as HTMLFormElement)
    await waitFor(() => {
      expect(input).toHaveClass('is-shaking')
    })
    expect(tasksRepo.add).not.toHaveBeenCalled()
  })

  it('deletes selected-day task and syncs month chip immediately', async () => {
    const user = userEvent.setup()
    const today = toDateKey(new Date())
    tasksDb = [
      createTask({ id: 'delete-target', title: 'Delete me', dueDate: today, createdAt: 1000 }),
      createTask({ id: 'keep-target', title: 'Keep me', dueDate: today, createdAt: 999 }),
    ]

    const view = render(<CalendarPage />)
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()

    const taskTitle = await within(tasksList as HTMLElement).findByText('Delete me')
    const row = taskTitle.closest('.calendar-task-card')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete task' }))

    await waitFor(() => {
      expect(tasksRepo.remove).toHaveBeenCalledWith('delete-target')
    })
    expect(emitTasksChangedMock).toHaveBeenCalledWith('calendar:selected-day-delete')
    expect(within(tasksList as HTMLElement).queryByText('Delete me')).not.toBeInTheDocument()
    expect(within(tasksList as HTMLElement).getByText('Keep me')).toBeInTheDocument()

    const selectedCell = view.container.querySelector('.calendar-month-grid__cell.is-selected')
    expect(selectedCell).not.toBeNull()
    expect(within(selectedCell as HTMLElement).queryByText('Delete me')).not.toBeInTheDocument()
  })

  it('shows inline error when deleting task fails', async () => {
    const user = userEvent.setup()
    const today = toDateKey(new Date())
    tasksDb = [createTask({ id: 'delete-fail', title: 'Delete fails', dueDate: today })]
    vi.mocked(tasksRepo.remove).mockRejectedValueOnce(new Error('boom'))

    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()

    const taskTitle = await within(tasksList as HTMLElement).findByText('Delete fails')
    const row = taskTitle.closest('.calendar-task-card')
    expect(row).not.toBeNull()
    await user.click(within(row as HTMLElement).getByRole('button', { name: 'Delete task' }))

    await waitFor(() => {
      expect(scoped.getByText('Failed to delete task. Please try again.')).toBeInTheDocument()
    })
    expect(within(tasksList as HTMLElement).getByText('Delete fails')).toBeInTheDocument()
    expect(emitTasksChangedMock).not.toHaveBeenCalledWith('calendar:selected-day-delete')
  })

  it('keeps delete loading state scoped per task row', async () => {
    const user = userEvent.setup()
    const today = toDateKey(new Date())
    tasksDb = [
      createTask({ id: 'pending-delete', title: 'Pending delete', dueDate: today, createdAt: 1100 }),
      createTask({ id: 'other-task', title: 'Other task', dueDate: today, createdAt: 1000 }),
    ]

    let resolveRemove!: () => void
    const pendingRemove = new Promise<void>((resolve) => {
      resolveRemove = resolve
    })
    vi.mocked(tasksRepo.remove).mockReturnValueOnce(pendingRemove)

    const view = render(<CalendarPage />)
    const tasksList = view.container.querySelector('[aria-label="Tasks list"]')
    expect(tasksList).not.toBeNull()

    const pendingTitle = await within(tasksList as HTMLElement).findByText('Pending delete')
    const otherTitle = await within(tasksList as HTMLElement).findByText('Other task')
    const pendingRow = pendingTitle.closest('.calendar-task-card')
    const otherRow = otherTitle.closest('.calendar-task-card')
    expect(pendingRow).not.toBeNull()
    expect(otherRow).not.toBeNull()

    const pendingButton = within(pendingRow as HTMLElement).getByRole('button', { name: 'Delete task' })
    const otherButton = within(otherRow as HTMLElement).getByRole('button', { name: 'Delete task' })
    await user.click(pendingButton)

    expect(pendingButton).toBeDisabled()
    expect(otherButton).not.toBeDisabled()
    expect((pendingRow as HTMLElement).querySelector('.calendar-side-row__delete-icon.is-loading')).toBeInTheDocument()

    resolveRemove()
    await waitFor(() => {
      expect(within(tasksList as HTMLElement).queryByText('Pending delete')).not.toBeInTheDocument()
    })
  })

  it('renders unified calendar list without legacy group labels and without custom subtitle', () => {
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    expect(scoped.queryByText('Custom Calendar')).not.toBeInTheDocument()
    expect(scoped.queryByText('System calendars')).not.toBeInTheDocument()
    expect(scoped.queryByText('Account calendars')).not.toBeInTheDocument()
    expect(scoped.queryByText('Custom subscriptions')).not.toBeInTheDocument()
    expect(scoped.queryByText(/Manage deleted/i)).not.toBeInTheDocument()
  })

  it('removes system subscriptions on initial load', () => {
    window.localStorage.setItem(
      'focusgo.calendar.subscriptions.v1',
      JSON.stringify([
        {
          id: 'system-cn-lunar',
          name: 'Chinese Lunar Calendar',
          sourceType: 'system',
          provider: 'ics',
          color: '#94a3b8',
          enabled: true,
          syncPermission: 'read',
          order: 0,
        },
        {
          id: 'account-google',
          name: 'Google Calendar (M1 Read-Only)',
          sourceType: 'account',
          provider: 'google',
          color: '#2563eb',
          enabled: true,
          syncPermission: 'read',
          order: 1,
        },
        {
          id: 'custom-holiday',
          name: '节假日',
          sourceType: 'custom',
          provider: 'ics',
          color: '#0ea5e9',
          enabled: true,
          syncPermission: 'read',
          order: 2,
          url: 'https://example.com/holiday.ics',
        },
      ])
    )

    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    expect(scoped.queryByText('Chinese Lunar Calendar')).not.toBeInTheDocument()
    expect(scoped.getByText('Google Calendar (M1 Read-Only)')).toBeInTheDocument()
    expect(scoped.getByText('节假日')).toBeInTheDocument()
  })

  it('updates add entry label to Add subscription', () => {
    const view = render(<CalendarPage />)
    const addButton = within(view.container).getByRole('button', { name: 'Add subscription' })
    expect(addButton).toBeInTheDocument()
    expect(addButton).toHaveClass('calendar-subscriptions__add')
  })

  it('shows ics guide only in ics mode', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    await user.click(scoped.getByRole('button', { name: 'Add subscription' }))

    expect(screen.queryByLabelText('ICS guide')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ICS / webcal' }))
    expect(screen.getByLabelText('ICS guide')).toBeInTheDocument()
    expect(screen.getByText('How to get an ICS subscription URL')).toBeInTheDocument()
  })

  it('renders preset placeholder cards', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)
    await user.click(scoped.getByRole('button', { name: 'Add subscription' }))

    const presetSection = screen.getByLabelText('Preset subscriptions')
    expect(within(presetSection).getByText('Preset subscriptions')).toBeInTheDocument()
    expect(within(presetSection).getByText(/China Public Holidays/)).toBeInTheDocument()
    expect(within(presetSection).getByText(/US Federal Holidays/)).toBeInTheDocument()
    expect(within(presetSection).getByText(/Moon Phases/)).toBeInTheDocument()

    const addButtons = within(presetSection).getAllByRole('button', { name: 'Add' })
    expect(addButtons.length).toBeGreaterThanOrEqual(3)
    addButtons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('drag handle reorders unified list and persists order', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(
      'focusgo.calendar.subscriptions.v1',
      JSON.stringify([
        {
          id: 'custom-alpha',
          name: 'Alpha',
          sourceType: 'custom',
          provider: 'ics',
          color: '#0ea5e9',
          enabled: true,
          syncPermission: 'read',
          order: 0,
          url: 'https://example.com/a.ics',
        },
        {
          id: 'custom-beta',
          name: 'Beta',
          sourceType: 'custom',
          provider: 'ics',
          color: '#10b981',
          enabled: true,
          syncPermission: 'read',
          order: 1,
          url: 'https://example.com/b.ics',
        },
      ])
    )

    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    const alphaHandle = scoped.getByRole('button', { name: 'Reorder Alpha' })
    alphaHandle.focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')

    await waitFor(() => {
      const names = Array.from(view.container.querySelectorAll('.calendar-subscriptions__name')).map((item) =>
        item.textContent?.trim()
      )
      expect(names.slice(0, 2)).toEqual(['Beta', 'Alpha'])
    })

    const storedRaw = window.localStorage.getItem('focusgo.calendar.subscriptions.v1')
    expect(storedRaw).toBeTruthy()
    const stored = JSON.parse(storedRaw ?? '[]') as Array<{ id: string; order: number }>
    const alpha = stored.find((item) => item.id === 'custom-alpha')
    const beta = stored.find((item) => item.id === 'custom-beta')
    expect(beta?.order).toBeLessThan(alpha?.order ?? 0)
  })

  it('updates subscription color in unified list via preset swatches', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    const getRowDot = (name: string) => {
      const row = scoped.getByText(name).closest('.calendar-subscriptions__item')
      expect(row).not.toBeNull()
      return (row as HTMLElement).querySelector('.calendar-subscriptions__dot-trigger') as HTMLElement
    }

    await user.click(scoped.getByRole('button', { name: 'Open color picker for Google Calendar (M1 Read-Only)' }))
    const accountSwatch = await screen.findByRole('button', { name: 'Set Google Calendar (M1 Read-Only) color to #f59e0b' })
    await user.click(accountSwatch)

    await user.click(scoped.getByRole('button', { name: 'Add subscription' }))
    await user.click(screen.getByRole('button', { name: 'ICS / webcal' }))
    await user.type(screen.getByLabelText('Name'), 'Team Public Calendar')
    await user.type(screen.getByLabelText('ICS URL'), 'https://example.com/team.ics')
    await user.click(screen.getByRole('button', { name: 'Add ICS subscription' }))

    await user.click(scoped.getByRole('button', { name: 'Open color picker for Team Public Calendar' }))
    const customSwatch = await screen.findByRole('button', { name: 'Set Team Public Calendar color to #10b981' })
    await user.click(customSwatch)

    expect(getRowDot('Google Calendar (M1 Read-Only)')).toHaveStyle({ background: '#f59e0b' })
    expect(getRowDot('Team Public Calendar')).toHaveStyle({ background: '#10b981' })

    const googleChip = view.container.querySelector('.calendar-chip[data-subscription-id="account-google"]')
    expect(googleChip).not.toBeNull()
    expect(googleChip?.getAttribute('style')).toContain('#f59e0b')
  }, 15000)

  it('uses eye visibility toggles in subscription rows', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    const toggle = scoped.getByRole('button', { name: 'Toggle visibility for Google Calendar (M1 Read-Only)' })
    expect(toggle).toBeInTheDocument()

    await user.click(toggle)
    const row = scoped.getByText('Google Calendar (M1 Read-Only)').closest('.calendar-subscriptions__item')
    expect(row).not.toBeNull()
    expect(row).toHaveClass('is-disabled')
  })

  it('ics add flow still works with guide and presets present', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    await user.click(scoped.getByRole('button', { name: 'Add subscription' }))
    await user.click(screen.getByRole('button', { name: 'ICS / webcal' }))
    await user.type(screen.getByLabelText('Name'), 'Flow test calendar')
    await user.type(screen.getByLabelText('ICS URL'), 'https://example.com/flow.ics')
    await user.click(screen.getByRole('button', { name: 'Add ICS subscription' }))

    expect(scoped.getByText('Flow test calendar')).toBeInTheDocument()
  })

  it('delete permanently removes subscription and no restore panel appears', async () => {
    const user = userEvent.setup()
    const view = render(<CalendarPage />)
    const scoped = within(view.container)

    await user.click(scoped.getByRole('button', { name: 'Remove Google Calendar (M1 Read-Only)' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(scoped.queryByText('Google Calendar (M1 Read-Only)')).not.toBeInTheDocument()
    expect(scoped.queryByText(/Manage deleted/i)).not.toBeInTheDocument()
    expect(scoped.queryByRole('button', { name: /Restore/i })).not.toBeInTheDocument()
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
