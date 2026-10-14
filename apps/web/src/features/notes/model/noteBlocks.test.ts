// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { afterEach, describe, expect, it } from 'vitest'
import { convertNoteBlock, moveCurrentNoteBlock, moveNoteBlock, NoteBlockMovement, convertWholeNoteBlock, topLevelBlocks } from './noteBlocks'
let editor: Editor
let mount: HTMLElement
const start = (content: string) => {
  mount = document.body.appendChild(document.createElement('div'))
  editor = new Editor({ element: mount, extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), NoteBlockMovement], content })
  return editor
}
afterEach(() => { editor?.destroy(); mount?.remove() })

describe('note block transactions', () => {
  it('moves a rich block intact, preserves selection, and supports exact undo/redo', () => {
    const current = start('<p>First</p><blockquote><p><strong>Second</strong></p><p>Context</p></blockquote><p>Third</p>')
    const before = current.getJSON()
    const blocks = topLevelBlocks(current.state.doc)
    current.commands.setTextSelection({ from: blocks[1].pos + 2, to: blocks[1].pos + 5 })
    expect(moveNoteBlock(current, blocks[1].pos, 0)).toBe(true)
    expect(current.getJSON().content?.[0]).toEqual(before.content?.[1])
    expect(current.state.doc.textBetween(current.state.selection.from, current.state.selection.to)).toBe('Sec')
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
    current.commands.redo()
    expect(current.getJSON().content?.[0]).toEqual(before.content?.[1])
  })
  it('rejects invalid/no-op boundaries and moves the whole nested list', () => {
    const current = start('<p>First</p><ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li><li><p>Two</p></li></ul><p>Last</p>')
    const before = current.getJSON()
    const blocks = topLevelBlocks(current.state.doc)
    expect(moveNoteBlock(current, blocks[1].pos, blocks[1].pos)).toBe(false)
    expect(moveNoteBlock(current, blocks[1].pos, blocks[1].pos + 1)).toBe(false)
    current.commands.setTextSelection(blocks[1].pos + 3)
    expect(moveCurrentNoteBlock(current, 1)).toBe(true)
    expect(current.getJSON().content?.[2]).toEqual(before.content?.[1])
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
    current.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(moveCurrentNoteBlock(current, -1)).toBe(false)
    current.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  })
  it('converts text without losing inline marks and isolates conversion from typing', () => {
    const current = start('<p><strong>Buyer</strong> response</p>')
    current.commands.setTextSelection(3)
    expect(convertNoteBlock(current, 'heading2')).toBe(true)
    expect(current.getJSON().content?.[0].type).toBe('heading')
    expect(current.getJSON().content?.[0].content?.[0].marks?.[0].type).toBe('bold')
    current.commands.undo()
    expect(current.getJSON().content?.[0].type).toBe('paragraph')
    current.commands.redo()
    expect(convertNoteBlock(current, 'taskList')).toBe(true)
    expect(current.isActive('taskList')).toBe(true)
    expect(current.getText()).toContain('Buyer response')
    current.commands.undo()
    expect(current.isActive('heading', { level: 2 })).toBe(true)
  })
  it.each([
    '<blockquote><p>One</p><p>Two</p></blockquote>',
    '<ul><li><p>One</p><ul><li><p>Nested</p></li></ul></li><li><p>Two</p></li></ul>',
  ])('converts the complete handle container and exactly restores it on undo: %s', (container) => {
    const current = start(`<p>Before</p>${container}<p>After</p>`)
    const before = current.getJSON()
    const block = topLevelBlocks(current.state.doc)[1]
    current.commands.setTextSelection(block.pos + 3)
    expect(convertWholeNoteBlock(current, block.pos, 'heading2')).toBe(true)
    expect(current.getJSON().content?.[0]).toEqual(before.content?.[0])
    expect(current.getJSON().content?.at(-1)).toEqual(before.content?.at(-1))
    expect(current.getHTML()).not.toContain('<blockquote>')
    expect(current.getHTML()).not.toContain('<ul>')
    expect(current.getText()).toContain('One')
    expect(current.getText()).toContain('Two')
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
  })

  it('retags an entire nested list while preserving nesting and inline content', () => {
    const current = start('<p>Before</p><ul><li><p><strong>One</strong></p><ul><li><p>Nested</p></li></ul></li><li><p>Two</p></li></ul><p>After</p>')
    const before = current.getJSON()
    const originalInline = current.state.doc.child(1).child(0).child(0).content
    const block = topLevelBlocks(current.state.doc)[1]
    expect(convertWholeNoteBlock(current, block.pos, 'orderedList')).toBe(true)
    const root = current.state.doc.child(1)
    expect(root.type.name).toBe('orderedList')
    expect(root.child(0).child(1).type.name).toBe('orderedList')
    expect(root.child(0).child(0).content.eq(originalInline)).toBe(true)
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
  })

  it('keeps code language and mixed nested list types when the requested type is unchanged', () => {
    const current = start('<pre><code class="language-javascript">console.log(1)</code></pre><ul><li><p>One</p><ol><li><p>Nested</p></li></ol></li></ul><p>After</p>')
    const before = current.getJSON()
    const blocks = topLevelBlocks(current.state.doc)
    expect(convertWholeNoteBlock(current, blocks[0].pos, 'codeBlock')).toBe(true)
    expect(convertWholeNoteBlock(current, blocks[1].pos, 'bulletList')).toBe(true)
    expect(current.getJSON()).toEqual(before)
  })

})
