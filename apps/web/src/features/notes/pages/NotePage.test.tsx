// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NoteAppearanceSettings, NoteItem, NoteTag } from '../../../data/models/types'
import NotePage from './NotePage'

const mockUseLabs = vi.fn()

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key, language: 'en' as const }),
}))

vi.mock('../../labs/LabsContext', () => ({
  useLabs: () => mockUseLabs(),
}))

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
    isFullscreen,
    onToggleFullscreen,
    onOpenInfo,
    onOpenAppearance,
    onExport,
    onChange,
  }: {
    value: { title: string; contentMd: string; tags: string[]; editorMode: 'document' }
    isFullscreen?: boolean
    onToggleFullscreen?: () => void
    onOpenInfo?: () => void
    onOpenAppearance?: () => void
    onExport?: () => void
    onChange: (value: {
      title: string
      contentMd: string
      tags: string[]
      contentJson?: Record<string, unknown> | null
      editorMode: 'document'
    }) => void
  }) => (
    <div data-testid="note-editor">
      <div>Editor:{value.title || 'Untitled'}</div>
      <div>Mode:{value.editorMode}</div>
      <div>Fullscreen:{isFullscreen ? 'on' : 'off'}</div>
      <button type="button" onClick={onToggleFullscreen}>
        Toggle fullscreen
      </button>
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
            editorMode: 'document',
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
  editorMode: overrides.editorMode ?? 'document',
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
  font: 'uiSans',
  fontSize: 16,
  lineHeight: 1.7,
  contentWidth: 0,
  focusMode: false,
}

describe('NotePage', () => {
  const createObjectURLMock = vi.fn(() => 'blob:note')
  const revokeObjectURLMock = vi.fn()
  const anchorClickMock = vi.fn()

  beforeEach(() => {
    vi.resetAllMocks()
    mockUseLabs.mockReturnValue({
      subscription: { tier: 'free' as const, role: 'member' as const },
    })
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

  it('does not auto create a blank note when the workspace is empty', async () => {
    listMock.mockResolvedValueOnce([])
    listTrashMock.mockResolvedValue([])

    render(<NotePage />)

    await waitFor(() => expect(createMock).not.toHaveBeenCalled())
    expect(await screen.findByText('Editor:Untitled')).toBeInTheDocument()
  })

  it('auto creates the first note when user starts typing in an empty workspace', async () => {
    const created = createNote({ id: 'created-1', title: 'Updated title', contentMd: '# Heading\n\nBody copy', tags: ['Research'] })
    listMock.mockResolvedValueOnce([])
    listTrashMock.mockResolvedValue([])
    createMock.mockResolvedValue(created)

    render(<NotePage />)

    await userEvent.click(screen.getByRole('button', { name: 'Change note' }))
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Editor:Updated title')).toBeInTheDocument()
  })

  it('opens the info popover and shows statistics', async () => {
    listMock.mockResolvedValue([
      createNote({
        title: 'Design doc',
        contentMd:
          'one two three four five six seven eight nine ten eleven\n\n' +
          'twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo',
        headings: [{ level: 1, text: 'Heading', id: 'heading' }],
      }),
    ])
    listTrashMock.mockResolvedValue([])

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open info' }))

    expect(await screen.findByText('Statistics')).toBeInTheDocument()
    expect(screen.getByText('Words')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('toggles note fullscreen mode and exits on escape', async () => {
    listMock.mockResolvedValue([createNote({ title: 'Design doc' })])
    listTrashMock.mockResolvedValue([])

    const { container } = render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    expect(screen.getByText('Fullscreen:off')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Toggle fullscreen' }))

    expect(screen.getByText('Fullscreen:on')).toBeInTheDocument()
    expect(container.querySelector('.note-page')?.getAttribute('data-fullscreen')).toBe('true')

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.getByText('Fullscreen:off')).toBeInTheDocument())
    expect(container.querySelector('.note-page')?.getAttribute('data-fullscreen')).toBe('false')
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
    appearanceUpsertMock.mockResolvedValue({ ...appearance, fontSize: 17 })

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open appearance' }))
    const fontSizeSlider = screen.getAllByRole('slider')[0]
    fireEvent.change(fontSizeSlider, { target: { value: '17' } })

    await waitFor(() => expect(appearanceUpsertMock).toHaveBeenCalled())
    expect(appearanceUpsertMock.mock.calls.some((entry) => (entry[0] as { fontSize?: number })?.fontSize !== undefined)).toBe(true)
  })

  it('persists font and line-height changes from appearance modal', async () => {
    listMock.mockResolvedValue([createNote({ title: 'Design doc' })])
    listTrashMock.mockResolvedValue([])
    appearanceUpsertMock.mockResolvedValue({ ...appearance, font: 'cnSans', lineHeight: 2 })

    render(<NotePage />)

    expect(await screen.findByText('Editor:Design doc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Open appearance' }))
    await userEvent.click(screen.getByRole('button', { name: 'CN Sans' }))

    await waitFor(() =>
      expect(appearanceUpsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note_appearance',
        }),
      ),
    )
    expect(appearanceUpsertMock.mock.calls.some((entry) => (entry[0] as { font?: string })?.font === 'cnSans')).toBe(true)
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

  it('renders trash notes in editor layout and supports permanent delete from list', async () => {
    const note = createNote({ id: 'trash-1', title: 'Trash me' })
    const trashed = createNote({ ...note, deletedAt: Date.now() })
    listMock.mockResolvedValue([note])
    listTrashMock.mockResolvedValue([])
    softDeleteMock.mockResolvedValue(trashed)

    render(<NotePage />)

    expect(await screen.findByText('Trash me')).toBeInTheDocument()
    await userEvent.click((await screen.findAllByTitle('Move to trash'))[0]!)
    await waitFor(() => expect(softDeleteMock).toHaveBeenCalledWith('trash-1'))

    await userEvent.click(screen.getByRole('button', { name: /Trash/i }))
    await userEvent.click((await screen.findAllByTitle('Delete permanently'))[0]!)
    await waitFor(() => expect(hardDeleteMock).toHaveBeenCalledWith('trash-1'))
  })
})
