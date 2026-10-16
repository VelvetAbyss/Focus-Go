import { Extension, type Editor, type ChainedCommands } from '@tiptap/core'
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Selection, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { yUndoPluginKey } from '@tiptap/y-tiptap'

type ActionSnapshot = { doc: ProseMirrorNode; selection: Record<string, unknown> }
type ActionHistory = { before: ActionSnapshot; after: ActionSnapshot }
const pendingAction = new WeakMap<Editor, ActionSnapshot>()
const historyEditors = new WeakSet<Editor>()
const actionSelectionKey = Symbol('focusgo-note-action-selection')
const snapshot = (editor: Editor): ActionSnapshot => ({ doc: editor.state.doc, selection: editor.state.selection.toJSON() })

const restoreActionSelection = (editor: Editor, selection: Record<string, unknown>) => {
  try {
    const next = Selection.fromJSON(editor.state.doc, selection)
    if (!editor.state.selection.eq(next)) editor.view.dispatch(editor.state.tr.setSelection(next))
  } catch { /* A schema repair may invalidate the intended selection. */ }
}

export const runNoteAction = (editor: Editor, action: (chain: ChainedCommands) => ChainedCommands, isolateHistory = true) => {
  if (isolateHistory) closeNoteHistory(editor)
  let selection: Record<string, unknown> | undefined
  const result = action(editor.chain().focus()).command(({ tr }) => {
    selection = tr.selection.toJSON()
    return true
  }).run()
  if (selection) restoreActionSelection(editor, selection)
  if (isolateHistory) closeNoteHistory(editor)
  return result
}

/** Keep explicit action boundaries in both standalone and CRDT history. */
export const closeNoteHistory = (editor: Editor) => {
  const manager = yUndoPluginKey.getState(editor.state)?.undoManager
  if (manager) {
    if (!historyEditors.has(editor)) {
      historyEditors.add(editor)
      let pendingTransfer: ActionHistory | undefined
      const remember = ({ stackItem, origin }: { stackItem: { meta: Map<unknown, unknown> }; origin: unknown }) => {
        if (origin === manager) {
          const action = manager.currStackItem?.meta.get(actionSelectionKey) ?? pendingTransfer
          if (action) stackItem.meta.set(actionSelectionKey, action)
        }
        pendingTransfer = undefined
      }
      const restore = ({ stackItem, type }: { stackItem: { meta: Map<unknown, unknown> }; type: 'undo' | 'redo' }) => {
        const action = stackItem.meta.get(actionSelectionKey) as ActionHistory | undefined
        if (!action) return
        // Structural history in y-tiptap may create the reverse stack item
        // after this event, inside its outer position-migration transaction.
        pendingTransfer = action
        const target = type === 'undo' ? action.before : action.after
        queueMicrotask(() => {
          // Absolute action positions are safe only when the exact document
          // has returned. Concurrent edits retain the binding's relative caret.
          if (!editor.isDestroyed && editor.state.doc.eq(target.doc)) {
            editor.view.dispatch(editor.state.tr.setSelection(Selection.fromJSON(editor.state.doc, target.selection)))
          }
        })
      }
      manager.on('stack-item-added', remember)
      manager.on('stack-item-popped', restore)
      editor.on('destroy', () => {
        manager.off('stack-item-added', remember)
        manager.off('stack-item-popped', restore)
      })
    }
    const before = pendingAction.get(editor)
    if (before && !editor.state.doc.eq(before.doc)) {
      manager.undoStack.at(-1)?.meta.set(actionSelectionKey, { before, after: snapshot(editor) })
      pendingAction.delete(editor)
    } else pendingAction.set(editor, snapshot(editor))
    manager.stopCapturing()
  }
  editor.view.dispatch(closeHistory(editor.state.tr))
}

export const NOTE_BLOCK_TYPES = ['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList', 'taskList', 'quote', 'codeBlock'] as const
export type NoteBlockType = typeof NOTE_BLOCK_TYPES[number]
export const noteBlockLabels = {
  paragraph: 'notes.block.paragraph', heading1: 'notes.headingDropdown.h1', heading2: 'notes.headingDropdown.h2', heading3: 'notes.headingDropdown.h3',
  bulletList: 'notes.block.bulletList', orderedList: 'notes.block.orderedList', taskList: 'notes.block.taskList', quote: 'notes.command.quote', codeBlock: 'notes.block.codeBlock',
} as const

export const currentBlockType = (editor: Editor): NoteBlockType => {
  for (const type of ['taskList', 'bulletList', 'orderedList', 'codeBlock'] as const) if (editor.isActive(type)) return type
  if (editor.isActive('blockquote')) return 'quote'
  for (const level of [1, 2, 3] as const) if (editor.isActive('heading', { level })) return `heading${level}`
  return 'paragraph'
}

export const applyNoteBlockType = (chain: ChainedCommands, type: NoteBlockType): ChainedCommands => {
  chain = chain.clearNodes()
  if (type === 'paragraph') chain = chain.setParagraph()
  else if (type.startsWith('heading')) chain = chain.setHeading({ level: Number(type.slice(-1)) as 1 | 2 | 3 })
  else if (type === 'bulletList') chain = chain.toggleBulletList()
  else if (type === 'orderedList') chain = chain.toggleOrderedList()
  else if (type === 'taskList') chain = chain.toggleTaskList()
  else if (type === 'quote') chain = chain.setBlockquote()
  else if (type === 'codeBlock') chain = chain.setCodeBlock()
  return chain
}

export const convertNoteBlock = (editor: Editor, type: NoteBlockType, isolateHistory = true) => {
  if (editor.view.composing || !editor.state.selection.$from.parent.isTextblock || editor.isActive('table')) return false
  if (currentBlockType(editor) === type) return true
  return runNoteAction(editor, chain => applyNoteBlockType(chain, type), isolateHistory)
}

export type NoteBlock = { pos: number; node: ProseMirrorNode }
export const topLevelBlocks = (doc: ProseMirrorNode): NoteBlock[] => {
  const blocks: NoteBlock[] = []
  doc.forEach((node, pos) => blocks.push({ node, pos }))
  return blocks
}

/** Convert a complete container; TipTap clearNodes only reliably covers simple selections. */
export const convertWholeNoteBlock = (editor: Editor, pos: number, type: NoteBlockType): boolean => {
  if (editor.view.composing || !editor.isEditable) return false
  const source = topLevelBlocks(editor.state.doc).find((block) => block.pos === pos)?.node
  if (!source || !['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'taskList', 'codeBlock'].includes(source.type.name)) return false
  const nodeType = type === 'quote' ? 'blockquote' : type.startsWith('heading') ? 'heading' : type
  if (source.type.name === nodeType && (nodeType !== 'heading' || source.attrs.level === Number(type.slice(-1)))) {
    editor.commands.focus()
    return true
  }
  const { schema } = editor.state
  const listNames = ['bulletList', 'orderedList', 'taskList']
  const leaves: ProseMirrorNode[] = []
  const flatten = (node: ProseMirrorNode) => {
    if (node.isTextblock || !['blockquote', ...listNames, 'listItem', 'taskItem'].includes(node.type.name)) leaves.push(node)
    else node.forEach(flatten)
  }
  const paragraph = (node: ProseMirrorNode) => schema.nodes.paragraph.create(node.attrs, node.content)
  const retagList = (node: ProseMirrorNode): ProseMirrorNode => {
    const children: ProseMirrorNode[] = []
    node.forEach((child) => children.push(retagList(child)))
    if (listNames.includes(node.type.name)) return schema.nodes[type].create(node.attrs, children)
    if (['listItem', 'taskItem'].includes(node.type.name)) return schema.nodes[type === 'taskList' ? 'taskItem' : 'listItem'].create(node.attrs, children)
    return node.copy(Fragment.fromArray(children))
  }
  let replacement: ProseMirrorNode[]
  if (type === 'quote') replacement = [source.type.name === 'blockquote' ? source : schema.nodes.blockquote.create(null, source)]
  else if (listNames.includes(type) && listNames.includes(source.type.name)) replacement = [retagList(source)]
  else {
    flatten(source)
    if (listNames.includes(type)) {
      const item = schema.nodes[type === 'taskList' ? 'taskItem' : 'listItem']
      replacement = [schema.nodes[type].create(null, leaves.map((leaf) => item.create(null,
        leaf.isTextblock ? paragraph(leaf) : [schema.nodes.paragraph.create(), leaf],
      ))) ]
    } else replacement = leaves.map((leaf) => {
      if (!leaf.isTextblock) return leaf
      if (type === 'paragraph') return paragraph(leaf)
      if (type === 'codeBlock') {
        const text = leaf.textBetween(0, leaf.content.size, '\n', '\n')
        return schema.nodes.codeBlock.create(null, text ? schema.text(text) : undefined)
      }
      return schema.nodes.heading.create({ ...leaf.attrs, level: Number(type.slice(-1)) }, leaf.content)
    })
  }
  // Validate before touching the live document, including embedded non-text blocks.
  try { replacement.forEach((node) => node.check()) } catch { return false }
  if (replacement.length === 1 && replacement[0].eq(source)) { editor.commands.focus(); return true }
  const fragment = Fragment.fromArray(replacement)
  closeNoteHistory(editor)
  const transaction = closeHistory(editor.state.tr).replaceWith(pos, pos + source.nodeSize, fragment)
  transaction.setSelection(TextSelection.between(transaction.doc.resolve(pos + 1), transaction.doc.resolve(pos + fragment.size - 1)))
  const intendedSelection = transaction.selection.toJSON()
  editor.view.dispatch(transaction.scrollIntoView())
  restoreActionSelection(editor, intendedSelection)
  closeNoteHistory(editor)
  editor.commands.focus()
  return true
}

/** Move a complete top-level block to a document boundary in one undoable transaction. */
export const moveNoteBlock = (editor: Editor, sourcePos: number, boundary: number): boolean => {
  if (editor.view.composing || !editor.isEditable) return false
  const blocks = topLevelBlocks(editor.state.doc)
  const source = blocks.find((block) => block.pos === sourcePos)
  if (!source || ![...blocks.map((block) => block.pos), editor.state.doc.content.size].includes(boundary)) return false
  const end = source.pos + source.node.nodeSize
  if (boundary >= source.pos && boundary <= end) return false
  const selection = editor.state.selection
  const offset = selection.from >= source.pos && selection.to <= end ? selection.from - source.pos : 1
  const extent = selection.from >= source.pos && selection.to <= end ? selection.to - selection.from : 0
  const destination = boundary > end ? boundary - source.node.nodeSize : boundary
  closeNoteHistory(editor)
  const transaction = closeHistory(editor.state.tr).delete(source.pos, end).insert(destination, source.node)
  const from = Math.min(destination + offset, transaction.doc.content.size)
  const to = Math.min(from + extent, transaction.doc.content.size)
  transaction.setSelection(TextSelection.between(transaction.doc.resolve(from), transaction.doc.resolve(to)))
  const intendedSelection = transaction.selection.toJSON()
  editor.view.dispatch(transaction.scrollIntoView())
  restoreActionSelection(editor, intendedSelection)
  closeNoteHistory(editor)
  editor.commands.focus()
  return true
}

export const moveCurrentNoteBlock = (editor: Editor, direction: -1 | 1) => {
  const { $from } = editor.state.selection
  if (!$from.depth) return false
  const blocks = topLevelBlocks(editor.state.doc)
  const index = blocks.findIndex((block) => block.pos === $from.before(1))
  if (index < 0 || index + direction < 0 || index + direction >= blocks.length) return false
  return moveNoteBlock(editor, blocks[index].pos, direction === -1 ? blocks[index - 1].pos : blocks[index + 1].pos + blocks[index + 1].node.nodeSize)
}

export const NoteBlockMovement = Extension.create({
  name: 'focusgoNoteBlockMovement',
  addKeyboardShortcuts() {
    return {
      'Alt-Shift-ArrowUp': () => moveCurrentNoteBlock(this.editor, -1),
      'Alt-Shift-ArrowDown': () => moveCurrentNoteBlock(this.editor, 1),
    }
  },
})
