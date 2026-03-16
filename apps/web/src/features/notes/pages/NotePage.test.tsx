// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteAppearanceSettings, NoteItem, NoteTag } from '../../../data/models/types'
import NotePage from './NotePage'

const listMock = vi.fn<() => Promise<NoteItem[]>>()
const listTrashMock = vi.fn<() => Promise<NoteItem[]>>()
const createMock = vi.fn<(data?: unknown) => Promise<NoteItem>>()
const updateMock = vi.fn<(id: string, patch: unknown) => Promise<NoteItem | undefined>>()
const softDeleteMock = vi.fn<(id: string) => Promise<NoteItem | undefined>>()
const restoreMock = vi.fn<(id: string) => Promise<NoteItem | undefined>>()
const hardDeleteMock = vi.fn<(id: string) => Promise<void>>()
const listTagsMock = vi.fn<() => Promise<NoteTag[]>>()
const createTagMock = vi.fn<(data: unknown) => Promise<NoteTag>>()
const updateTagMock = vi.fn<(id: string, patch: unknown) => Promise<NoteTag | undefined>>()
const appearanceGetMock = vi.fn<() => Promise<NoteAppearanceSettings | null>>()
const appearanceUpsertMock = vi.fn<(patch: unknown) => Promise<NoteAppearanceSettings>>()

vi.mock('../../../data/repositories/notesRepo', () => ({
  notesRepo: {
    list: () => listMock(),
    listTrash: () => listTrashMock(),
    create: (data?: unknown) => createMock(data),
    update: (id: string, patch: unknown) => updateMock(id, patch),
    softDelete: (id: string) => softDeleteMock(id),
    restore: (id: string) => restoreMock(id),
    hardDelete: (id: string) => hardDeleteMock(id),
  },
}))

vi.mock('../../../data/repositories/noteTagsRepo', () => ({
  noteTagsRepo: {
    list: () => listTagsMock(),
    create: (data: unknown) => createTagMock(data),
    update: (id: string, patch: unknown) => updateTagMock(id, patch),
    remove: vi.fn(),
  },
}))

vi.mock('../../../data/repositories/noteAppearanceRepo', () => ({
  noteAppearanceRepo: {
    get: () => appearanceGetMock(),
    upsert: (patch: unknown) => appearanceUpsertMock(patch),
  },
}))

vi.mock('../components/NoteEditor', () => ({
  default: ({
    value,
    onOpenInfo,
    onOpenAppearance,
    onExport,
    onChange,
  }: {
    value: { title: string; contentMd: string; tags: string[] }
    onOpenInfo?: () => void
    onOpenAppearance?: () => void
    onExport?: () => void
    onChange: (value: { title: string; contentMd: string; tags: string[]; contentJson?: Record<string, unknown> | null }) => void
  }) => (
    <div data-testid="note-editor">
      <div>Editor:{value.title || 'Untitled'}</div>
      <button type="button" onClick={onOpenInfo}>
        Open info
      </button>
      <button type="button" onClick={onOpenAppearance}>
        Open appearance
      </button>
      <button type="button" onClick={onExport}>
        Export markdown
      </button>
      <button
        type="button"
        onClick={() =>
          onChange({
            title: 'Updated title',
            contentMd: '# Heading\n\nBody copy',
            contentJson: null,
            tags: ['Research'],
          })
        }
      >
        Change note
      </button>
    </div>
  ),
}))

const createNote = (overrides: Partial<NoteItem> = {}): NoteItem => ({
  id: overrides.id ?? 'note-1',
  createdAt: overrides.createdAt ?? Date.now() - 1000,
  updatedAt: overrides.updatedAt ?? Date.now(),
  title: overrides.title ?? '',
  contentMd: overrides.contentMd ?? '',
  contentJson: overrides.contentJson ?? null,
  collection: overrides.collection ?? 'all-notes',
  tags: overrides.tags ?? [],
  excerpt: overrides.excerpt ?? '',
  pinned: overrides.pinned ?? false,
  wordCount: overrides.wordCount ?? 0,
  charCount: overrides.charCount ?? 0,
  paragraphCount: overrides.paragraphCount ?? 0,
  imageCount: overrides.imageCount ?? 0,
  fileCount: overrides.fileCount ?? 0,
  headings: overrides.headings ?? [],
  backlinks: overrides.backlinks ?? [],
  deletedAt: overrides.deletedAt ?? null,
})

const createTag = (overrides: Partial<NoteTag> = {}): NoteTag => ({
  id: overrides.id ?? 'tag-1',
  createdAt: overrides.createdAt ?? 1,
  updatedAt: overrides.updatedAt ?? 1,
  name: overrides.name ?? 'Research',
  icon: overrides.icon,
  pinned: overrides.pinned ?? false,
  parentId: overrides.parentId ?? null,
  noteCount: overrides.noteCount ?? 1,
  sortOrder: overrides.sortOrder ?? 1,
})

const appearance: NoteAppearanceSettings = {
  id: 'note_appearance',
  createdAt: 1,
  updatedAt: 1,
  theme: 'paper',
  font: 'sans',
  fontSize: 16,
  lineHeight: 1.7,
  contentWidth: 56,
  focusMode: false,
}

describe('NotePage', () => {
  const createObjectURLMock = vi.fn(() => 'blob:note')
  const revokeObjectURLMock = vi.fn()
  const anchorClickMock = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    listTagsMock.mockResolvedValue([createTag({ name: 'Research', pinned: true })])
    appearanceGetMock.mockResolvedValue(appearance)
    appearanceUpsertMock.mockResolvedValue(appearance)
    vi.stubGlobal('URL', {
      createObjectURL: createObjectURLMock,
      revokeObjectURL: revokeObjectURLMock,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(anchorClickMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('auto creates a blank note when the workspace is empty', async () => {
    const created = createNote()
    listMock.mockResolvedValueOnce([])
    listTrashMock.mockResolvedValue([])
    createMock.mockResolvedValue(created)

    render(<NotePage />)

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Editor:Untitled')).toBeInTheDocument()
  })

  it('opens the info popover and shows statistics', async () => {
    listMock.mockResolvedValue([
      createNote({ title: 'Design doc', wordCount: 22, charCount: 120, paragraphCount: 2, headings: [{ level: 1, text: 'Heading', id: 'heading' }] }),
    ])
    listTrashMock.mockResolvedValue([])

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open info' }))

    expect(await screen.findByText('Statistics')).toBeInTheDocument()
    expect(screen.getByText('Words')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('exports the active note as markdown', async () => {
    listMock.mockResolvedValue([createNote({ title: 'Design doc', contentMd: '# Hello world' })])
    listTrashMock.mockResolvedValue([])

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Export markdown' }))
    await userEvent.click((await screen.findAllByRole('button', { name: /Markdown/i }))[1]!)

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(anchorClickMock).toHaveBeenCalledTimes(1)
  })

  it('opens appearance controls and persists settings', async () => {
    listMock.mockResolvedValue([createNote({ title: 'Design doc' })])
    listTrashMock.mockResolvedValue([])
    appearanceUpsertMock.mockResolvedValue({ ...appearance, theme: 'graphite' })

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open appearance' }))
    await userEvent.click(screen.getByRole('button', { name: 'Graphite' }))

    await waitFor(() => expect(appearanceUpsertMock).toHaveBeenCalled())
  })

  it('filters by selected tag from the sidebar tree', async () => {
    listMock.mockResolvedValue([
      createNote({ id: 'a', title: 'Research note', tags: ['Research'] }),
      createNote({ id: 'b', title: 'Personal note', tags: ['Personal'] }),
    ])
    listTrashMock.mockResolvedValue([])
    listTagsMock.mockResolvedValue([createTag({ id: 'research', name: 'Research' }), createTag({ id: 'personal', name: 'Personal', sortOrder: 2 })])

    render(<NotePage />)

    expect(await screen.findByText('Research note')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Research' }))

    await waitFor(() => expect(screen.queryByText('Personal note')).not.toBeInTheDocument())
    expect(screen.getByText('Research note')).toBeInTheDocument()
  })

  it('schedules saves when the editor changes', async () => {
    const note = createNote({ id: 'save-1', title: 'Draft' })
    listMock.mockResolvedValue([note])
    listTrashMock.mockResolvedValue([])
    updateMock.mockResolvedValue(createNote({ ...note, title: 'Updated title', contentMd: '# Heading\n\nBody copy', tags: ['Research'], excerpt: '# Heading Body copy' }))

    render(<NotePage />)

    expect(await screen.findByText('Editor:Draft')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Change note' }))

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith('save-1', expect.objectContaining({ title: 'Updated title' })))
  })
})
