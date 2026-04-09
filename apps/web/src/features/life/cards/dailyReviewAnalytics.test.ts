import { describe, expect, it } from 'vitest'
import type { DiaryEntry, FocusSession, NoteItem, TaskItem } from '../../../data/models/types'
import { buildDailyReviewAnalytics } from './dailyReviewAnalytics'

const createTask = (overrides: Partial<TaskItem> = {}): TaskItem => ({
  id: overrides.id ?? 'task-1',
  title: overrides.title ?? 'Task',
  description: '',
  pinned: false,
  isToday: overrides.isToday ?? false,
  status: overrides.status ?? 'todo',
  priority: overrides.priority ?? null,
  dueDate: overrides.dueDate,
  startDate: overrides.startDate,
  endDate: overrides.endDate,
  reminderAt: overrides.reminderAt,
  reminderFiredAt: overrides.reminderFiredAt,
  tags: [],
  subtasks: overrides.subtasks ?? [],
  taskNoteBlocks: [],
  taskNoteContentMd: '',
  taskNoteContentJson: null,
  activityLogs: overrides.activityLogs ?? [],
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
})

const createSession = (overrides: Partial<FocusSession> = {}): FocusSession => ({
  id: overrides.id ?? 'session-1',
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  plannedMinutes: overrides.plannedMinutes ?? 25,
  actualMinutes: overrides.actualMinutes,
  status: overrides.status ?? 'completed',
  completedAt: overrides.completedAt,
  interruptedAt: overrides.interruptedAt,
  interruptionReason: overrides.interruptionReason,
  taskId: overrides.taskId,
  goal: overrides.goal,
})

const createDiary = (overrides: Partial<DiaryEntry> = {}): DiaryEntry => ({
  id: overrides.id ?? 'diary-1',
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  dateKey: overrides.dateKey ?? '2026-04-01',
  entryAt: overrides.entryAt ?? Date.parse('2026-04-01T09:00:00Z'),
  contentMd: overrides.contentMd ?? 'hello',
  contentJson: null,
  tags: [],
  weatherSnapshot: null,
  deletedAt: overrides.deletedAt ?? null,
  expiredAt: overrides.expiredAt ?? null,
})

const createNote = (overrides: Partial<NoteItem> = {}): NoteItem => ({
  id: overrides.id ?? 'note-1',
  title: overrides.title ?? 'Note',
  contentMd: overrides.contentMd ?? 'content',
  contentJson: null,
  editorMode: 'document',
  collection: 'all-notes',
  tags: [],
  excerpt: '',
  pinned: false,
  wordCount: overrides.wordCount ?? 10,
  charCount: overrides.charCount ?? 20,
  paragraphCount: 1,
  imageCount: 0,
  fileCount: 0,
  headings: [],
  backlinks: [],
  deletedAt: overrides.deletedAt ?? null,
  createdAt: overrides.createdAt ?? Date.parse('2026-04-01T08:00:00Z'),
  updatedAt: overrides.updatedAt ?? Date.parse('2026-04-01T08:00:00Z'),
})

describe('buildDailyReviewAnalytics', () => {
  it('builds today summary from existing repos data', () => {
    const result = buildDailyReviewAnalytics({
      tasks: [
        createTask({
          id: 'task-today',
          title: 'Ship card',
          status: 'done',
          subtasks: [
            { id: 's1', title: 'UI', done: true },
            { id: 's2', title: 'Tests', done: false },
          ],
          activityLogs: [
            { id: 'l1', type: 'status', message: '状态变更为已完成', createdAt: Date.parse('2026-04-08T03:00:00Z') },
          ],
        }),
        createTask({
          id: 'task-old',
          title: 'Old done',
          status: 'done',
          subtasks: [{ id: 's3', title: 'Review', done: true }],
          activityLogs: [
            { id: 'l2', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-04-01T03:00:00Z') },
          ],
        }),
      ],
      sessions: [
        createSession({
          id: 'session-today',
          actualMinutes: 50,
          completedAt: Date.parse('2026-04-08T04:00:00Z'),
        }),
        createSession({
          id: 'session-active',
          status: 'active',
          actualMinutes: 15,
          completedAt: Date.parse('2026-04-08T05:00:00Z'),
        }),
      ],
      diaries: [
        createDiary({
          id: 'diary-today',
          dateKey: '2026-04-08',
          entryAt: Date.parse('2026-04-08T02:00:00Z'),
          deletedAt: null,
        }),
      ],
      notes: [
        createNote({
          id: 'note-today',
          charCount: 120,
          updatedAt: Date.parse('2026-04-08T06:00:00Z'),
        }),
        createNote({
          id: 'note-old',
          charCount: 300,
          updatedAt: Date.parse('2026-04-01T06:00:00Z'),
        }),
      ],
      now: Date.parse('2026-04-08T12:00:00Z'),
      granularity: 'today',
    })

    expect(result.summary.completedTasks).toBe(1)
    expect(result.summary.completedSubtasks).toBe(1)
    expect(result.summary.focusMinutes).toBe(50)
    expect(result.summary.focusPresenceMinutes).toBe(50)
    expect(result.summary.diaryWritten).toBe(true)
    expect(result.summary.noteChars).toBe(120)
    expect(result.completedTasks).toHaveLength(1)
    expect(result.completedTasks[0]?.title).toBe('Ship card')
  })

  it('builds rolling weekly and monthly ranges and ignores deleted diary or tasks without done logs', () => {
    const tasks = [
      createTask({
        id: 'task-week',
        title: 'Weekly done',
        status: 'done',
        subtasks: [
          { id: 'sw1', title: 'A', done: true },
          { id: 'sw2', title: 'B', done: true },
        ],
        activityLogs: [
          { id: 'lw1', type: 'status', message: '状态变更为已完成', createdAt: Date.parse('2026-04-05T03:00:00Z') },
        ],
      }),
      createTask({
        id: 'task-no-log',
        title: 'Done but no log',
        status: 'done',
        subtasks: [{ id: 'sn1', title: 'Ghost', done: true }],
        activityLogs: [],
      }),
      createTask({
        id: 'task-month',
        title: 'Month done',
        status: 'done',
        subtasks: [{ id: 'sm1', title: 'Month sub', done: true }],
        activityLogs: [
          { id: 'lm1', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-03-20T03:00:00Z') },
        ],
      }),
    ]

    const baseInput = {
      tasks,
      sessions: [
        createSession({ id: 'week-session', actualMinutes: 25, completedAt: Date.parse('2026-04-06T03:00:00Z') }),
        createSession({ id: 'month-session', actualMinutes: 90, completedAt: Date.parse('2026-03-21T03:00:00Z') }),
      ],
      diaries: [
        createDiary({ id: 'deleted-diary', dateKey: '2026-04-06', entryAt: Date.parse('2026-04-06T03:00:00Z'), deletedAt: Date.parse('2026-04-06T04:00:00Z') }),
        createDiary({ id: 'month-diary', dateKey: '2026-03-25', entryAt: Date.parse('2026-03-25T03:00:00Z') }),
      ],
      notes: [
        createNote({ id: 'week-note', charCount: 60, updatedAt: Date.parse('2026-04-07T06:00:00Z') }),
        createNote({ id: 'month-note', charCount: 200, updatedAt: Date.parse('2026-03-25T06:00:00Z') }),
      ],
      now: Date.parse('2026-04-08T12:00:00Z'),
    } as const

    const week = buildDailyReviewAnalytics({ ...baseInput, granularity: 'week' })
    const month = buildDailyReviewAnalytics({ ...baseInput, granularity: 'month' })

    expect(week.summary.completedTasks).toBe(1)
    expect(week.summary.completedSubtasks).toBe(2)
    expect(week.summary.diaryWritten).toBe(false)
    expect(week.summary.noteChars).toBe(60)
    expect(week.completedTasks.map((task) => task.id)).toEqual(['task-week'])

    expect(month.summary.completedTasks).toBe(2)
    expect(month.summary.completedSubtasks).toBe(3)
    expect(month.summary.focusMinutes).toBe(115)
    expect(month.summary.diaryWritten).toBe(true)
    expect(month.summary.noteChars).toBe(260)
    expect(month.completedTasks.map((task) => task.id)).toEqual(['task-week', 'task-month'])
  })

  it('accepts both english and chinese done logs', () => {
    const result = buildDailyReviewAnalytics({
      tasks: [
        createTask({
          id: 'task-en',
          title: 'English log',
          status: 'done',
          activityLogs: [{ id: 'en', type: 'status', message: 'Status changed to Done', createdAt: Date.parse('2026-04-08T02:00:00Z') }],
        }),
        createTask({
          id: 'task-zh',
          title: 'Chinese log',
          status: 'done',
          activityLogs: [{ id: 'zh', type: 'status', message: '状态变更为已完成', createdAt: Date.parse('2026-04-08T03:00:00Z') }],
        }),
      ],
      sessions: [],
      diaries: [],
      notes: [],
      now: Date.parse('2026-04-08T12:00:00Z'),
      granularity: 'today',
    })

    expect(result.summary.completedTasks).toBe(2)
    expect(result.completedTasks.map((task) => task.id)).toEqual(['task-zh', 'task-en'])
  })
})
