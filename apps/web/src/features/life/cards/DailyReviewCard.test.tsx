// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DailyReviewCard from './DailyReviewCard'
import type { DiaryEntry, FocusSession, NoteItem, TaskItem } from '../../../data/models/types'
import { emitTasksChanged } from '../../tasks/taskSync'

let tasks: TaskItem[] = []
let sessions: FocusSession[] = []
let diaries: DiaryEntry[] = []
let notes: NoteItem[] = []

const tasksListMock = vi.fn(async () => tasks)
const sessionsListMock = vi.fn(async () => sessions)
const diaryRangeMock = vi.fn(async (...args: [string?, string?]) => {
  void args
  return diaries
})
const notesListMock = vi.fn(async () => notes)

vi.mock('../../../data/repositories/tasksRepo', () => ({
  tasksRepo: { list: () => tasksListMock() },
}))

vi.mock('../../../data/repositories/focusRepo', () => ({
  focusRepo: { listSessions: () => sessionsListMock() },
}))

vi.mock('../../../data/repositories/diaryRepo', () => ({
  diaryRepo: { listByRange: (dateFrom: string, dateTo: string) => diaryRangeMock(dateFrom, dateTo) },
}))

vi.mock('../../../data/repositories/notesRepo', () => ({
  notesRepo: { list: () => notesListMock() },
}))

vi.mock('../../../shared/ui/AppNumber', () => ({
  AppNumber: ({ value, className }: { value: number; className?: string }) => <span className={className}>{String(value)}</span>,
}))

const makeTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: overrides.isToday ?? false,
  status: overrides.status ?? 'done',
  priority: null,
  tags: [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: [],
  taskNoteContentMd: '',
  taskNoteContentJson: null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? Date.parse('2026-04-01T08:00:00Z'),
})

const makeSession = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  id: overrides.id ?? 'session-1',
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? Date.parse('2026-04-01T08:00:00Z'),
  plannedMinutes: overrides.plannedMinutes ?? 25,
  actualMinutes: overrides.actualMinutes,
  status: overrides.status ?? 'completed',
  completedAt: overrides.completedAt,
})

const makeDiary = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: overrides.id ?? 'diary-1',
  createdAt: 1,
  updatedAt: 1,
  dateKey: overrides.dateKey ?? '2026-04-08',
  entryAt: overrides.entryAt ?? Date.parse('2026-04-08T06:00:00Z'),
  contentMd: 'entry',
  contentJson: null,
  tags: [],
  weatherSnapshot: null,
  deletedAt: overrides.deletedAt ?? null,
  expiredAt: null,
})

const makeNote = (overrides: Partial<NoteItem> = {}): NoteItem => ({
  id: overrides.id ?? 'note-1',
  title: 'Note',
  contentMd: 'content',
  contentJson: null,
  editorMode: 'document',
  collection: 'all-notes',
  tags: [],
  excerpt: '',
  pinned: false,
  wordCount: 10,
  charCount: overrides.charCount ?? 40,
  paragraphCount: 1,
  imageCount: 0,
  fileCount: 0,
  headings: [],
  backlinks: [],
  deletedAt: null,
  createdAt: 1,
  updatedAt: overrides.updatedAt ?? Date.parse('2026-04-08T07:00:00Z'),
})

describe('DailyReviewCard', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-04-08T12:00:00Z'))
    tasks = []
    sessions = []
    diaries = []
    notes = []
    tasksListMock.mockClear()
    sessionsListMock.mockClear()
    diaryRangeMock.mockClear()
    notesListMock.mockClear()
  }, 10000)

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders today summary and shows weekly/monthly detail with completed tasks', async () => {
    tasks = [
      makeTask({
        id: 'today-task',
        title: 'Ship feature',
        subtasks: [
          { id: 'sub-1', title: 'Design', done: true },
          { id: 'sub-2', title: 'Verify', done: false },
        ],
        activityLogs: [
          { id: 'log-1', type: 'status', message: '状态变更为已完成', createdAt: Date.parse('2026-04-08T03:00:00Z') },
        ],
      }),
      makeTask({
        id: 'month-task',
        title: 'Write spec',
        subtasks: [{ id: 'sub-3', title: 'Outline', done: true }],
        activityLogs: [
          { id: 'log-2', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-20T03:00:00Z') },
        ],
      }),
    ]
    sessions = [
      makeSession({ id: 'today-session', actualMinutes: 30, completedAt: Date.parse('2026-04-08T04:00:00Z') }),
      makeSession({ id: 'week-session', actualMinutes: 25, completedAt: Date.parse('2026-04-06T04:00:00Z') }),
      makeSession({ id: 'month-session', actualMinutes: 45, completedAt: Date.parse('2026-03-20T04:00:00Z') }),
    ]
    diaries = [makeDiary()]
    notes = [
      makeNote({ id: 'note-today', charCount: 88, updatedAt: Date.parse('2026-04-08T06:00:00Z') }),
      makeNote({ id: 'note-month', charCount: 120, updatedAt: Date.parse('2026-03-25T06:00:00Z') }),
    ]

    const user = userEvent.setup()
    render(<DailyReviewCard />)

    expect(await screen.findByText('Daily Review')).toBeInTheDocument()
    expect(screen.getByText('Tasks').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()

    await user.click(screen.getAllByRole('heading', { name: 'Daily Review' })[0])

    expect(await screen.findByRole('button', { name: 'Week' })).toBeInTheDocument()
    expect(screen.getByText('Ship feature')).toBeInTheDocument()
    expect(screen.getByText('Design')).toBeInTheDocument()
    expect(screen.getByText('Verify')).toBeInTheDocument()
    expect(screen.getByTestId('daily-review-tasks-scroll')).toHaveStyle({ minHeight: '0', overflowY: 'auto' })

    await user.click(screen.getByRole('button', { name: 'Month' }))

    await waitFor(() => {
      expect(screen.getByText('Write spec')).toBeInTheDocument()
    })
  })

  it('renders zero state when there is no matching data', async () => {
    render(<DailyReviewCard />)

    expect(await screen.findAllByText('0')).not.toHaveLength(0)
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('refreshes after task changes', async () => {
    tasks = []
    render(<DailyReviewCard />)

    expect(await screen.findByText('Daily Review')).toBeInTheDocument()
    expect(screen.getByText('Tasks').nextElementSibling).toHaveTextContent('0')

    tasks = [
      makeTask({
        id: 'new-done-task',
        title: '分类邮件',
        status: 'done',
        activityLogs: [
          { id: 'log-refresh', type: 'status', message: '状态变更为已完成', createdAt: Date.parse('2026-04-08T08:00:00Z') },
        ],
      }),
    ]

    emitTasksChanged('test')

    await waitFor(() => {
      expect(screen.getByText('Tasks').nextElementSibling).toHaveTextContent('1')
    })
  })
})
