// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MediaCardSurface } from './MediaCardSurface'
import { buildMediaPresentationModel } from '../cards/lifeDesignAdapters'
import type { MediaItem } from '../../../data/models/types'

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
  it('keeps the sidebar title truncatable while the detail pane shows the full title', () => {
    render(
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
      />,
    )

    const sidebarTitle = screen.getAllByText(longTitle).find((node) => node.tagName === 'P')
    const detailTitle = screen.getAllByText(longTitle).find((node) => node.tagName === 'H3')

    expect(sidebarTitle).toHaveStyle({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 0%', minWidth: '0' })
    expect(detailTitle).toHaveTextContent(longTitle)
  })
})
