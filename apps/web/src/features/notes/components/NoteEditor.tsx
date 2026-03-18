import type { JSONContent } from '@tiptap/core'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Selection } from '@tiptap/extensions'
import { Highlight } from '@tiptap/extension-highlight'
import { Image } from '@tiptap/extension-image'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { Download, Info, Palette } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useMemo } from 'react'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss'
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/image-node/image-node.scss'
import '@/components/tiptap-node/heading-node/heading-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import { ColorHighlightPopover } from '@/components/tiptap-ui/color-highlight-popover'
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ImageUploadButton } from '@/components/tiptap-ui/image-upload-button'
import { LinkPopover } from '@/components/tiptap-ui/link-popover'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { TextAlignButton } from '@/components/tiptap-ui/text-align-button'
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button'
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/tiptap-ui-primitive/toolbar'
import { MAX_FILE_SIZE } from '@/lib/tiptap-utils'
import type { NoteFontFamily } from '../../../data/models/types'
import { ensureRichDoc, richDocToMarkdown } from '../model/richTextCodec'
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
    font?: NoteFontFamily
    fontSize?: number
    lineHeight?: number
    contentWidth?: number
    focusMode?: boolean
  }
  onOpenInfo?: () => void
  onOpenAppearance?: () => void
  onExport?: () => void
  onChange: (next: NoteEditorValue) => void
  surfaceRef?: RefObject<HTMLDivElement | null>
}

const extractTitleFromMarkdown = (markdown: string) => {
  const lines = markdown.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

const fontFamilyMap = {
  uiSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
  humanistSans: '"Avenir Next", "Nunito", "Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif',
  cnSans: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
  cnSerif: '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif',
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace',
} as const

const ActionButton = ({ icon, label, onClick, panelId }: { icon: ReactNode; label: string; onClick?: () => void; panelId: 'info' | 'appearance' | 'export' }) => (
  <button type="button" className="note-editor__action-button" onClick={onClick} data-note-panel-trigger={panelId}>
    {icon}
    <span>{label}</span>
  </button>
)

const uploadImageAsDataUrl = async (file: File): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed (${MAX_FILE_SIZE / (1024 * 1024)}MB)`)
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

const NoteEditor = ({ value, appearance, onOpenInfo, onOpenAppearance, onExport, onChange, surfaceRef }: NoteEditorProps) => {
  const initialDoc = useMemo(() => ensureRichDoc(value.contentJson, value.contentMd), [value.contentJson, value.contentMd])
  const fontFamily = fontFamilyMap[appearance?.font ?? 'uiSans']
  const widthScale = Math.max(0, Math.min(100, appearance?.contentWidth ?? 0)) / 100
  const contentWidthPercent = 100 - widthScale * 42

  const emitChange = (doc: JSONContent | null | undefined) => {
    const contentMd = richDocToMarkdown(doc)
    const tags = mergeTags(value.tags, extractHashTagsFromMarkdown(contentMd))
    onChange({
      title: extractTitleFromMarkdown(contentMd),
      contentMd,
      contentJson: (doc ?? null) as Record<string, unknown> | null,
      tags,
    })
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Underline,
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: 'image/*',
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: uploadImageAsDataUrl,
        onError: (error) => console.error('Upload failed:', error),
      }),
    ],
    editorProps: {
      attributes: {
        class: 'note-editor__body simple-editor',
      },
    },
    content: initialDoc,
    onUpdate: ({ editor }) => {
      emitChange(editor.getJSON())
    },
  })

  useEffect(() => {
    if (!editor) return
    const nextDoc = ensureRichDoc(value.contentJson, value.contentMd)
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(nextDoc)
    if (current !== next) {
      editor.commands.setContent(nextDoc, { emitUpdate: false })
    }
  }, [editor, value.contentJson, value.contentMd])

  return (
    <div className="note-editor">
      <div className="note-editor__topbar">
        <div className="note-editor__toolbar-wrap">
          <EditorContext.Provider value={{ editor }}>
            <Toolbar className="note-editor__toolbar-inline">
              <ToolbarGroup>
                <UndoRedoButton action="undo" />
                <UndoRedoButton action="redo" />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ToolbarGroup>
                <HeadingDropdownMenu modal={false} levels={[1, 2, 3]} />
                <ListDropdownMenu modal={false} types={['bulletList', 'orderedList', 'taskList']} />
                <BlockquoteButton />
                <CodeBlockButton />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ToolbarGroup>
                <MarkButton type="bold" />
                <MarkButton type="italic" />
                <MarkButton type="strike" />
                <MarkButton type="code" />
                <MarkButton type="underline" />
                <ColorHighlightPopover />
                <LinkPopover />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ToolbarGroup>
                <MarkButton type="superscript" />
                <MarkButton type="subscript" />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ToolbarGroup>
                <TextAlignButton align="left" />
                <TextAlignButton align="center" />
                <TextAlignButton align="right" />
                <TextAlignButton align="justify" />
              </ToolbarGroup>
              <ToolbarSeparator />
              <ToolbarGroup>
                <ImageUploadButton text="Add" />
              </ToolbarGroup>
            </Toolbar>
          </EditorContext.Provider>
        </div>
        <div className="note-editor__actions">
          <ActionButton icon={<Info size={14} />} label="Info" panelId="info" onClick={onOpenInfo} />
          <ActionButton icon={<Palette size={14} />} label="Appearance" panelId="appearance" onClick={onOpenAppearance} />
          <ActionButton icon={<Download size={14} />} label="Export" panelId="export" onClick={onExport} />
        </div>
      </div>

      <div ref={surfaceRef} className="note-editor__surface">
        <div
          className="note-editor__content"
          style={
            {
              width: `${contentWidthPercent}%`,
              maxWidth: 'none',
              fontFamily,
              '--note-editor-font-size': `${appearance?.fontSize ?? 16}px`,
              '--note-editor-line-height': `${appearance?.lineHeight ?? 1.7}`,
            } as CSSProperties
          }
        >
          {value.tags.length ? (
            <div className="note-editor__tag-row">
              {value.tags.map((tag) => (
                <span key={tag} className="note-editor__tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          <EditorContext.Provider value={{ editor }}>
            <EditorContent editor={editor} className="simple-editor-content" />
          </EditorContext.Provider>
        </div>
      </div>

    </div>
  )
}

export default NoteEditor
