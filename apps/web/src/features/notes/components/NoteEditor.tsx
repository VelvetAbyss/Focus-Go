import type { Editor, JSONContent } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import { Bold, Highlighter, ImageIcon, Italic, Link2, ListChecks, ListOrdered, ListPlus, Table2, Trash2, Underline as UnderlineIcon, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent as ReactMouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { noteAssetsRepo } from '../../../data/repositories/noteAssetsRepo'
import { ensureRichDoc, richDocToMarkdown } from '../model/richTextCodec'
import { AssetImage, createRichTextExtensions } from '../model/richTextExtensions'
import { mergeTags, normalizeTag } from '../model/tags'

type NoteEditorChange = {
  title: string
  contentMd: string
  contentJson: Record<string, unknown> | null
  manualTags: string[]
}

type NoteEditorProps = {
  noteId: string
  title: string
  contentMd: string
  contentJson?: Record<string, unknown> | null
  manualTags: string[]
  allTagSuggestions: string[]
  onChange: (next: NoteEditorChange) => void
}

const WIKI_LINK_RE = /^\[\[[^\]]+\]\]$/

const mapRichDocNode = (node: JSONContent, mapper: (node: JSONContent) => JSONContent): JSONContent => {
  const mapped = mapper({
    ...node,
    attrs: node.attrs ? { ...node.attrs } : node.attrs,
  })

  if (!mapped.content?.length) return mapped
  return {
    ...mapped,
    content: mapped.content.map((child) => mapRichDocNode(child, mapper)),
  }
}

const hydrateImageSources = (doc: JSONContent, assetSources: Map<string, string>) =>
  mapRichDocNode(doc, (node) => {
    if (node.type !== 'image' || !node.attrs) return node
    const assetId = typeof node.attrs.assetId === 'string' ? node.attrs.assetId : ''
    if (!assetId) return node
    const resolvedSrc = assetSources.get(assetId)
    if (!resolvedSrc) return node
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: resolvedSrc,
      },
    }
  })

const dehydrateImageSources = (doc: JSONContent) =>
  mapRichDocNode(doc, (node) => {
    if (node.type !== 'image' || !node.attrs) return node
    const assetId = typeof node.attrs.assetId === 'string' ? node.attrs.assetId : ''
    if (!assetId) return node
    return {
      ...node,
      attrs: {
        ...node.attrs,
        src: `asset://${assetId}`,
      },
    }
  })

const getHeadingValue = (editor: Editor | null) => {
  if (!editor) return 'paragraph'
  if (editor.isActive('heading', { level: 1 })) return 'h1'
  if (editor.isActive('heading', { level: 2 })) return 'h2'
  if (editor.isActive('heading', { level: 3 })) return 'h3'
  return 'paragraph'
}

type ImageNodeViewProps = {
  node: {
    attrs: {
      src?: string
      alt?: string
      width?: number | string | null
    }
  }
  selected: boolean
  updateAttributes: (attributes: Record<string, unknown>) => void
}

const MIN_IMAGE_WIDTH = 160

const ResizableImageNodeView = ({ node, selected, updateAttributes }: ImageNodeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const width =
    typeof node.attrs.width === 'number' ? node.attrs.width : Number.isFinite(Number(node.attrs.width)) ? Number(node.attrs.width) : null

  const startResize = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const container = containerRef.current
    if (!container) return

    setDragging(true)
    const startX = event.clientX
    const startWidth = container.getBoundingClientRect().width

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const nextWidth = Math.max(MIN_IMAGE_WIDTH, Math.round(startWidth + delta))
      updateAttributes({ width: nextWidth })
    }

    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={`notes-editor__image-node ${selected ? 'is-selected' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={width ? { width: `${width}px` } : undefined}
      data-drag-handle="false"
    >
      <img src={node.attrs.src} alt={node.attrs.alt ?? ''} draggable={false} />
      {selected ? (
        <button type="button" className="notes-editor__image-resize-handle" onMouseDown={startResize} aria-label="Resize image">
          <span />
        </button>
      ) : null}
    </NodeViewWrapper>
  )
}

const NoteEditor = ({ noteId, title, contentMd, contentJson, manualTags, allTagSuggestions, onChange }: NoteEditorProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hintTimerRef = useRef<number | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const currentAssetSourcesRef = useRef<Map<string, string>>(new Map())
  const editorRef = useRef<Editor | null>(null)
  const [initialDoc] = useState<JSONContent>(() => ensureRichDoc(contentJson, contentMd))
  const [hadPersistedRichDoc] = useState(() => Boolean(contentJson))
  const currentDocRef = useRef<JSONContent>(initialDoc)

  const [titleDraft, setTitleDraft] = useState(title)
  const [manualTagsDraft, setManualTagsDraft] = useState(() => mergeTags(manualTags, []))
  const [tagInput, setTagInput] = useState('')
  const [tagInputFocused, setTagInputFocused] = useState(false)
  const [selectionHint, setSelectionHint] = useState('')

  const titleRef = useRef(titleDraft)
  const manualTagsRef = useRef(manualTagsDraft)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    titleRef.current = titleDraft
  }, [titleDraft])
  useEffect(() => {
    manualTagsRef.current = manualTagsDraft
  }, [manualTagsDraft])
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const extensions = useMemo(() => {
    const ResizableAssetImage = AssetImage.extend({
      addNodeView() {
        return ReactNodeViewRenderer(ResizableImageNodeView)
      },
    })
    return createRichTextExtensions({
      placeholder: 'Type notes here. #tags in content are indexed automatically.',
      imageExtension: ResizableAssetImage,
    })
  }, [])

  const emitChange = useCallback(
    (nextTitle: string, nextManualTags: string[], nextDoc: JSONContent) => {
      const persistedDoc = dehydrateImageSources(nextDoc)
      const normalizedManualTags = mergeTags(nextManualTags, [])
      onChangeRef.current({
        title: nextTitle,
        manualTags: normalizedManualTags,
        contentJson: persistedDoc as Record<string, unknown>,
        contentMd: richDocToMarkdown(persistedDoc),
      })
    },
    [],
  )

  const insertLocalImageFile = useCallback(
    async (file: File, targetEditor?: Editor | null) => {
      const activeEditor = targetEditor ?? editorRef.current
      if (!activeEditor) return

      const asset = await noteAssetsRepo.addLocalImage(noteId, file)
      const objectUrl = URL.createObjectURL(file)
      objectUrlsRef.current.push(objectUrl)
      currentAssetSourcesRef.current.set(asset.id, objectUrl)
      activeEditor.chain().focus().setImage({ src: objectUrl, alt: file.name || 'image', assetId: asset.id, width: 520 }).run()
    },
    [noteId],
  )

  const editor = useEditor({
    extensions,
    content: initialDoc,
    onUpdate: ({ editor }) => {
      const nextDoc = editor.getJSON()
      currentDocRef.current = nextDoc
      emitChange(titleRef.current, manualTagsRef.current, nextDoc)
    },
    editorProps: {
      attributes: {
        class: 'notes-editor__body',
      },
      handlePaste: (_view: EditorView, event) => {
        const clipboardItems = event.clipboardData?.items
        if (!clipboardItems?.length) return false

        for (const item of Array.from(clipboardItems)) {
          if (!item.type.startsWith('image/')) continue
          const file = item.getAsFile()
          if (!file) continue
          event.preventDefault()
          void insertLocalImageFile(file)
          return true
        }

        return false
      },
    },
  })

  useEffect(() => {
    editorRef.current = editor ?? null
    return () => {
      editorRef.current = null
    }
  }, [editor])

  const releaseObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url)
    objectUrlsRef.current = []
  }, [])

  useEffect(() => {
    return () => {
      releaseObjectUrls()
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    }
  }, [releaseObjectUrls])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      releaseObjectUrls()
      const assets = await noteAssetsRepo.listByNote(noteId)
      if (cancelled) return

      const sourceMap = new Map<string, string>()
      const createdUrls: string[] = []

      for (const asset of assets) {
        if (asset.storage === 'blob' && asset.blob) {
          const objectUrl = URL.createObjectURL(asset.blob)
          sourceMap.set(asset.id, objectUrl)
          createdUrls.push(objectUrl)
        } else if (asset.storage === 'remote' && asset.url) {
          sourceMap.set(asset.id, asset.url)
        }
      }

      currentAssetSourcesRef.current = sourceMap
      objectUrlsRef.current = createdUrls

      const hydratedDoc = hydrateImageSources(initialDoc, sourceMap)
      currentDocRef.current = hydratedDoc
      if (editor) editor.commands.setContent(hydratedDoc, { emitUpdate: false })

      if (!hadPersistedRichDoc) {
        emitChange(titleRef.current, manualTagsRef.current, hydratedDoc)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [noteId, editor, initialDoc, hadPersistedRichDoc, emitChange, releaseObjectUrls])

  const showSelectionHint = (message: string) => {
    setSelectionHint(message)
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current)
    hintTimerRef.current = window.setTimeout(() => setSelectionHint(''), 1200)
  }

  const runSelectionAction = (handler: () => void) => {
    if (!editor) return
    if (editor.state.selection.empty) {
      showSelectionHint('Select text first')
      return
    }
    handler()
  }

  const syncManualChange = (nextManualTags: string[]) => {
    setManualTagsDraft(nextManualTags)
    const nextDoc = editor?.getJSON() ?? currentDocRef.current
    emitChange(titleRef.current, nextManualTags, nextDoc)
  }

  const addManualTag = (raw: string) => {
    const normalized = normalizeTag(raw)
    if (!normalized) return
    if (manualTagsDraft.some((tag) => tag.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
      setTagInput('')
      return
    }
    syncManualChange([...manualTagsDraft, normalized])
    setTagInput('')
  }

  const removeManualTag = (target: string) => {
    const next = manualTagsDraft.filter((tag) => tag.toLocaleLowerCase() !== target.toLocaleLowerCase())
    syncManualChange(next)
  }

  const normalizedTagQuery = useMemo(() => normalizeTag(tagInput), [tagInput])

  const filteredTagSuggestions = useMemo(() => {
    const query = normalizedTagQuery.toLocaleLowerCase()
    const existing = new Set(manualTagsDraft.map((tag) => tag.toLocaleLowerCase()))
    return allTagSuggestions
      .filter((tag) => !existing.has(tag.toLocaleLowerCase()))
      .filter((tag) => !query || tag.toLocaleLowerCase().includes(query))
      .slice(0, 8)
  }, [allTagSuggestions, manualTagsDraft, normalizedTagQuery])

  const onTitleChange = (nextTitle: string) => {
    setTitleDraft(nextTitle)
    titleRef.current = nextTitle
    const nextDoc = editor?.getJSON() ?? currentDocRef.current
    emitChange(nextTitle, manualTagsRef.current, nextDoc)
  }

  const insertLink = () => {
    if (!editor) return
    const raw = window.prompt('Enter URL or [[Note Title]]')
    if (!raw) return
    const next = raw.trim()
    if (!next) return

    if (WIKI_LINK_RE.test(next)) {
      editor.chain().focus().insertContent(next).run()
      return
    }

    runSelectionAction(() => {
      editor.chain().focus().setLink({ href: next }).run()
    })
  }

  const insertRemoteImage = async () => {
    if (!editor) return
    const raw = window.prompt('Paste image URL')
    if (!raw) return
    try {
      const asset = await noteAssetsRepo.addRemoteImage(noteId, raw)
      const src = asset.url ?? raw.trim()
      currentAssetSourcesRef.current.set(asset.id, src)
      editor.chain().focus().setImage({ src, alt: asset.alt ?? 'image', assetId: asset.id, width: 520 }).run()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to insert image.'
      window.alert(message)
    }
  }

  const requestLocalImage = () => fileInputRef.current?.click()

  const handleLocalImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      await insertLocalImageFile(file, editor)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.'
      window.alert(message)
    }
  }

  const headingValue = getHeadingValue(editor)
  const inTable = editor?.isActive('table') ?? false

  return (
    <div className="notes-editor" aria-label="Rich text editor">
      <header className="notes-editor__top">
        <div className="notes-editor__title-wrap">
          <Input value={titleDraft} onChange={(event) => onTitleChange(event.target.value)} placeholder="Untitled note" className="notes-editor__title" />
          <div className="notes-editor__tags">
            <div className="notes-editor__tag-list">
              {manualTagsDraft.map((tag) => (
                <button key={tag} type="button" className="notes-editor__tag-pill" onClick={() => removeManualTag(tag)} title="Remove tag">
                  #{tag}
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
            <div className="notes-editor__tag-input-row">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onFocus={() => setTagInputFocused(true)}
                onBlur={() => setTagInputFocused(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault()
                    addManualTag(tagInput)
                  }
                }}
                className="notes-editor__tag-input"
                placeholder="#Add tag"
              />
              {tagInputFocused && normalizedTagQuery.length > 0 && filteredTagSuggestions.length > 0 ? (
                <div className="notes-editor__tag-suggestions">
                  {filteredTagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="notes-editor__tag-suggestion"
                      onMouseDown={(event) => {
                        event.preventDefault()
                        addManualTag(tag)
                      }}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="notes-editor__quick-biu" aria-label="Quick formatting">
          <Button type="button" variant="ghost" size="sm" onClick={() => runSelectionAction(() => editor?.chain().focus().toggleBold().run())}>
            B
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => runSelectionAction(() => editor?.chain().focus().toggleItalic().run())}>
            I
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => runSelectionAction(() => editor?.chain().focus().toggleUnderline().run())}>
            U
          </Button>
          <p className="notes-editor__selection-hint">{selectionHint}</p>
        </div>
      </header>

      <div className="notes-editor__body-wrap">
        <EditorContent editor={editor} className="notes-editor__content" />
      </div>

      <footer className="notes-editor__toolbar" aria-label="Editor toolbar">
        <Select
          value={headingValue}
          onValueChange={(next) => {
            if (!editor) return
            if (next === 'paragraph') editor.chain().focus().setParagraph().run()
            if (next === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run()
            if (next === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run()
            if (next === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run()
          }}
        >
          <SelectTrigger className="notes-editor__heading-select">
            <SelectValue placeholder="Heading" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={editor?.isActive('taskList') ? 'secondary' : 'ghost'}
          size="sm"
          aria-label="Toggle checklist"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks size={16} />
        </Button>
        <Button
          type="button"
          variant={editor?.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          aria-label="Toggle bullet list"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <ListPlus size={16} />
        </Button>
        <Button
          type="button"
          variant={editor?.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          aria-label="Toggle numbered list"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </Button>

        <Button type="button" variant={editor?.isActive('bold') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </Button>
        <Button type="button" variant={editor?.isActive('italic') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </Button>
        <Button type="button" variant={editor?.isActive('underline') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor?.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={16} />
        </Button>
        <Button type="button" variant={editor?.isActive('highlight') ? 'secondary' : 'ghost'} size="sm" onClick={() => editor?.chain().focus().toggleHighlight().run()}>
          <Highlighter size={16} />
        </Button>
        <Button type="button" variant={editor?.isActive('link') ? 'secondary' : 'ghost'} size="sm" onClick={insertLink}>
          <Link2 size={16} />
        </Button>

        <Button type="button" variant="ghost" size="sm" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <Table2 size={16} />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={insertRemoteImage}>
          <ImageIcon size={16} />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={requestLocalImage}>
          <Upload size={16} />
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="notes-editor__file-input" onChange={handleLocalImageSelected} />

        {inTable ? (
          <div className="notes-editor__table-tools">
            <Button type="button" variant="outline" size="sm" onClick={() => editor?.chain().focus().addColumnBefore().run()}>
              +Col
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => editor?.chain().focus().addRowAfter().run()}>
              +Row
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => editor?.chain().focus().deleteColumn().run()}>
              -Col
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => editor?.chain().focus().deleteRow().run()}>
              -Row
            </Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => editor?.chain().focus().deleteTable().run()}>
              <Trash2 size={14} />
              Delete table
            </Button>
          </div>
        ) : null}
      </footer>
    </div>
  )
}

export default NoteEditor
