// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MediaCardSurface } from './MediaCardSurface'
import { buildMediaPresentationModel } from '../cards/lifeDesignAdapters'
import type { MediaItem } from '../../../data/models/types'
import { PreferencesProvider } from '../../../shared/prefs/PreferencesProvider'

vi.mock('../../../shared/ui/Dialog', () => ({
  default: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
}))

const longTitle = 'The Lord of the Rings: The Fellowship of the Ring Extended Edition'

const item: MediaItem = {
  id: 'media-1',
  createdAt: 1,
  updatedAt: 1,
  source: 'tmdb',
  sourceId: '120',
  tmdbId: 120,
  mediaType: 'movie',
  title: longTitle,
  status: 'completed',
  progress: 100,
  releaseDate: '2001-12-19',
  genres: ['Adventure'],
  cast: [],
}

describe('MediaCardSurface', () => {
  it('renders a loading shell instead of the empty state while data is loading', () => {
    render(
      <PreferencesProvider>
        <MediaCardSurface
          model={buildMediaPresentationModel([])}
          items={[]}
          selected={null}
          selectedId={null}
          open={false}
          loading
          query=""
          searching={false}
          hint={null}
          results={[]}
          addingCandidateId={null}
          onOpen={() => {}}
          onClose={() => {}}
          onQueryChange={() => {}}
          onSearch={() => {}}
          onDismissSearch={() => {}}
          onSelectItem={() => {}}
          onAddItem={() => {}}
          onPatchItem={() => {}}
          onRemoveItem={() => {}}
        />
      </PreferencesProvider>,
    )

    expect(screen.getByTestId('life-card-loader')).toBeInTheDocument()
    expect(screen.queryByText('Your watchlist is empty')).not.toBeInTheDocument()
  })

  it('keeps the sidebar title truncatable while the detail pane shows the full title', () => {
    render(
      <PreferencesProvider>
        <MediaCardSurface
          model={buildMediaPresentationModel([item])}
          items={[item]}
          selected={item}
          selectedId={item.id}
          open
          loading={false}
          query=""
          searching={false}
          hint={null}
          results={[]}
          addingCandidateId={null}
          onOpen={() => {}}
          onClose={() => {}}
          onQueryChange={() => {}}
          onSearch={() => {}}
          onDismissSearch={() => {}}
          onSelectItem={() => {}}
          onAddItem={() => {}}
          onPatchItem={() => {}}
          onRemoveItem={() => {}}
        />
      </PreferencesProvider>,
    )

    const sidebarTitle = screen.getAllByText(longTitle).find((node) => node.tagName === 'P' && node.textContent === longTitle)
    const detailTitle = screen.getAllByText(longTitle).find((node) => node.tagName === 'H3')

    expect(sidebarTitle).toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' })
    expect(detailTitle).toHaveTextContent(longTitle)
  })
})
