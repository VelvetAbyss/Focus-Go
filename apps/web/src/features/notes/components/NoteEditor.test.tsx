// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import NoteEditor from './NoteEditor'

vi.mock('../model/richTextCodec', () => ({
  ensureRichDoc: () => ({ type: 'doc', content: [] }),
  richDocToMarkdown: () => '',
}))

vi.mock('@tiptap/react', () => ({
  useEditor: () => ({
    getJSON: () => ({ type: 'doc', content: [] }),
    commands: { setContent: vi.fn() },
  }),
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
vi.mock('@tiptap/extension-text-align', () => ({ TextAlign: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-typography', () => ({ Typography: {} }))
vi.mock('@tiptap/extension-underline', () => ({ Underline: {} }))
vi.mock('@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension', () => ({ HorizontalRule: {} }))
vi.mock('@/components/tiptap-node/image-upload-node/image-upload-node-extension', () => ({ ImageUploadNode: { configure: () => ({}) } }))

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
  it('renders toolbar and action buttons in the same topbar', () => {
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
    const { container, rerender } = render(
      <NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 0, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />,
    )

    const content = container.querySelector('.note-editor__content') as HTMLElement
    expect(content.style.width).toBe('100%')
    expect(content.style.getPropertyValue('--note-editor-line-height')).toBe('1.7')

    rerender(<NoteEditor value={value} onChange={() => {}} appearance={{ contentWidth: 100, font: 'uiSans', fontSize: 16, lineHeight: 1.7 }} />)

    expect((container.querySelector('.note-editor__content') as HTMLElement).style.width).toBe('58%')
  })
})
