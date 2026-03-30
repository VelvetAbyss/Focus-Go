// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { DiaryEntry } from '../../../data/models/types'

const now = Date.now()
const todayKey = new Date().toISOString().slice(0, 10)

const { diaryRepoMock, resetMock } = vi.hoisted(() => {
  const entries: DiaryEntry[] = []
  const mock = {
    listByRange: vi.fn(async () => [...entries]),
    listActive: vi.fn(async () => [...entries]),
    add: vi.fn(async (data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const entry: DiaryEntry = {
        id: `e-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        ...data,
        entryAt: data.entryAt ?? now,
        contentMd: data.contentMd,
        contentJson: null,
        tags: [],
      }
      entries.push(entry)
      return entry
    }),
    update: vi.fn(async (entry: DiaryEntry) => ({ ...entry, updatedAt: Date.now() })),
    softDeleteById: vi.fn(async () => null),
    getByDate: vi.fn(async () => undefined),
  }
  return { diaryRepoMock: mock, resetMock: () => { entries.length = 0; Object.values(mock).forEach((fn) => fn.mockClear()) } }
})

vi.mock('../../../data/repositories/diaryRepo', () => ({
  diaryRepo: diaryRepoMock,
}))

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

vi.mock('../../weather/weatherRuntime', () => ({
  getWeatherSnapshot: () => ({ status: 'loading', data: null }),
}))

// Stub TipTap editor
vi.mock('../components/DiaryEditor', () => ({
  default: ({ onChange }: { onChange: (v: { contentMd: string; contentJson: null }) => void }) => (
    <textarea
      data-testid="diary-editor"
      onChange={(e) => onChange({ contentMd: e.target.value, contentJson: null })}
    />
  ),
}))

import DiaryPage from './DiaryPage'

const renderPage = () =>
  render(
    <MemoryRouter>
      <DiaryPage />
    </MemoryRouter>
  )

describe('DiaryPage', () => {
  beforeEach(() => {
    resetMock()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the stats panel', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Streak')).toBeInTheDocument()
      expect(screen.getByText('Entries')).toBeInTheDocument()
      expect(screen.queryByText('Weekly Words')).not.toBeInTheDocument()
    })
  })

  it('renders view switcher buttons', async () => {
    renderPage()
    expect(screen.getByRole('button', { name: /Day/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Week/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Month/i })).toBeInTheDocument()
  })

  it('shows empty state when no entries', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No entries for this period/i)).toBeInTheDocument()
    })
  })

  it('shows date label including Today', async () => {
    renderPage()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows entries in timeline after loading', async () => {
    diaryRepoMock.listByRange.mockResolvedValueOnce([
      {
        id: 'e1',
        dateKey: todayKey,
        entryAt: now,
        contentMd: 'Hello world',
        contentJson: null,
        tags: [],
        deletedAt: null,
        expiredAt: null,
        createdAt: now,
        updatedAt: now,
        weatherSnapshot: null,
      },
    ])
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Hello world/i)).toBeInTheDocument()
    })
  })

  it('creates a new entry on clicking New entry', async () => {
    const { getByRole } = renderPage()
    await waitFor(() => screen.getByText(/No entries/i))

    const newBtn = getByRole('button', { name: /New entry/i })
    newBtn.click()

    await waitFor(() => {
      expect(diaryRepoMock.add).toHaveBeenCalledTimes(1)
    })
    const call = diaryRepoMock.add.mock.calls[0][0] as { dateKey: string; entryAt: number }
    expect(call.dateKey).toBe(todayKey)
    expect(typeof call.entryAt).toBe('number')
  })

  it('keeps fixed layout slot for word count', async () => {
    diaryRepoMock.listByRange.mockResolvedValueOnce([
      {
        id: 'e1',
        dateKey: todayKey,
        entryAt: now,
        contentMd: 'Hello world',
        contentJson: null,
        tags: [],
        deletedAt: null,
        expiredAt: null,
        createdAt: now,
        updatedAt: now,
        weatherSnapshot: null,
      },
    ])
    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Hello world/i)).toBeInTheDocument()
    })

    screen.getByText(/Hello world/i).click()

    await waitFor(() => {
      expect(container.querySelector('.diary-page__word-count')).toBeInTheDocument()
    })
  })
})
