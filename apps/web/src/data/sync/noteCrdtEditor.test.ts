// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import Collaboration from '@tiptap/extension-collaboration'
import { ySyncPluginKey } from '@tiptap/y-tiptap'
import { describe, expect, it } from 'vitest'
import { createRichTextExtensions } from '../../features/notes/model/richTextExtensions'
import { applyNoteCrdt, createNoteCrdt, encodeNoteCrdt } from './noteCrdt'
import { convertNoteBlock, moveNoteBlock, topLevelBlocks } from '../../features/notes/model/noteBlocks'

describe('real TipTap Yjs editor binding', () => {
  it('returns the caret to the moved block after undo and redo', async () => {
    const doc = createNoteCrdt({ type: 'doc', content: ['First', 'Second'].map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) })
    const extensions = createRichTextExtensions()
    extensions[0] = extensions[0].configure({ undoRedo: false })
    const editor = new Editor({ element: document.createElement('div'), extensions: [...extensions, Collaboration.configure({ document: doc })] })
    editor.commands.setTextSelection(1)
    moveNoteBlock(editor, topLevelBlocks(editor.state.doc)[1].pos, 0)
    editor.commands.undo(); await Promise.resolve()
    editor.commands.redo(); await Promise.resolve()
    expect(editor.state.selection.$from.parent.textContent).toBe('Second')
    editor.destroy(); doc.destroy()
  })
  it('keeps rapid format and block conversions as separate undo actions', () => {
    const doc = createNoteCrdt({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First paragraph' }] }] })
    const extensions = createRichTextExtensions()
    extensions[0] = extensions[0].configure({ undoRedo: false })
    const editor = new Editor({ element: document.createElement('div'), extensions: [...extensions, Collaboration.configure({ document: doc })] })
    editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 })
    editor.commands.toggleBold()
    expect(convertNoteBlock(editor, 'heading2')).toBe(true)
    editor.commands.undo()
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: 'paragraph', content: [{ type: 'text', text: 'First paragraph', marks: [{ type: 'bold' }] }] })
    editor.commands.undo()
    expect(editor.getJSON().content?.[0].content?.[0].marks).toBeUndefined()
    editor.destroy(); doc.destroy()
  })
  it('merges two editor transactions and keeps undo scoped to the editing device', () => {
    const initial = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }] }
    const a = createNoteCrdt(initial)
    const b = createNoteCrdt(initial)
    const makeEditor = (doc: typeof a) => {
      const extensions = createRichTextExtensions()
      extensions[0] = extensions[0].configure({ undoRedo: false })
      return new Editor({ element: document.createElement('div'), extensions: [...extensions, Collaboration.configure({ document: doc })] })
    }
    const first = makeEditor(a)
    const second = makeEditor(b)
    const events: Array<{ isChangeOrigin?: boolean; isUndoRedoOperation?: boolean }> = []
    first.on('update', ({ transaction }) => { events.push(transaction.getMeta(ySyncPluginKey) ?? {}) })
    first.commands.insertContentAt(1, 'A ')
    second.commands.insertContentAt(6, ' B')
    applyNoteCrdt(a, encodeNoteCrdt(b))
    applyNoteCrdt(b, encodeNoteCrdt(a))
    expect(first.getText()).toBe('A Hello B')
    expect(second.getJSON()).toEqual(first.getJSON())
    first.commands.undo()
    expect(first.getText()).toBe('Hello B')
    expect(events.at(-1)).toMatchObject({ isChangeOrigin: true, isUndoRedoOperation: true })
    first.destroy(); second.destroy(); a.destroy(); b.destroy()
  })
})
