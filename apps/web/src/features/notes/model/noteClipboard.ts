import { Extension, type Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey, Selection, type SelectionBookmark } from '@tiptap/pm/state'
import { getPastedImageFiles } from '../../../shared/util/clipboard'
import { closeNoteHistory, runNoteAction } from './noteBlocks'

const pendingImages = new PluginKey<Map<symbol, SelectionBookmark>>('notePendingImages')

export const cancelPendingNoteImagePaste = (editor: Editor) => {
  const pending = pendingImages.getState(editor.state)
  const token = pending && [...pending.keys()].at(-1)
  if (!token) return false
  editor.view.dispatch(editor.state.tr.setMeta(pendingImages, { remove: token }))
  return true
}

// Spreadsheet text uses quoted cells for embedded tabs, newlines and quotes.
export const parseNoteTsv = (text: string): string[][] | null => {
  if (!text.includes('\t')) return null
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  const source = text.replace(/\r\n?/g, '\n')
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (char === '"' && (quoted || cell === '')) {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (char === '\t' || char === '\n')) {
      row.push(cell); cell = ''
      if (char === '\n') { rows.push(row); row = [] }
    } else cell += char
  }
  if (quoted) return null
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const width = rows.reduce((width, row) => Math.max(width, row.length), 0)
  if (rows.length < 2 || width < 2) return null
  return rows.map(row => [...row, ...Array<string>(width - row.length).fill('')])
}

export const NoteClipboard = Extension.create<{
  uploadImage: (file: File) => Promise<string>
  onError: () => void
}>({
  name: 'noteClipboard',
  priority: 1100,
  addOptions: () => ({ uploadImage: async () => '', onError: () => {} }),
  addProseMirrorPlugins() {
    const editor = this.editor
    let plainPaste = false
    let pastingPlain = false
    return [new Plugin<Map<symbol, SelectionBookmark>>({
      key: pendingImages,
      state: {
        init: () => new Map(),
        apply: (tr, previous) => {
          const next = new Map<symbol, SelectionBookmark>()
          for (const [token, bookmark] of previous) {
            const selection = bookmark.resolve(tr.before)
            // Do not resurrect an insertion whose whole target was removed.
            if (tr.mapping.mapResult(selection.from).deletedAcross && tr.mapping.mapResult(selection.to).deletedAcross) continue
            next.set(token, bookmark.map(tr.mapping))
          }
          const meta = tr.getMeta(pendingImages) as { add?: symbol; remove?: symbol } | undefined
          if (meta?.add) next.set(meta.add, tr.selection.getBookmark())
          if (meta?.remove) next.delete(meta.remove)
          return next
        },
      },
      props: {
        handleKeyDown: (_view, event) => {
          plainPaste = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'v'
          return false
        },
        clipboardTextSerializer: slice => slice.content.textBetween(0, slice.content.size, '\n\n', '\n').replace(/\r\n?/g, '\n'),
        handleDOMEvents: {
          paste: () => {
            pastingPlain = plainPaste
            plainPaste = false
            closeNoteHistory(editor)
            // Native rich HTML/text paste is synchronous; keep it one undo step.
            queueMicrotask(() => { pastingPlain = false; if (!editor.isDestroyed) closeNoteHistory(editor) })
            return false
          },
        },
        handlePaste: (view, event, slice) => {
          if (pastingPlain) {
            event.preventDefault()
            view.dispatch(view.state.tr.replaceSelection(slice).setMeta('preventAutolink', true).scrollIntoView())
            return true
          }
          const html = event.clipboardData?.getData('text/html') ?? ''
          // Let ProseMirror preserve HTML marks, table headers and mixed blocks.
          if (html) return false
          const images = getPastedImageFiles(event)
          if (images.length) {
            event.preventDefault()
            const token = Symbol('paste')
            view.dispatch(view.state.tr.setMeta(pendingImages, { add: token }))
            void Promise.all(images.map(file => this.options.uploadImage(file))).then(sources => {
              if (editor.isDestroyed) return
              const bookmark = pendingImages.getState(view.state)?.get(token)
              if (!bookmark) return
              const target = bookmark.resolve(view.state.doc)
              const keepCaret = view.state.selection.eq(target)
              const fragment = Fragment.fromArray(sources.map(src => editor.schema.nodes.image.create({ src })))
              closeNoteHistory(editor)
              const insertion = view.state.tr.replaceRange(target.from, target.to, new Slice(fragment, 0, 0))
              if (keepCaret) insertion.setSelection(Selection.near(insertion.doc.resolve(Math.min(insertion.mapping.map(target.to), insertion.doc.content.size)), -1))
              insertion.setMeta(pendingImages, { remove: token })
              view.dispatch(insertion)
              closeNoteHistory(editor)
            }).catch(() => {
              if (editor.isDestroyed) return
              view.dispatch(view.state.tr.setMeta(pendingImages, { remove: token }))
              this.options.onError()
            })
            return true
          }
          if (view.state.selection.$from.parent.type.spec.code || editor.isActive('table')) return false
          const rows = parseNoteTsv(event.clipboardData?.getData('text/plain') ?? '')
          if (!rows) return false
          event.preventDefault()
          return runNoteAction(editor, chain => chain.insertContent({
            type: 'table', content: rows.map(row => ({ type: 'tableRow', content: row.map(text => ({
              type: 'tableCell', content: [{ type: 'paragraph', ...(text ? { content: [{ type: 'text', text }] } : {}) }],
            })) })),
          }))
        },
      },
    })]
  },
})
