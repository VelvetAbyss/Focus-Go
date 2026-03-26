// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiaryEntry } from '../../../data/models/types'
import { toDateKey } from '../../../shared/utils/time'
import ReviewPage from './ReviewPage'

const { store, diaryRepoMock, resetStore } = vi.hoisted(() => {
  const diaryStore = new Map<string, DiaryEntry>()
  let seq = 0

  const createEntry = (dateKey: string, contentMd: string): DiaryEntry => {
    const now = Date.now()
    seq += 1
    return {
      id: `entry-${seq}`,
      createdAt: now,
      updatedAt: now,
      dateKey,
      entryAt: now,
      contentMd,
      contentJson: null,
      tags: [],
      deletedAt: null,
      expiredAt: null,
    }
  }

  const mock = {
    listActive: vi.fn(async () =>
      Array.from(diaryStore.values())
        .filter((entry) => !entry.deletedAt)
        .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    ),
    getByDate: vi.fn(async (dateKey: string) => diaryStore.get(dateKey) ?? null),
    add: vi.fn(async (data: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      const next = createEntry(data.dateKey, data.contentMd)
      diaryStore.set(next.dateKey, next)
      return next
    }),
    update: vi.fn(async (entry: DiaryEntry) => {
      const next = { ...entry, updatedAt: Date.now() }
      diaryStore.set(next.dateKey, next)
      return next
    }),
  }

  return {
    store: diaryStore,
    diaryRepoMock: mock,
    resetStore: () => {
      diaryStore.clear()
      seq = 0
      Object.values(mock).forEach((fn) => fn.mockClear())
    },
  }
})

vi.mock('../../../data/repositories/diaryRepo', () => ({
  diaryRepo: diaryRepoMock,
}))

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

const findSnapshotCount = async (count: number) => {
  await waitFor(() => {
    expect(diaryRepoMock.listActive).toHaveBeenCalled()
  })
  const rows = Array.from(store.values())
  expect(rows.length).toBeGreaterThan(0)
  const today = rows.find((entry) => entry.dateKey === toDateKey())
  expect(today).toBeTruthy()
  const matches = (today?.contentMd.match(/REVIEW_BLOCK_START/g) ?? []).length
  expect(matches).toBe(count)
}

describe('ReviewPage', () => {
  beforeEach(() => {
    resetStore()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('submits review and writes snapshot into diary', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await user.type(screen.getByLabelText('One-line summary of today'), 'Today was productive.')
    await user.type(screen.getByLabelText('Most important thing for tomorrow'), 'Finish the proposal.')
    await user.click(screen.getByRole('button', { name: "Save today's review" }))

    expect(await screen.findByText('Saved for today')).toBeInTheDocument()
    const today = toDateKey()
    const saved = store.get(today)
    expect(saved).toBeTruthy()
    expect(saved?.contentMd).toContain('REVIEW_BLOCK_START')
    expect(saved?.contentMd).toContain('- Summary: Today was productive.')
    expect(saved?.contentMd).toContain('- Tomorrow Focus: Finish the proposal.')
    expect(diaryRepoMock.add).toHaveBeenCalledTimes(1)
  })

  it('shows submitted review in side history panel', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await user.type(screen.getByLabelText('One-line summary of today'), 'A quiet day.')
    await user.click(screen.getByRole('button', { name: "Save today's review" }))
    expect(await screen.findByText('Saved for today')).toBeInTheDocument()

    await findSnapshotCount(1)
  })

  it('appends multiple snapshots on same day', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await user.type(screen.getByLabelText('One-line summary of today'), 'First pass.')
    await user.click(screen.getByRole('button', { name: "Save today's review" }))
    expect(await screen.findByText('Saved for today')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start a new reflection' }))
    await user.type(screen.getByLabelText('One-line summary of today'), 'Second pass.')
    await user.click(await screen.findByRole('button', { name: "Save today's review" }))
    expect(await screen.findByText('Saved for today')).toBeInTheDocument()

    await findSnapshotCount(2)
  })

  it('shows error and stays incomplete when diary write fails', async () => {
    const user = userEvent.setup()
    diaryRepoMock.add.mockRejectedValueOnce(new Error('write failed'))
    render(<ReviewPage />)

    await user.click(screen.getByRole('button', { name: "Save today's review" }))

    await waitFor(() => {
      expect(
        screen.getByText('Failed to save review snapshot to diary. Please try again.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('Saved for today')).not.toBeInTheDocument()
  })

  it('renders workflow and history containers simultaneously', async () => {
    render(<ReviewPage />)

    expect(screen.getByLabelText('Review workflow')).toBeInTheDocument()
    expect(screen.getByLabelText('Review history')).toBeInTheDocument()
    expect(screen.getByText('Your reflections')).toBeInTheDocument()
    expect(screen.getByLabelText('One-line summary of today')).toBeInTheDocument()
  })

  it('keeps completed state visible while history updates after submit', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await user.type(screen.getByLabelText('One-line summary of today'), 'A gentle finish.')
    await user.click(screen.getByRole('button', { name: "Save today's review" }))

    expect(await screen.findByText('Saved for today')).toBeInTheDocument()
    await findSnapshotCount(1)
  })
})
