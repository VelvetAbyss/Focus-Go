import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  AtSign,
  Bold,
  CheckSquare,
  ChevronDown,
  Download,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Palette,
  Paperclip,
  Pilcrow,
  Table2,
  Underline as UnderlineIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ensureRichDoc, richDocToMarkdown } from '../model/richTextCodec'
import { createRichTextExtensions } from '../model/richTextExtensions'
import { extractHashTagsFromMarkdown, mergeTags } from '../model/tags'

type NoteEditorValue = {
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  tags: string[]
}

type NoteEditorProps = {
  value: NoteEditorValue
  appearance?: {
    theme?: 'paper' | 'graphite'
    font?: 'sans' | 'serif' | 'mono'
    fontSize?: number
    lineHeight?: number
    contentWidth?: number
    focusMode?: boolean
  }
  saveStateLabel: string
  onOpenInfo?: () => void
  onOpenAppearance?: () => void
  onExport?: () => void
  onChange: (next: NoteEditorValue) => void
  surfaceRef?: RefObject<HTMLDivElement | null>
}

const getWordCount = (markdown: string) => markdown.trim().split(/\s+/).filter(Boolean).length

const getReadTime = (words: number) => Math.max(1, Math.ceil(words / 180))

const fontFamilyMap = {
  sans: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace',
} as const

const ToolbarButton = ({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className={active ? 'note-editor__toolbar-button is-active' : 'note-editor__toolbar-button'}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
)

const ActionButton = ({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) => (
  <button type="button" className="note-editor__action-button" onClick={onClick}>
    {icon}
    <span>{label}</span>
  </button>
)

const NoteEditor = ({ value, appearance, saveStateLabel, onOpenInfo, onOpenAppearance, onExport, onChange, surfaceRef }: NoteEditorProps) => {
  const initialDoc = useMemo(() => ensureRichDoc(value.contentJson, value.contentMd), [value.contentJson, value.contentMd])
  const extensions = useMemo(() => createRichTextExtensions('Start writing...'), [])
  const wordCount = getWordCount(value.contentMd)
  const readTime = getReadTime(wordCount)
  const fontFamily = fontFamilyMap[appearance?.font ?? 'sans']
  const contentWidth = 560 + ((appearance?.contentWidth ?? 56) / 100) * 240
  const editorClassName = [
    'note-editor',
    appearance?.theme === 'graphite' ? 'note-editor--graphite' : '',
    appearance?.focusMode ? 'note-editor--focus' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const emitChange = (next: { title?: string; doc?: JSONContent | null }) => {
    const title = next.title ?? value.title
    const doc = next.doc ?? initialDoc
    const contentMd = richDocToMarkdown(doc)
    const tags = mergeTags(value.tags, extractHashTagsFromMarkdown(contentMd))

    onChange({
      title,
      contentMd,
      contentJson: doc as Record<string, unknown>,
      tags,
    })
  }

  const editor = useEditor({
    extensions,
    content: initialDoc,
    onUpdate: ({ editor }) => {
      emitChange({ doc: editor.getJSON() })
    },
    editorProps: {
      attributes: {
        class: 'note-editor__body',
      },
    },
  })

  const insertFallback = (content: string) => {
    editor?.chain().focus().insertContent(content).run()
  }

  const blockTypes = [
    { id: 'paragraph', label: 'Paragraph', icon: Pilcrow, run: () => editor?.chain().focus().setParagraph().run() },
    { id: 'h1', label: 'Heading 1', icon: Heading1, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: 'h2', label: 'Heading 2', icon: Heading2, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: 'h3', label: 'Heading 3', icon: Heading3, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: 'bullet', label: 'Bullet List', icon: List, run: () => editor?.chain().focus().toggleBulletList().run() },
    { id: 'ordered', label: 'Ordered List', icon: ListOrdered, run: () => editor?.chain().focus().toggleOrderedList().run() },
    {
      id: 'task',
      label: 'Task List',
      icon: CheckSquare,
      run: () => insertFallback('\n- [ ] Task\n'),
    },
  ] as const

  const currentBlock =
    (editor?.isActive('heading', { level: 1 }) && blockTypes[1]) ||
    (editor?.isActive('heading', { level: 2 }) && blockTypes[2]) ||
    (editor?.isActive('heading', { level: 3 }) && blockTypes[3]) ||
    (editor?.isActive('bulletList') && blockTypes[4]) ||
    (editor?.isActive('orderedList') && blockTypes[5]) ||
    blockTypes[0]

  return (
    <div className={editorClassName}>
      <div className="note-editor__topbar">
        <div className="note-editor__actions">
          <ActionButton icon={<Info size={14} />} label="Info" onClick={onOpenInfo} />
          <ActionButton icon={<Palette size={14} />} label="Appearance" onClick={onOpenAppearance} />
          <ActionButton icon={<Download size={14} />} label="Export" onClick={onExport} />
        </div>
      </div>

      <div ref={surfaceRef} className="note-editor__surface">
        <div className="note-editor__content">
          <Input
            value={value.title}
            onChange={(event) => emitChange({ title: event.target.value, doc: editor?.getJSON() ?? initialDoc })}
            placeholder="Untitled"
            className="note-editor__hero-title"
            aria-label="Note title"
            style={{ fontFamily, fontSize: `${Math.max(44, (appearance?.fontSize ?? 16) * 3.75)}px` }}
          />

          {value.tags.length ? (
            <div className="note-editor__tag-row">
              {value.tags.map((tag) => (
                <span key={tag} className="note-editor__tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <div style={{ maxWidth: `${contentWidth}px`, fontFamily }}>
            <EditorContent
              editor={editor}
              style={{
                fontSize: `${appearance?.fontSize ?? 16}px`,
                lineHeight: appearance?.lineHeight ?? 1.7,
              }}
            />
          </div>
        </div>
      </div>

      <div className="note-editor__footer">
        <div className="note-editor__toolbar" aria-label="Note formatting">
          <button type="button" className="note-editor__paragraph-button" onClick={currentBlock.run}>
            <currentBlock.icon size={14} />
            <span>{currentBlock.label}</span>
            <ChevronDown size={12} />
          </button>
          <span className="note-editor__toolbar-divider" aria-hidden="true" />
          <ToolbarButton active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={16} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('underline')} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFallback(' ==highlight== ')}>
            <Highlighter size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFallback('[Link title](https://example.com)')}>
            <Link2 size={16} />
          </ToolbarButton>
          <span className="note-editor__toolbar-divider" aria-hidden="true" />
          <ToolbarButton onClick={() => insertFallback('\n| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |\n')}>
            <Table2 size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFallback('\n![Image description]()\n')}>
            <Image size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFallback('\nAttachment: \n')}>
            <Paperclip size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFallback('@')}>
            <AtSign size={16} />
          </ToolbarButton>
        </div>

        <div className="note-editor__status-pill" title={saveStateLabel} aria-label={saveStateLabel}>
          <span>{wordCount} words</span>
          <span>{readTime} min read</span>
        </div>
      </div>
    </div>
  )
}

export default NoteEditor
