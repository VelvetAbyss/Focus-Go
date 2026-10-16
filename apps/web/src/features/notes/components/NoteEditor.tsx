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
import { StarterKit } from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { applyNoteCrdt, createNoteCrdt, hasSameNoteCrdtEpoch, isNoteCrdtSnapshot, noteCrdtProjection } from '../../../data/sync/noteCrdt'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { ArrowLeft, Download, Expand, FileUp, Info, ListTodo, Minimize2, Palette } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import { ImageUploadNode } from '@/components/tiptap-node/image-upload-node/image-upload-node-extension'
import { getPastedImageFiles } from '../../../shared/util/clipboard'
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
import { DiscoveryNewBadge } from '../../../shared/ui/DiscoveryNewBadge'
import { markDiscoveryNewTargetSeen, type DiscoveryNewTargetId } from '../../../shared/discovery/discoveryNewTargetActions'
import { matchNoteCommands, NoteCommands, type NoteCommandContext, type NoteCommandId, type NoteTaskIntent } from '../model/noteCommands'
import { NoteCommandMenu } from './NoteCommandMenu'
import { NoteSelectionMenu } from './NoteSelectionMenu'
import { NoteBlockTools } from './NoteBlockTools'
import { applyNoteBlockType, runNoteAction, NoteBlockMovement } from '../model/noteBlocks'

type NoteEditorValue = {
  crdtState?: string
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  editorMode: 'document'
  tags: string[]
}

type NoteEditorProps = {
  noteId?: string
  value: NoteEditorValue
  appearance?: {
    theme?: 'paper' | 'graphite'
    font?: NoteFontFamily
    fontSize?: number
    lineHeight?: number
    contentWidth?: number
    focusMode?: boolean
    paperBg?: 'beige' | 'white'
    zoom?: number
  }
  onOpenInfo?: () => void
  onOpenAppearance?: () => void
  onImport?: () => void
  onExport?: () => void
  onToggleFullscreen?: () => void
  onCreateTask?: (suggestedTitle: string, intent?: NoteTaskIntent) => void
  taskDialogOpen?: boolean
  onReturn?: () => void
  returnLabel?: string
  onChange: (next: NoteEditorValue) => void
  isFullscreen?: boolean
  surfaceRef?: RefObject<HTMLDivElement | null>
  /** Put the caret in the document once the editor mounts (a note that was just created). */
  autoFocus?: boolean
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
  uiSans: 'var(--font-body)',
  humanistSans: '"Avenir Next", "Nunito", "Trebuchet MS", "Gill Sans", "Segoe UI", sans-serif',
  cnSans: '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif',
  // The app's reading serif (DESIGN.md › Serif where you write), bundled offline.
  serif: '"Source Serif 4", "Noto Serif SC", "Iowan Old Style", Georgia, serif',
  cnSerif: '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif',
  mono: '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, monospace',
} as const

const PANEL_DISCOVERY_TARGETS = {
  info: 'notes-info-panel',
  appearance: 'notes-appearance-panel',
  import: 'notes-import-panel',
  export: 'notes-export-panel',
} as const satisfies Record<'info' | 'appearance' | 'import' | 'export', DiscoveryNewTargetId>

const ActionButton = ({ icon, label, onClick, panelId }: { icon: ReactNode; label: string; onClick?: () => void; panelId: 'info' | 'appearance' | 'import' | 'export' }) => (
  <button
    type="button"
    className="note-editor__action-button"
    onClick={() => {
      markDiscoveryNewTargetSeen(PANEL_DISCOVERY_TARGETS[panelId])
      onClick?.()
    }}
    data-note-panel-trigger={panelId}
  >
    {icon}
    <span>{label}</span>
    <DiscoveryNewBadge target={PANEL_DISCOVERY_TARGETS[panelId]} />
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

const hasStructuredTableShape = (rows: string[][]) => {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (maxCols < 2 || rows.length < 2) return false

  const columnNonEmptyCounts = Array.from({ length: maxCols }, () => 0)
  let rowsWithMultipleNonEmptyCells = 0

  for (const row of rows) {
    let nonEmptyCells = 0
    for (let index = 0; index < maxCols; index += 1) {
      if ((row[index] ?? '').trim().length === 0) continue
      nonEmptyCells += 1
      columnNonEmptyCounts[index] += 1
    }
    if (nonEmptyCells >= 2) rowsWithMultipleNonEmptyCells += 1
  }

  const columnsWithAnyContent = columnNonEmptyCounts.filter((count) => count > 0).length
  return rowsWithMultipleNonEmptyCells >= 1 && columnsWithAnyContent >= 2
}

const normalizeTableRows = (rows: string[][]) => {
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (maxCols < 2 || rows.length < 2) return null
  const normalized = rows.map((row) => {
    const padded = [...row]
    while (padded.length < maxCols) padded.push('')
    return padded
  })
  return hasStructuredTableShape(normalized) ? normalized : null
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
  return null
}

const normalizeClipboardText = (text: string) =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/\u2028|\u2029/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trimEnd()

const serializeDoc = (doc: JSONContent | null | undefined) => JSON.stringify(doc ?? null)

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
  onImport,
  onExport,
  onToggleFullscreen,
  onCreateTask,
  taskDialogOpen = false,
  onReturn,
  returnLabel,
  onChange,
  noteId,
  isFullscreen = false,
  surfaceRef,
  autoFocus = false,
}: NoteEditorProps) => {
  const { t } = useI18n()
  const initialDoc = useMemo(() => ensureRichDoc(value.contentJson, value.contentMd), [value.contentJson, value.contentMd])
  // NotePage keys the editor by note ID. One Y.Doc lives for one editor session.
  const [collaborationDoc] = useState(() => noteId ? createNoteCrdt(initialDoc, isNoteCrdtSnapshot(value) ? value.crdtState : null) : null)
  const fontFamily = fontFamilyMap[appearance?.font ?? 'uiSans']
  const widthScale = Math.max(0, Math.min(100, appearance?.contentWidth ?? 60)) / 100
  const contentMeasureRem = 64 - widthScale * 30
  const zoomLevel = Math.max(50, Math.min(200, appearance?.zoom ?? 100)) / 100
  const surfaceBg = appearance?.paperBg === 'white' ? 'var(--bg-elevated)' : undefined
  const [headings, setHeadings] = useState<HeadingNavItem[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null)
  const MAX_NAV_ITEMS = 12
  const navCollapsed = headings.length > MAX_NAV_ITEMS
  const navItems = navCollapsed ? headings.filter((h) => h.level === 1) : headings
  const resolvedActiveId = useMemo(() => {
    if (!navCollapsed || !activeHeadingId) return activeHeadingId
    const activeIndex = headings.findIndex((h) => h.id === activeHeadingId)
    if (activeIndex === -1) return activeHeadingId
    for (let i = activeIndex; i >= 0; i--) {
      if (headings[i].level === 1) return headings[i].id
    }
    return navItems[0]?.id ?? activeHeadingId
  }, [navCollapsed, activeHeadingId, headings, navItems])
  const [tocVersion, setTocVersion] = useState(0)
  const editorRootRef = useRef<HTMLDivElement | null>(null)
  const commandMenuId = useId()
  const [commandContext, setCommandContext] = useState<NoteCommandContext | null>(null)
  const [commandIndex, setCommandIndex] = useState(0)
  const commandIndexRef = useRef(0)
  const commandHandlersRef = useRef<{
    choose: (id: NoteCommandId, context: NoteCommandContext) => void
    key: (event: KeyboardEvent, context: NoteCommandContext) => boolean
  }>({ choose: () => {}, key: () => false })
  const returnSelectionRef = useRef<{ from: number; to: number } | null>(null)
  const wasTaskDialogOpenRef = useRef(false)
  const localEditRevisionRef = useRef(0)
  const deferredExternalRef = useRef<{ doc: JSONContent; key: string; revision: number; dirty: boolean } | null>(null)
  const scrollSyncFrameRef = useRef<number | null>(null)
  const emitTimerRef = useRef<number | null>(null)
  const tocTimerRef = useRef<number | null>(null)
  const pendingDocRef = useRef<JSONContent | null | undefined>(undefined)
  const lastEditorDocRef = useRef(serializeDoc(initialDoc))
  const lastAppliedExternalDocRef = useRef(serializeDoc(initialDoc))
  const changeMetaRef = useRef({ onChange, tags: value.tags })

  useEffect(() => {
    changeMetaRef.current = { onChange, tags: value.tags }
  }, [onChange, value.tags])

  const flushEmitChange = useCallback(() => {
    if (pendingDocRef.current === undefined) return
    // A remote merge may arrive during the save debounce. Serialize body and
    // CRDT state from the same current Y.Doc, never an older pending JSON.
    const crdtSnapshot = collaborationDoc ? noteCrdtProjection(collaborationDoc) : null
    const doc = crdtSnapshot ? crdtSnapshot.contentJson : pendingDocRef.current
    pendingDocRef.current = undefined
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = null
    }
    const contentMd = crdtSnapshot ? crdtSnapshot.contentMd : richDocToMarkdown(doc)
    lastEditorDocRef.current = serializeDoc(doc)
    const { onChange: handleChange, tags } = changeMetaRef.current
    handleChange({
      title: extractTitleFromMarkdown(contentMd),
      contentMd,
      contentJson: (doc ?? null) as Record<string, unknown> | null,
      ...(crdtSnapshot ? { crdtState: crdtSnapshot.crdtState } : {}),
      editorMode: 'document',
      tags,
    })
  }, [collaborationDoc])

  const scheduleEmitChange = useCallback(
    (doc: JSONContent | null | undefined) => {
      pendingDocRef.current = doc
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = window.setTimeout(() => {
        flushEmitChange()
      }, 420)
    },
    [flushEmitChange],
  )

  const scheduleTocRefresh = useCallback(() => {
    if (tocTimerRef.current) window.clearTimeout(tocTimerRef.current)
    tocTimerRef.current = window.setTimeout(() => {
      tocTimerRef.current = null
      setTocVersion((version) => version + 1)
    }, 520)
  }, [])

  useEffect(
    () => () => {
      if (tocTimerRef.current) {
        window.clearTimeout(tocTimerRef.current)
        tocTimerRef.current = null
      }
      flushEmitChange()
    },
    [flushEmitChange],
  )

  // Reload, tab close and app quit skip the unmount flush above: hand the last keystrokes
  // to the page's save queue as soon as the page is being hidden.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flushEmitChange()
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', flushEmitChange)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', flushEmitChange)
    }
  }, [flushEmitChange])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: collaborationDoc ? false : { newGroupDelay: 500 },
        horizontalRule: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      HorizontalRule,
      ...(collaborationDoc ? [Collaboration.configure({ document: collaborationDoc })] : []),
      Placeholder.configure({ placeholder: t('notes.editorPlaceholder') }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      ResizableImage,
      Typography,
      Superscript,
      Subscript,
      Selection,
      NoteBlockMovement,
      NoteCommands.configure({
        onContext: (context) => setCommandContext((previous) => {
          if (previous?.from === context?.from && previous?.to === context?.to && previous?.query === context?.query) return previous
          commandIndexRef.current = 0
          setCommandIndex(0)
          return context
        }),
        onKey: (event, context) => commandHandlersRef.current.key(event, context),
      }),
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
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('notes.editorPlaceholder'),
      },
      handleKeyDown: (view, event) => {
        if (view.composing || event.isComposing || event.keyCode === 229 || event.altKey) return false
        if (!(event.metaKey || event.ctrlKey)) return false
        const key = event.key.toLowerCase()
        if (key !== 'z' && key !== 'y') return false
        // Explicitly own history keys in this editor, including browsers whose
        // platform detection disagrees with the physical modifier key.
        event.preventDefault()
        event.stopPropagation()
        if (key === 'y' || event.shiftKey) editor?.commands.redo()
        else editor?.commands.undo()
        return true
      },
      clipboardTextSerializer: (slice) => normalizeClipboardText(slice.content.textBetween(0, slice.content.size, '\n', '\n')),
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

        // If HTML contains mixed content (table + paragraphs/headings/lists), let
        // Tiptap's native HTML paste handle it so all content is preserved.
        const hasHtmlTable = html.includes('<table')
        const hasNonTableBlocks = /<p[\s>]|<h[1-6][\s>]|<ul[\s>]|<ol[\s>]|<blockquote[\s>]|<pre[\s>]/i.test(html)
        if (hasHtmlTable && hasNonTableBlocks) return false

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
    content: collaborationDoc ? undefined : initialDoc,
    onUpdate: ({ editor, transaction }) => {
      const syncMeta = transaction?.getMeta(ySyncPluginKey)
      if (collaborationDoc && syncMeta?.isChangeOrigin && !syncMeta.isUndoRedoOperation) {
        scheduleTocRefresh()
        return
      }
      localEditRevisionRef.current += 1
      const nextDoc = editor.getJSON()
      lastEditorDocRef.current = serializeDoc(nextDoc)
      scheduleEmitChange(nextDoc)
      scheduleTocRefresh()
    },
  })

  useEffect(() => {
    if (autoFocus && editor) editor.commands.focus('end')
  }, [autoFocus, editor])

  useEffect(() => {
    if (!editor) return
    if (collaborationDoc && value.crdtState && isNoteCrdtSnapshot({ contentJson: value.contentJson, contentMd: value.contentMd, crdtState: value.crdtState }) && hasSameNoteCrdtEpoch(collaborationDoc, value.crdtState)) {
      applyNoteCrdt(collaborationDoc, value.crdtState)
      return
    }
    const nextDoc = ensureRichDoc(value.contentJson, value.contentMd)
    const nextDocKey = serializeDoc(nextDoc)
    if (nextDocKey === serializeDoc(editor.getJSON())) {
      lastAppliedExternalDocRef.current = nextDocKey
      deferredExternalRef.current = null
      return
    }
    if (nextDocKey === lastAppliedExternalDocRef.current) return
    if (nextDocKey === lastEditorDocRef.current) {
      lastAppliedExternalDocRef.current = nextDocKey
      return
    }
    const composing = Boolean(editor.view?.composing)
    const focused = editor.isFocused ?? document.activeElement === editor.view?.dom
    if (focused || composing || pendingDocRef.current !== undefined) {
      deferredExternalRef.current = { doc: nextDoc, key: nextDocKey, revision: localEditRevisionRef.current, dirty: pendingDocRef.current !== undefined }
      return
    }
    flushEmitChange()
    editor.commands.setContent(nextDoc, { emitUpdate: false })
    lastEditorDocRef.current = nextDocKey
    lastAppliedExternalDocRef.current = nextDocKey
    setTocVersion((version) => version + 1)
  }, [editor, flushEmitChange, value.contentJson, value.contentMd, value.crdtState, collaborationDoc])

  useEffect(() => {
    if (!editor) return
    let timer: number | undefined
    const reconcileAfterInput = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        if (editor.isDestroyed || editor.isFocused || editor.view.composing) return
        const deferred = deferredExternalRef.current
        flushEmitChange()
        if (!deferred) return
        deferredExternalRef.current = null
        // A remote/parent snapshot must never replace newer local keystrokes.
        if (deferred.dirty || deferred.revision !== localEditRevisionRef.current) return
        if (serializeDoc(editor.getJSON()) === deferred.key) return
        editor.commands.setContent(deferred.doc, { emitUpdate: false })
        lastEditorDocRef.current = deferred.key
        lastAppliedExternalDocRef.current = deferred.key
        setTocVersion((version) => version + 1)
      }, 60)
    }
    editor.on('blur', reconcileAfterInput)
    editor.view.dom.addEventListener('compositionend', reconcileAfterInput)
    return () => {
      window.clearTimeout(timer)
      editor.off('blur', reconcileAfterInput)
      editor.view.dom.removeEventListener('compositionend', reconcileAfterInput)
    }
  }, [editor, flushEmitChange])

  useEffect(() => {
    const closed = wasTaskDialogOpenRef.current && !taskDialogOpen
    wasTaskDialogOpenRef.current = taskDialogOpen
    if (!closed || !editor || !returnSelectionRef.current) return
    const selection = returnSelectionRef.current
    returnSelectionRef.current = null
    const frame = window.requestAnimationFrame(() => {
      if (editor.isDestroyed || !editor.view.dom.isConnected) return
      const size = editor.state.doc.content.size
      editor.chain().focus().setTextSelection({ from: Math.min(selection.from, size), to: Math.min(selection.to, size) }).run()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [editor, taskDialogOpen])

  const requestTask = (intent: NoteTaskIntent = 'task') => {
    if (!editor || !onCreateTask) return
    const selection = editor.state.selection
    returnSelectionRef.current = { from: selection.from, to: selection.to }
    const title = !selection.empty
      ? editor.state.doc.textBetween(selection.from, selection.to, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
      : ''
    flushEmitChange()
    onCreateTask(title, intent)
  }
  const chooseCommand = (id: NoteCommandId, context: NoteCommandContext) => {
    if (!editor || editor.view.composing) return
    const taskCommand = id === 'task' || id === 'waiting' || id === 'reminder'
    runNoteAction(editor, chain => {
      const cleared = chain.deleteRange({ from: context.from, to: context.to })
      return taskCommand ? cleared : applyNoteBlockType(cleared, id)
    })
    if (taskCommand) requestTask(id)
    setCommandContext(null)
  }
  commandHandlersRef.current = {
    choose: chooseCommand,
    key: (event, context) => {
      const commands = matchNoteCommands(context.query, Boolean(onCreateTask))
      if (!commands.length) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        event.stopPropagation()
        commandIndexRef.current = (commandIndexRef.current + (event.key === 'ArrowDown' ? 1 : -1) + commands.length) % commands.length
        setCommandIndex(commandIndexRef.current)
        return true
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        event.stopPropagation()
        chooseCommand(commands[commandIndexRef.current % commands.length].id, context)
        return true
      }
      return false
    },
  }
  const commands = useMemo(() => commandContext ? matchNoteCommands(commandContext.query, Boolean(onCreateTask)) : [], [commandContext, onCreateTask])
  const [, refreshMenuPosition] = useState(0)
  useEffect(() => {
    if (!commandContext) return
    let frame = 0
    const refresh = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        refreshMenuPosition((version) => version + 1)
      })
    }
    window.addEventListener('scroll', refresh, true)
    window.addEventListener('resize', refresh)
    return () => {
      window.removeEventListener('scroll', refresh, true)
      window.removeEventListener('resize', refresh)
      window.cancelAnimationFrame(frame)
    }
  }, [commandContext])
  useEffect(() => {
    if (!editor) return
    const dom = editor.view.dom
    if (!commandContext) {
      dom.removeAttribute('aria-controls')
      dom.removeAttribute('aria-activedescendant')
      dom.removeAttribute('aria-expanded')
      return
    }
    dom.setAttribute('aria-controls', commandMenuId)
    dom.setAttribute('aria-expanded', 'true')
    const active = commands[commandIndex]
    if (active) dom.setAttribute('aria-activedescendant', `${commandMenuId}-${active.id}`)
    else dom.removeAttribute('aria-activedescendant')
  }, [commandContext, commandIndex, commandMenuId, commands, editor])
  let menuPosition = { left: 0, top: 0 }
  if (commandContext && editor && editorRootRef.current) {
    const caret = editor.view.coordsAtPos(commandContext.to)
    const bounds = editorRootRef.current.getBoundingClientRect()
    const height = Math.min(360, Math.max(1, commands.length) * 38 + 40)
    const below = caret.bottom + 6
    const top = below + height <= window.innerHeight - 8 ? below : Math.max(8, caret.top - height - 6)
    menuPosition = { left: Math.max(0, Math.min(caret.left - bounds.left, bounds.width - 240)), top: top - bounds.top }
  }

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
      setActiveHeadingId((previous) => (previous === current ? previous : current))
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
    <div className="note-editor" ref={editorRootRef}>
      {editor ? <><NoteSelectionMenu editor={editor} disabled={taskDialogOpen} /><NoteBlockTools editor={editor} disabled={taskDialogOpen} /></> : null}
      {commandContext ? <NoteCommandMenu menuId={commandMenuId} commands={commands} activeIndex={commandIndex} {...menuPosition}
        onChoose={(id) => commandHandlersRef.current.choose(id, commandContext)} /> : null}
      <div className="note-editor__topbar">
        {onReturn ? (
          <button type="button" className="note-editor__return" onClick={onReturn} aria-label={returnLabel} title={returnLabel}>
            <ArrowLeft size={15} />
            <span>{returnLabel}</span>
          </button>
        ) : null}
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
          {onCreateTask ? (
            <button
              type="button"
              className="note-editor__action-button note-editor__action-button--task"
              aria-label={t('notes.createTask')}
              title={t('notes.createTask')}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => requestTask()}
            >
              <ListTodo size={14} />
              <span>{t('notes.createTask')}</span>
            </button>
          ) : null}
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
          <ActionButton icon={<FileUp size={14} />} label={t('notes.import')} panelId="import" onClick={onImport} />
          <ActionButton icon={<Download size={14} />} label={t('notes.export')} panelId="export" onClick={onExport} />
        </div>
      </div>

      <div
        ref={surfaceRef}
        className="note-editor__surface"
        style={surfaceBg ? { background: surfaceBg } : undefined}
        onMouseDown={(event) => {
          if (!editor) return
          const target = event.target as HTMLElement | null
          // If the click already lands inside the actual editable content,
          // let ProseMirror handle it as usual (caret-on-character behavior).
          if (target && target.closest('.ProseMirror')) return
          // Otherwise the user clicked on the surface / bottom spacer / side
          // padding — treat it as "click-to-continue-writing" and put the
          // caret at the very end of the document.
          event.preventDefault()
          editor.chain().focus('end').run()
        }}
      >
        <div
          className="note-editor__content"
          style={
            {
              '--note-content-measure': `${contentMeasureRem}rem`,
              fontFamily,
              zoom: zoomLevel,
              '--note-editor-font-size': `${(appearance?.fontSize ?? 16) / 16}rem`,
              '--note-editor-line-height': `${appearance?.lineHeight ?? 1.5}`,
            } as CSSProperties
          }
        >
          <EditorContext.Provider value={{ editor }}>
            <EditorContent editor={editor} className="simple-editor-content" />
          </EditorContext.Provider>
          <div className="note-editor__bottom-spacer" aria-hidden="true" />
        </div>
      </div>
      {headings.length > 0 && (
        <aside className="note-editor__heading-nav" aria-label={t('notes.tableOfContents')}>
          {navItems.map((heading) => (
            <button
              key={heading.id}
              type="button"
              className={`note-editor__heading-nav-item${resolvedActiveId === heading.id ? ' is-active' : ''}`}
              onClick={() => handleHeadingJump(heading.id)}
              title={heading.text}
              aria-label={heading.text}
              data-level={heading.level}
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
