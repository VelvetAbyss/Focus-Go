// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MediaCard from './MediaCard'
import { PreferencesProvider } from '../../../shared/prefs/PreferencesProvider'

const { listMedia, createMedia } = vi.hoisted(() => ({
  listMedia: vi.fn(),
  createMedia: vi.fn(),
}))

vi.mock('../../../data/repositories/mediaRepo', () => ({
  mediaRepo: {
    list: listMedia,
    create: createMedia,
    update: vi.fn(),
    remove: vi.fn(),
  },
}))

describe('MediaCard', () => {
  beforeEach(() => {
    listMedia.mockResolvedValue([])
    createMedia.mockImplementation(async (input) => ({
      id: 'manual-media',
      createdAt: 1,
      updatedAt: 1,
      ...input,
    }))
  })

  it('creates manual TV media from Chinese quick-add input', async () => {
    const user = userEvent.setup()
    render(
      <PreferencesProvider>
        <MediaCard />
      </PreferencesProvider>,
    )

    await user.click(screen.getByRole('button', { name: /^TV$/i }))
    await user.type(screen.getByPlaceholderText('Movie, series, director...'), '繁花')
    await user.click(screen.getByRole('button', { name: /^Add$/i }))

    await waitFor(() => expect(createMedia).toHaveBeenCalled())
    expect(createMedia).toHaveBeenCalledWith(expect.objectContaining({
      source: 'manual',
      title: '繁花',
      mediaType: 'tv',
      status: 'want-to-watch',
      progress: 0,
      cast: [],
      genres: [],
    }))
  })
})
