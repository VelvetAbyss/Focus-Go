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
      contentMd,
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

const walkToCloseStep = async (user: ReturnType<typeof userEvent.setup>) => {
  const clickNext = async () => {
    const nextButtons = await screen.findAllByRole('button', { name: 'Next' })
    await user.click(nextButtons[nextButtons.length - 1])
  }

  await clickNext()
  const reflectionField = await screen.findByLabelText('Daily reflection')
  await user.type(reflectionField, 'Today was productive.')
  await clickNext()
  await clickNext()
}

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

    await walkToCloseStep(user)
    const submitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(submitButtons[submitButtons.length - 1])

    expect((await screen.findAllByText('Review complete')).length).toBeGreaterThan(0)
    const today = toDateKey()
    const saved = store.get(today)
    expect(saved).toBeTruthy()
    expect(saved?.contentMd).toContain('REVIEW_BLOCK_START')
    expect(saved?.contentMd).toContain('Today was productive.')
    expect(diaryRepoMock.add).toHaveBeenCalledTimes(1)
  })

  it('shows submitted review in side history panel', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await walkToCloseStep(user)
    const submitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(submitButtons[submitButtons.length - 1])
    expect((await screen.findAllByText('Review complete')).length).toBeGreaterThan(0)

    await findSnapshotCount(1)
  })

  it('appends multiple snapshots on same day', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await walkToCloseStep(user)
    const firstSubmitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(firstSubmitButtons[firstSubmitButtons.length - 1])
    expect((await screen.findAllByText('Review complete')).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Start New Review' }))
    await walkToCloseStep(user)
    const secondSubmitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(secondSubmitButtons[secondSubmitButtons.length - 1])
    expect((await screen.findAllByText('Review complete')).length).toBeGreaterThan(0)

    await findSnapshotCount(2)
  })

  it('shows error and stays incomplete when diary write fails', async () => {
    const user = userEvent.setup()
    diaryRepoMock.add.mockRejectedValueOnce(new Error('write failed'))
    render(<ReviewPage />)

    await walkToCloseStep(user)
    const submitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(
        screen.getByText('Failed to save review snapshot to diary. Please try again.')
      ).toBeInTheDocument()
    })
    expect(screen.queryAllByText('Review complete')).toHaveLength(0)
  })

  it('renders workflow and history containers simultaneously', async () => {
    render(<ReviewPage />)

    expect(screen.getByLabelText('Review workflow')).toBeInTheDocument()
    expect(screen.getByLabelText('Review history')).toBeInTheDocument()
    expect(screen.getByText('Review History')).toBeInTheDocument()
  })

  it('keeps completed state visible while history updates after submit', async () => {
    const user = userEvent.setup()
    render(<ReviewPage />)

    await walkToCloseStep(user)
    const submitButtons = await screen.findAllByRole('button', { name: 'Submit Review' })
    await user.click(submitButtons[submitButtons.length - 1])

    expect((await screen.findAllByText('Review complete')).length).toBeGreaterThan(0)
    await findSnapshotCount(1)
  })
})
