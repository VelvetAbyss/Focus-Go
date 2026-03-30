import type { JSONContent } from '@tiptap/core'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Selection } from '@tiptap/extensions'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'
import { Typography } from '@tiptap/extension-typography'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { EditorContent, EditorContext, useEditor } from '@tiptap/react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { HorizontalRule } from '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension'
import '@/components/tiptap-node/blockquote-node/blockquote-node.scss'
import '@/components/tiptap-node/code-block-node/code-block-node.scss'
import '@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss'
import '@/components/tiptap-node/list-node/list-node.scss'
import '@/components/tiptap-node/paragraph-node/paragraph-node.scss'
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button'
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button'
import { ColorHighlightPopover } from '@/components/tiptap-ui/color-highlight-popover'
import { HeadingDropdownMenu } from '@/components/tiptap-ui/heading-dropdown-menu'
import { ListDropdownMenu } from '@/components/tiptap-ui/list-dropdown-menu'
import { MarkButton } from '@/components/tiptap-ui/mark-button'
import { LinkPopover } from '@/components/tiptap-ui/link-popover'
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button'
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/tiptap-ui-primitive/toolbar'
import { ResizableImage } from '../../notes/model/resizableImage'
import { ensureRichDoc, richDocToMarkdown } from '../../notes/model/richTextCodec'

export type DiaryEditorValue = {
  contentMd: string
  contentJson?: Record<string, unknown> | null
}

type DiaryEditorProps = {
  value: DiaryEditorValue
  placeholder?: string
  onChange: (next: DiaryEditorValue) => void
  onFlush?: () => void
}

const DEBOUNCE_MS = 600
const MAX_PASTED_IMAGE_SIZE = 10 * 1024 * 1024

const uploadImageAsDataUrl = async (file: File): Promise<string> => {
  if (file.size > MAX_PASTED_IMAGE_SIZE) {
    throw new Error(`File size exceeds maximum allowed (${MAX_PASTED_IMAGE_SIZE / (1024 * 1024)}MB)`)
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

const DiaryEditor = ({ value, placeholder, onChange, onFlush }: DiaryEditorProps) => {
  const initialDoc = useMemo(() => ensureRichDoc(value.contentJson, value.contentMd), [])
  const pendingDocRef = useRef<JSONContent | null | undefined>(undefined)
  const emitTimerRef = useRef<number | null>(null)
  const changeMetaRef = useRef({ onChange })
  const shouldSkipSyncRef = useRef(false)

  useEffect(() => {
    changeMetaRef.current = { onChange }
  }, [onChange])

  const flushEmit = useCallback(() => {
    const doc = pendingDocRef.current
    if (doc === undefined) return
    pendingDocRef.current = undefined
    if (emitTimerRef.current) {
      window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = null
    }
    const contentMd = richDocToMarkdown(doc)
    changeMetaRef.current.onChange({
      contentMd,
      contentJson: (doc ?? null) as Record<string, unknown> | null,
    })
    onFlush?.()
  }, [onFlush])

  const scheduleEmit = useCallback(
    (doc: JSONContent | null | undefined) => {
      pendingDocRef.current = doc
      if (emitTimerRef.current) window.clearTimeout(emitTimerRef.current)
      emitTimerRef.current = window.setTimeout(() => {
        flushEmit()
      }, DEBOUNCE_MS)
    },
    [flushEmit],
  )

  useEffect(() => () => { flushEmit() }, [flushEmit])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: { openOnClick: false, enableClickSelection: true },
      }),
      HorizontalRule,
      Placeholder.configure({ placeholder: placeholder ?? 'Write your thoughts...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      ResizableImage,
      Underline,
      Typography,
      Superscript,
      Subscript,
      Selection,
    ],
    editorProps: {
      attributes: { class: 'note-editor__body simple-editor' },
      handlePaste: (_view, event) => {
        const imageFiles = getPastedImageFiles(event)
        if (imageFiles.length === 0) return false

        event.preventDefault()
        void Promise.all(imageFiles.map((file) => uploadImageAsDataUrl(file)))
          .then((sources) => {
            for (const src of sources) {
              editor?.chain().focus().setImage({ src }).run()
            }
          })
          .catch((error) => console.error('Diary paste image failed:', error))
        return true
      },
    },
    content: initialDoc,
    onUpdate: ({ editor }) => {
      shouldSkipSyncRef.current = true
      scheduleEmit(editor.getJSON())
    },
  })

  useEffect(() => {
    if (!editor) return
    if (shouldSkipSyncRef.current) {
      shouldSkipSyncRef.current = false
      return
    }
    flushEmit()
    const nextDoc = ensureRichDoc(value.contentJson, value.contentMd)
    editor.commands.setContent(nextDoc, { emitUpdate: false })
  }, [editor, flushEmit, value.contentJson, value.contentMd])

  return (
    <div className="note-editor diary-editor">
      {/* Floating toolbar — absolutely positioned, does NOT occupy flex height */}
      <div className="diary-editor__floating-toolbar">
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
            </Toolbar>
          </EditorContext.Provider>
        </div>
      </div>

      {/* Scrollable surface — now fills full diary-editor height */}
      <div className="note-editor__surface diary-editor__surface">
        <div className="note-editor__content">
          <EditorContext.Provider value={{ editor }}>
            <EditorContent editor={editor} className="simple-editor-content" />
          </EditorContext.Provider>
        </div>
      </div>
    </div>
  )
}

export default DiaryEditor
