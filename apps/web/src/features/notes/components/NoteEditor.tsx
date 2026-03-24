import type { JSONContent } from '@tiptap/core'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Selection } from '@tiptap/extensions'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Table } from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { TextAlign } from '@tiptap/extension-text-align'
import { Typography } from '@tiptap/extension-typography'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { Download, Expand, GitBranch, Info, Minimize2, Palette } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss'
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/image-node/image-node.scss'
import '@/components/tiptap-node/heading-node/heading-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'
import { useI18n } from '../../../shared/i18n/useI18n'
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
import { ResizableImage } from '../model/resizableImage'

type NoteEditorValue = {
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  editorMode: 'document'
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
  onOpenMindMap?: () => void
  onToggleFullscreen?: () => void
  onChange: (next: NoteEditorValue) => void
  isFullscreen?: boolean
  surfaceRef?: RefObject<HTMLDivElement | null>
}

type HeadingNavItem = {
  id: string
  text: string
  level: 1 | 2 | 3
  top: number
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

const getPastedImageFiles = (event: ClipboardEvent) =>
  Array.from(event.clipboardData?.items ?? [])
    .filter((item) => item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file))

const normalizeTableRows = (rows: string[][]) => {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (maxCols < 2 || rows.length < 2) return null
  return rows.map((row) => {
    const padded = [...row]
    while (padded.length < maxCols) padded.push('')
    return padded
  })
}

const parseHtmlTable = (html: string) => {
  if (!html || !html.includes('<table')) return null
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null
  const rows = Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? ''),
  )
  return normalizeTableRows(rows.filter((row) => row.length > 0))
}

const parseCsvLine = (line: string) => {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  result.push(current.trim())
  return result
}

const parseTextTable = (text: string) => {
  if (!text) return null
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
  if (lines.length < 2) return null
  if (lines.some((line) => line.includes('\t'))) {
    return normalizeTableRows(lines.map((line) => line.split('\t').map((cell) => cell.trim())))
  }
  if (lines.some((line) => line.includes(','))) {
    return normalizeTableRows(lines.map((line) => parseCsvLine(line)))
  }
  return null
}

const createTableNode = (rows: string[][]): JSONContent => ({
  type: 'table',
  content: rows.map((row) => ({
    type: 'tableRow',
    content: row.map((cell) => ({
      type: 'tableCell',
      content: cell ? [{ type: 'paragraph', content: [{ type: 'text', text: cell }] }] : [{ type: 'paragraph' }],
    })),
  })),
})

const NoteEditor = ({
  value,
  appearance,
  onOpenInfo,
  onOpenAppearance,
  onExport,
  onOpenMindMap,
  onToggleFullscreen,
  onChange,
  isFullscreen = false,
  surfaceRef,
}: NoteEditorProps) => {
  const { t } = useI18n()
  const initialDoc = useMemo(() => ensureRichDoc(value.contentJson, value.contentMd), [value.contentJson, value.contentMd])
  const fontFamily = fontFamilyMap[appearance?.font ?? 'uiSans']
  const widthScale = Math.max(0, Math.min(100, appearance?.contentWidth ?? 0)) / 100
  const contentWidthPercent = 100 - widthScale * 42
  const [headings, setHeadings] = useState<HeadingNavItem[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const [tocVersion, setTocVersion] = useState(0)
  const scrollSyncFrameRef = useRef<number | null>(null)
  const emitTimerRef = useRef<number | null>(null)
  const pendingDocRef = useRef<JSONContent | null | undefined>(undefined)
  const shouldSkipSyncRef = useRef(false)
  const changeMetaRef = useRef({ onChange, tags: value.tags })

  useEffect(() => {
    changeMetaRef.current = { onChange, tags: value.tags }
  }, [onChange, value.tags])

  const flushEmitChange = useCallback(() => {
    const doc = pendingDocRef.current
    if (doc === undefined) return
    pendingDocRef.current = undefined
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = null
    }
    const contentMd = richDocToMarkdown(doc)
    const { onChange: handleChange, tags } = changeMetaRef.current
    handleChange({
      title: extractTitleFromMarkdown(contentMd),
      contentMd,
      contentJson: (doc ?? null) as Record<string, unknown> | null,
      editorMode: 'document',
      tags,
    })
  }, [])

  const scheduleEmitChange = useCallback(
    (doc: JSONContent | null | undefined) => {
      pendingDocRef.current = doc
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = window.setTimeout(() => {
        flushEmitChange()
      }, 120)
    },
    [flushEmitChange],
  )

  useEffect(
    () => () => {
      flushEmitChange()
    },
    [flushEmitChange],
  )

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
      Placeholder.configure({ placeholder: '开始写作...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Underline,
      ResizableImage,
      Typography,
      Superscript,
      Subscript,
      Selection,
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
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
      handlePaste: (_view, event) => {
        const imageFiles = getPastedImageFiles(event)
        if (imageFiles.length > 0) {
          event.preventDefault()
          void Promise.all(imageFiles.map((file) => uploadImageAsDataUrl(file)))
            .then((sources) => {
              for (const src of sources) {
                editor?.chain().focus().setImage({ src }).run()
              }
            })
            .catch((error) => console.error('Paste image failed:', error))
          return true
        }

        const html = event.clipboardData?.getData('text/html') ?? ''
        const text = event.clipboardData?.getData('text/plain') ?? ''
        const rows = parseHtmlTable(html) ?? parseTextTable(text)
        if (!rows) return false

        event.preventDefault()
        const to = editor?.state.selection.to
        if (to == null) return false
        editor?.chain()
          .focus()
          .setTextSelection(to)
          .insertContent(createTableNode(rows))
          .run()
        return true
      },
    },
    content: initialDoc,
    onUpdate: ({ editor }) => {
      shouldSkipSyncRef.current = true
      scheduleEmitChange(editor.getJSON())
      setTocVersion((version) => version + 1)
    },
  })

  useEffect(() => {
    if (!editor) return
    if (shouldSkipSyncRef.current) {
      shouldSkipSyncRef.current = false
      return
    }
    flushEmitChange()
    const nextDoc = ensureRichDoc(value.contentJson, value.contentMd)
    editor.commands.setContent(nextDoc, { emitUpdate: false })
    setTocVersion((version) => version + 1)
  }, [editor, flushEmitChange, value.contentJson, value.contentMd])

  useEffect(() => {
    if (!editor) return
    if (!editor.view?.dom) return
    const root = editor.view.dom as HTMLElement
    const nextHeadings: HeadingNavItem[] = Array.from(root.querySelectorAll<HTMLElement>('h1, h2, h3')).map((heading, index) => ({
      id: `heading-${index}`,
      text: (heading.textContent ?? '').trim() || `Section ${index + 1}`,
      level: Number(heading.tagName.slice(1)) as 1 | 2 | 3,
      top: heading.offsetTop,
    }))
    setHeadings(nextHeadings)
    setActiveHeadingId((current) => (nextHeadings.some((item) => item.id === current) ? current : nextHeadings[0]?.id ?? null))
  }, [editor, tocVersion])

  useEffect(() => {
    if (!editor) return
    if (!editor.view?.dom) return
    const surface = (surfaceRef?.current ?? editor.view.dom.closest('.note-editor__surface')) as HTMLDivElement | null
    if (!surface) return
    const syncActive = () => {
      if (headings.length === 0) {
        setActiveHeadingId(null)
        return
      }
      const marker = surface.scrollTop + 16
      let current = headings[0].id
      for (const heading of headings) {
        if (heading.top <= marker) current = heading.id
      }
      setActiveHeadingId(current)
    }
    const scheduleSyncActive = () => {
      if (scrollSyncFrameRef.current !== null) return
      scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
        scrollSyncFrameRef.current = null
        syncActive()
      })
    }
    scheduleSyncActive()
    surface.addEventListener('scroll', scheduleSyncActive, { passive: true })
    return () => {
      surface.removeEventListener('scroll', scheduleSyncActive)
      if (scrollSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSyncFrameRef.current)
        scrollSyncFrameRef.current = null
      }
    }
  }, [editor, headings, surfaceRef])

  const handleHeadingJump = (id: string) => {
    if (!editor) return
    if (!editor.view?.dom) return
    const surface = (surfaceRef?.current ?? editor.view.dom.closest('.note-editor__surface')) as HTMLDivElement | null
    if (!surface) return
    const target = headings.find((heading) => heading.id === id)
    if (!target) return
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    surface.scrollTo({ top: Math.max(0, target.top - 12), behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }

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
                <ImageUploadButton text={t('notes.add')} />
              </ToolbarGroup>
            </Toolbar>
          </EditorContext.Provider>
        </div>
        <div className="note-editor__actions">
          <button
            type="button"
            className="note-editor__action-button note-editor__action-button--icon"
            aria-label={isFullscreen ? t('notes.exitFullscreen') : t('notes.enterFullscreen')}
            title={isFullscreen ? t('notes.exitFullscreen') : t('notes.enterFullscreen')}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Expand size={14} />}
          </button>
          <ActionButton icon={<Info size={14} />} label={t('notes.info')} panelId="info" onClick={onOpenInfo} />
          <ActionButton icon={<Palette size={14} />} label={t('notes.appearance')} panelId="appearance" onClick={onOpenAppearance} />
          <ActionButton icon={<Download size={14} />} label={t('notes.export')} panelId="export" onClick={onExport} />
          <button
            type="button"
            className="note-editor__action-button"
            onClick={onOpenMindMap}
            data-note-panel-trigger="mindmap"
            title={t('notes.mindmap')}
          >
            <GitBranch size={14} />
            <span>{t('notes.mindmap')}</span>
          </button>
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
          <EditorContext.Provider value={{ editor }}>
            <EditorContent editor={editor} className="simple-editor-content" />
          </EditorContext.Provider>
        </div>
      </div>
      {headings.length > 0 && (
        <aside className="note-editor__heading-nav" aria-label={t('notes.tableOfContents')}>
          {headings.map((heading) => (
            <button
              key={heading.id}
              type="button"
              className={`note-editor__heading-nav-item${activeHeadingId === heading.id ? ' is-active' : ''}`}
              onClick={() => handleHeadingJump(heading.id)}
              title={heading.text}
              aria-label={heading.text}
            >
              <span className="note-editor__heading-nav-bar" />
              <span className="note-editor__heading-nav-label">{heading.text}</span>
            </button>
          ))}
        </aside>
      )}

    </div>
  )
}

export default NoteEditor
