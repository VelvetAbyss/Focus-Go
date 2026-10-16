// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DAY_NOTES_STORAGE_KEY } from './dayNotesStorage'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

vi.mock('../../../data/repositories/syncedPreferencesRepo', () => ({
  SYNCED_PREFERENCES_UPDATED_EVENT: 'synced-preferences-updated',
  syncedPreferencesRepo: { persistFromLocal: vi.fn() },
}))

import TodayNotesLine from './TodayNotesLine'

const store = (notes: Array<{ date: string; text: string }>, showOnDashboard = true) =>
  window.localStorage.setItem(
    DAY_NOTES_STORAGE_KEY,
    JSON.stringify({ notes: notes.map((note, index) => ({ id: `n${index}`, ...note, createdAt: index + 1, updatedAt: index + 1 })), showOnDashboard }),
  )

const renderLine = () =>
  render(
    <MemoryRouter>
      <TodayNotesLine dayKey="2026-11-17" />
    </MemoryRouter>,
  )

describe('TodayNotesLine', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(cleanup)

  it("shows today's notes as one line that opens the calendar", () => {
    store([
      { date: '2026-11-17', text: 'Mom birthday' },
      { date: '2026-11-17', text: 'Bring umbrella' },
      { date: '2026-11-18', text: 'Tomorrow' },
    ])
    renderLine()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/calendar')
    expect(link).toHaveTextContent('Mom birthday · Bring umbrella')
    expect(link).not.toHaveTextContent('Tomorrow')
  })

  it('shows nothing without notes today or with the dashboard switch off', () => {
    store([{ date: '2026-11-18', text: 'Tomorrow' }])
    const { unmount } = renderLine()
    expect(screen.queryByRole('link')).toBeNull()
    unmount()

    store([{ date: '2026-11-17', text: 'Mom birthday' }], false)
    renderLine()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
