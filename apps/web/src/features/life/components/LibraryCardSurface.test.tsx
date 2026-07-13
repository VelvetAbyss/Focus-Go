// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LibraryCardSurface } from './LibraryCardSurface'
import { buildLibraryPresentationModel } from '../cards/lifeDesignAdapters'
import type { BookItem } from '../../../data/models/types'
import { PreferencesProvider } from '../../../shared/prefs/PreferencesProvider'

const item: BookItem = {
  id: 'book-1',
  createdAt: 1,
  updatedAt: 1,
  source: 'open-library',
  sourceId: 'OL1M',
  title: 'The Creative Act',
  authors: ['Rick Rubin'],
  status: 'reading',
  progress: 42,
  subjects: [],
  lastSyncedAt: 1,
}

describe('LibraryCardSurface', () => {
  it('renders a loading shell instead of the empty state while data is loading', () => {
    render(
      <PreferencesProvider>
        <LibraryCardSurface
          model={buildLibraryPresentationModel([])}
          books={[]}
          selectedBook={null}
          selectedBookId={null}
          open={false}
          loading
          query=""
          searching={false}
          error={null}
          results={[]}
          addingCandidateId={null}
          onOpen={() => {}}
          onClose={() => {}}
          onQueryChange={() => {}}
          onSearch={() => {}}
          onQuickAdd={() => {}}
          onSelectBook={() => {}}
          onAddBook={() => {}}
          onPatchBook={() => {}}
          onRemoveBook={() => {}}
          onClearResults={() => {}}
        />
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('life-card-loader')).toBeInTheDocument()
    expect(screen.queryByText('Your shelf is empty')).not.toBeInTheDocument()
  })

  it('renders preview content when books are ready', () => {
    render(
      <PreferencesProvider>
        <LibraryCardSurface
          model={buildLibraryPresentationModel([item])}
          books={[item]}
          selectedBook={item}
          selectedBookId={item.id}
          open={false}
          loading={false}
          query=""
          searching={false}
          error={null}
          results={[]}
          addingCandidateId={null}
          onOpen={() => {}}
          onClose={() => {}}
          onQueryChange={() => {}}
          onSearch={() => {}}
          onQuickAdd={() => {}}
          onSelectBook={() => {}}
          onAddBook={() => {}}
          onPatchBook={() => {}}
          onRemoveBook={() => {}}
          onClearResults={() => {}}
        />
      </PreferencesProvider>,
    )

    expect(screen.getByText('The Creative Act')).toBeInTheDocument()
  })

  it('submits the quick-add form from the card surface', async () => {
    const user = userEvent.setup()
    const onQuickAdd = vi.fn()

    render(
      <PreferencesProvider>
        <LibraryCardSurface
          model={buildLibraryPresentationModel([])}
          books={[]}
          selectedBook={null}
          selectedBookId={null}
          open={false}
          loading={false}
          query="creative"
          searching={false}
          error={null}
          results={[{ id: 'open-library-OL1M', title: 'The Creative Act', authors: ['Rick Rubin'] }]}
          addingCandidateId={null}
          onOpen={() => {}}
          onClose={() => {}}
          onQueryChange={() => {}}
          onSearch={() => {}}
          onQuickAdd={onQuickAdd}
          onSelectBook={() => {}}
          onAddBook={() => {}}
          onPatchBook={() => {}}
          onRemoveBook={() => {}}
          onClearResults={() => {}}
        />
      </PreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: /^Add$/i }))

    expect(onQuickAdd).toHaveBeenCalledTimes(1)
  })
})
