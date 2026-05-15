// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TimelineItem } from '../../../data/models/types'
import TimelinePage from './TimelinePage'

const listMock = vi.fn()
const backfillMock = vi.fn()
const rebuildMock = vi.fn()
const pinMock = vi.fn()
const hideMock = vi.fn()

vi.mock('../../../data/repositories/timelineRepo', () => ({
  timelineRepo: {
    list: (...args: unknown[]) => listMock(...args),
    backfill: (...args: unknown[]) => backfillMock(...args),
    rebuild: (...args: unknown[]) => rebuildMock(...args),
    pin: (...args: unknown[]) => pinMock(...args),
    hide: (...args: unknown[]) => hideMock(...args),
  },
}))

const makeItem = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
  id: 'tl-1',
  eventId: 'event-1',
  kind: 'task',
  title: 'Completed task',
  summary: 'Ship timeline',
  occurredAt: Date.now(),
  subject: { domain: 'productivity', type: 'task', id: 'task-1' },
  subjectKey: 'task:task-1',
  related: [],
  domain: 'productivity',
  entityType: 'task',
  entityId: 'task-1',
  visibility: 'default',
  pinned: false,
  route: '/tasks',
  icon: 'check-circle',
  accent: '#6B8C7A',
  source: {
    eventType: 'task.completed',
    eventSchemaVersion: 1,
    projectionVersion: 1,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
})

describe('TimelinePage', () => {
  beforeEach(() => {
    listMock.mockReset()
    backfillMock.mockReset().mockResolvedValue(0)
    rebuildMock.mockReset().mockResolvedValue(undefined)
    pinMock.mockReset().mockResolvedValue(undefined)
    hideMock.mockReset().mockResolvedValue(undefined)
  })

  it('renders grouped timeline items and summary stats', async () => {
    listMock.mockResolvedValue({ items: [makeItem()] })

    render(<MemoryRouter><TimelinePage /></MemoryRouter>)

    expect(await screen.findByText('Completed task')).toBeInTheDocument()
    expect(screen.getByText('Ship timeline')).toBeInTheDocument()
    expect(screen.getByText('tasks done')).toBeInTheDocument()
  })

  it('passes filters to the timeline repo', async () => {
    listMock.mockResolvedValue({ items: [] })

    render(<MemoryRouter><TimelinePage /></MemoryRouter>)
    fireEvent.change(await screen.findByPlaceholderText('Search title, summary, source'), { target: { value: 'focus' } })
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'focus' } })
    fireEvent.click(screen.getByRole('button', { name: /Quiet/i }))

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({
        search: 'focus',
        kind: 'focus',
        visibility: ['default', 'quiet'],
      }))
    })
  })

  it('offers rebuild when empty', async () => {
    listMock.mockResolvedValue({ items: [] })

    render(<MemoryRouter><TimelinePage /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /Check existing data/i }))

    await waitFor(() => expect(rebuildMock).toHaveBeenCalled())
    expect(backfillMock).toHaveBeenCalled()
  })
})
