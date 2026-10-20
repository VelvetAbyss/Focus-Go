// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NoteEditor from './NoteEditor'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

vi.mock('../../../shared/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key, language: 'en' as const }),
}))

const useEditorMock = vi.fn()
const setImageMock = vi.fn()
const focusMock = vi.fn()
const setTextSelectionMock = vi.fn()
const insertContentMock = vi.fn()
const runMock = vi.fn()
const editorConfigRef: { current: Record<string, unknown> | null } = { current: null }

vi.mock('../model/richTextCodec', () => ({
  ensureRichDoc: (json: unknown) => json ?? ({ type: 'doc', content: [] }),
  richDocToMarkdown: () => '',
}))

vi.mock('./NoteSelectionMenu', () => ({ NoteSelectionMenu: () => null, NoteLinkPopover: () => <button type="button">link</button>, NoteMarkButton: () => <button type="button">mark</button> }))
vi.mock('./NoteTextColorMenu', () => ({ NoteTextColorMenu: () => <button type="button">Text color</button> }))
vi.mock('./NoteBlockTools', () => ({ NoteBlockTools: () => null }))
vi.mock('./NoteFormattingMenus', () => ({
  NoteHeadingDropdownMenu: () => <button type="button">heading</button>,
  NoteListDropdownMenu: () => <button type="button">list</button>,
  NoteHighlightMenu: () => <button type="button">highlight</button>,
}))

vi.mock('@tiptap/react', () => ({
  useEditor: (config: Record<string, unknown>) => {
    editorConfigRef.current = config
    return useEditorMock(config)
  },
  EditorContent: ({ className }: { className?: string }) => <div data-testid="editor-content" className={className} />,
  EditorContext: {
    Provider: ({ children }: { children: ReactNode }) => <>{children}</>,
  },
}))

vi.mock('@tiptap/starter-kit', () => {
  const starterKit = { configure: () => ({}) }
  return { default: starterKit, StarterKit: starterKit }
})
vi.mock('@tiptap/extension-placeholder', () => ({ Placeholder: { configure: () => ({}) } }))
vi.mock('@tiptap/extensions', () => ({ Selection: {} }))
vi.mock('@tiptap/extension-highlight', () => ({ Highlight: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-image', () => ({ Image: {} }))
vi.mock('@tiptap/extension-list', () => ({ TaskList: {}, TaskItem: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-subscript', () => ({ Subscript: {} }))
vi.mock('@tiptap/extension-superscript', () => ({ Superscript: {} }))
vi.mock('@tiptap/extension-table', () => ({ Table: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-table-cell', () => ({ default: {} }))
vi.mock('@tiptap/extension-table-header', () => ({ default: {} }))
vi.mock('@tiptap/extension-table-row', () => ({ default: {} }))
vi.mock('@tiptap/extension-text-align', () => ({ TextAlign: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-typography', () => ({ Typography: {} }))
vi.mock('@tiptap/extension-underline', () => ({ Underline: {} }))
vi.mock('@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension', () => ({ HorizontalRule: {} }))
vi.mock('@/components/tiptap-node/image-upload-node/image-upload-node-extension', () => ({ ImageUploadNode: { configure: () => ({}) } }))
vi.mock('../model/resizableImage', () => ({ ResizableImage: {} }))

vi.mock('@/components/tiptap-ui/blockquote-button', () => ({ BlockquoteButton: () => <button type="button">blockquote</button> }))
vi.mock('@/components/tiptap-ui/code-block-button', () => ({ CodeBlockButton: () => <button type="button">code</button> }))
vi.mock('@/components/tiptap-ui/color-highlight-popover', () => ({ ColorHighlightPopover: () => <button type="button">highlight</button> }))
vi.mock('@/components/tiptap-ui/heading-dropdown-menu', () => ({ HeadingDropdownMenu: () => <button type="button">heading</button> }))
vi.mock('@/components/tiptap-ui/image-upload-button', () => ({ ImageUploadButton: ({ text }: { text: string }) => <button type="button">{text}</button> }))
vi.mock('@/components/tiptap-ui/link-popover', () => ({ LinkPopover: () => <button type="button">link</button> }))
vi.mock('@/components/tiptap-ui/list-dropdown-menu', () => ({ ListDropdownMenu: () => <button type="button">list</button> }))
vi.mock('@/components/tiptap-ui/mark-button', () => ({ MarkButton: () => <button type="button">mark</button> }))
vi.mock('@/components/tiptap-ui/text-align-button', () => ({ TextAlignButton: () => <button type="button">align</button> }))
vi.mock('@/components/tiptap-ui/undo-redo-button', () => ({ UndoRedoButton: () => <button type="button">undo-redo</button> }))

const value = {
  title: 'Untitled',
  contentMd: '',
  contentJson: null,
  editorMode: 'document' as const,
  tags: [],
}

describe('NoteEditor', () => {
  const createEditor = () => ({
    getJSON: () => ({ type: 'doc', content: [] }),
    state: { selection: { to: 5 } },
    commands: { setContent: vi.fn() },
    view: { dom: document.createElement('div'), composing: false },
    isFocused: false,
    on: vi.fn(),
    off: vi.fn(),
    chain: () => ({
      focus: focusMock.mockReturnThis(),
      setTextSelection: setTextSelectionMock.mockReturnThis(),
      insertContent: insertContentMock.mockReturnThis(),
      setImage: setImageMock.mockReturnThis(),
      run: runMock,
    }),
  })

  it('defers an external snapshot while focused and applies it after blur', async () => {
    const editor = createEditor()
    editor.isFocused = true
    useEditorMock.mockReturnValue(editor)
    const { rerender } = render(<NoteEditor value={value} onChange={() => {}} />)
    const remote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Remote update' }] }] }
    rerender(<NoteEditor value={{ ...value, contentJson: remote }} onChange={() => {}} />)
    expect(editor.commands.setContent).not.toHaveBeenCalled()
    editor.isFocused = false
    const blur = editor.on.mock.calls.find(([event]) => event === 'blur')?.[1] as () => void
    act(() => blur())
    await waitFor(() => expect(editor.commands.setContent).toHaveBeenCalledWith(remote, { emitUpdate: false }))
  })

  it('does not apply a stale external snapshot over buffered local typing', async () => {
    const editor = createEditor()
    editor.isFocused = true
    useEditorMock.mockReturnValue(editor)
    const onChange = vi.fn()
    const { rerender } = render(<NoteEditor value={value} onChange={onChange} />)
    const local = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Unflushed local text' }] }] }
    const update = editorConfigRef.current?.onUpdate as (args: { editor: { getJSON: () => unknown } }) => void
    act(() => update({ editor: { getJSON: () => local } }))
    const remote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Older remote text' }] }] }
    rerender(<NoteEditor value={{ ...value, contentJson: remote }} onChange={onChange} />)
    editor.isFocused = false
    const blur = editor.on.mock.calls.find(([event]) => event === 'blur')?.[1] as () => void
    act(() => blur())
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls.at(-1)?.[0].contentJson).toEqual(local)
    expect(editor.commands.setContent).not.toHaveBeenCalled()
  })

  it('waits until composition ends before reconciling a blurred editor', async () => {
    const editor = createEditor()
    editor.view.composing = true
    useEditorMock.mockReturnValue(editor)
    const { rerender } = render(<NoteEditor value={value} onChange={() => {}} />)
    const remote = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '远端更新' }] }] }
    rerender(<NoteEditor value={{ ...value, contentJson: remote }} onChange={() => {}} />)
    expect(editor.commands.setContent).not.toHaveBeenCalled()
    editor.view.composing = false
    act(() => editor.view.dom.dispatchEvent(new CompositionEvent('compositionend')))
    await waitFor(() => expect(editor.commands.setContent).toHaveBeenCalledWith(remote, { emitUpdate: false }))
  })

  it('renders toolbar and action buttons in the same topbar', () => {
    useEditorMock.mockReturnValue(createEditor())
    const { container } = render(<NoteEditor value={value} onChange={() => {}} />)

    const topbar = container.querySelector('.note-editor__topbar')
    const toolbar = topbar?.querySelector('[role="toolbar"]')

    expect(topbar).toBeInTheDocument()
    expect(toolbar).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.info' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.appearance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.import' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'notes.export' })).toBeInTheDocument()
  })

  it('bounds reading measure while preserving appearance settings', () => {
    useEditorMock.mockReturnValue(createEditor())
    const { container, rerender } = render(
      <NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 0, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />,
    )

    const content = container.querySelector('.note-editor__content') as HTMLElement
    expect(content.style.getPropertyValue('--note-content-measure')).toBe('64rem')
    expect(content.style.getPropertyValue('--note-editor-font-size')).toBe('1rem')
    expect(content.style.getPropertyValue('--note-editor-line-height')).toBe('1.7')

    rerender(<NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 100, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />)

    expect((container.querySelector('.note-editor__content') as HTMLElement).style.getPropertyValue('--note-content-measure')).toBe('34rem')
  })

  it('does not reapply external content when the incoming doc matches editor state', () => {
    const editor = createEditor()
    useEditorMock.mockReturnValue(editor)

    const { rerender } = render(<NoteEditor value={value} onChange={() => {}} />)

    rerender(
      <NoteEditor
        value={{
          ...value,
          contentJson: { type: 'doc', content: [] },
        }}
        onChange={() => {}}
      />,
    )

    expect(editor.commands.setContent).not.toHaveBeenCalled()
  })
})
