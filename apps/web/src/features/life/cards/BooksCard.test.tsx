// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BooksCard from './BooksCard'
import { PreferencesProvider } from '../../../shared/prefs/PreferencesProvider'

const { listBooks, createBook } = vi.hoisted(() => ({
  listBooks: vi.fn(),
  createBook: vi.fn(),
}))

vi.mock('../../../data/repositories/booksRepo', () => ({
  booksRepo: {
    list: listBooks,
    create: createBook,
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

describe('BooksCard', () => {
  beforeEach(() => {
    listBooks.mockResolvedValue([])
    createBook.mockImplementation(async (input) => ({
      id: 'manual-book',
      createdAt: 1,
      updatedAt: 1,
      ...input,
    }))
  })

  it('creates a manual book from Chinese quick-add input', async () => {
    const user = userEvent.setup()
    render(
      <PreferencesProvider>
        <BooksCard />
      </PreferencesProvider>,
    )

    await user.type(screen.getByPlaceholderText('Title, author, or ISBN...'), '活着 / 余华')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))

    await waitFor(() => expect(createBook).toHaveBeenCalled())
    expect(createBook).toHaveBeenCalledWith(expect.objectContaining({
      source: 'manual',
      title: '活着',
      authors: ['余华'],
      status: 'want-to-read',
      progress: 0,
      subjects: [],
    }))
  })
})
