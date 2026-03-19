// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import NoteEditor from './NoteEditor'

const useEditorMock = vi.fn()
const setImageMock = vi.fn()
const focusMock = vi.fn()
const setTextSelectionMock = vi.fn()
const insertContentMock = vi.fn()
const runMock = vi.fn()
const editorConfigRef: { current: Record<string, unknown> | null } = { current: null }

vi.mock('../model/richTextCodec', () => ({
  ensureRichDoc: () => ({ type: 'doc', content: [] }),
  richDocToMarkdown: () => '',
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
  tags: [],
}

describe('NoteEditor', () => {
  const createEditor = () => ({
    getJSON: () => ({ type: 'doc', content: [] }),
    state: { selection: { to: 5 } },
    commands: { setContent: vi.fn() },
    chain: () => ({
      focus: focusMock.mockReturnThis(),
      setTextSelection: setTextSelectionMock.mockReturnThis(),
      insertContent: insertContentMock.mockReturnThis(),
      setImage: setImageMock.mockReturnThis(),
      run: runMock,
    }),
  })

  it('renders toolbar and action buttons in the same topbar', () => {
    useEditorMock.mockReturnValue(createEditor())
    const { container } = render(<NoteEditor value={value} onChange={() => {}} />)

    const topbar = container.querySelector('.note-editor__topbar')
    const toolbar = topbar?.querySelector('[role="toolbar"]')

    expect(topbar).toBeInTheDocument()
    expect(toolbar).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Info' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
  })

  it('uses full-width by default and shrinks with content width slider value', () => {
    useEditorMock.mockReturnValue(createEditor())
    const { container, rerender } = render(
      <NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 0, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />,
    )

    const content = container.querySelector('.note-editor__content') as HTMLElement
    expect(content.style.width).toBe('100%')
    expect(content.style.getPropertyValue('--note-editor-line-height')).toBe('1.7')

    rerender(<NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 100, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />)

    expect((container.querySelector('.note-editor__content') as HTMLElement).style.width).toBe('58%')
  })

  it('handles pasted image files by inserting data-url images', async () => {
    useEditorMock.mockReturnValue(createEditor())

    class MockFileReader {
      result: string | ArrayBuffer | null = null
      onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null
      onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null

      readAsDataURL(file: Blob) {
        this.result = `data:${file.type};base64,${file.size}`
        this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>)
      }
    }

    vi.stubGlobal('FileReader', MockFileReader)

    render(<NoteEditor value={value} onChange={() => {}} />)

    const handlePaste = editorConfigRef.current?.editorProps as { handlePaste?: (...args: unknown[]) => unknown }
    const preventDefault = vi.fn()
    const event = {
      clipboardData: {
        items: [
          {
            type: 'image/png',
            getAsFile: () => new File(['one'], 'one.png', { type: 'image/png' }),
          },
          {
            type: 'image/jpeg',
            getAsFile: () => new File(['two'], 'two.jpg', { type: 'image/jpeg' }),
          },
        ],
      },
      preventDefault,
    }

    const handled = handlePaste.handlePaste?.({}, event, undefined)

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(focusMock).toHaveBeenCalledTimes(2))
    expect(setImageMock).toHaveBeenNthCalledWith(1, { src: 'data:image/png;base64,3' })
    expect(setImageMock).toHaveBeenNthCalledWith(2, { src: 'data:image/jpeg;base64,3' })
    expect(runMock).toHaveBeenCalledTimes(2)
  })

  it('handles pasted table text by inserting a table node at cursor', () => {
    useEditorMock.mockReturnValue(createEditor())
    render(<NoteEditor value={value} onChange={() => {}} />)

    const handlePaste = editorConfigRef.current?.editorProps as { handlePaste?: (...args: unknown[]) => unknown }
    const preventDefault = vi.fn()
    const event = {
      clipboardData: {
        items: [],
        getData: (type: string) => {
          if (type === 'text/html') return ''
          if (type === 'text/plain') return 'a\tb\n1'
          return ''
        },
      },
      preventDefault,
    }

    const handled = handlePaste.handlePaste?.({}, event, undefined)

    expect(handled).toBe(true)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(setTextSelectionMock).toHaveBeenCalledWith(5)
    expect(insertContentMock).toHaveBeenCalledWith({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }] },
          ],
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
            { type: 'tableCell', content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    })
  })
})
