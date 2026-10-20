// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { afterEach, describe, expect, it } from 'vitest'
import { convertNoteBlock, deleteNoteBlock, duplicateNoteBlock, duplicateSelectedNoteBlocks, moveCurrentNoteBlock, moveNoteBlock, NoteBlockMovement, convertWholeNoteBlock, topLevelBlocks, toggleNoteMark } from './noteBlocks'
let editor: Editor
let mount: HTMLElement
const start = (content: string) => {
  mount = document.body.appendChild(document.createElement('div'))
  editor = new Editor({ element: mount, extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), NoteBlockMovement], content })
  return editor
}
afterEach(() => { editor?.destroy(); mount?.remove() })

describe('note block transactions', () => {
  it('duplicates every selected top-level block, preserving their order and one-step undo', () => {
    const current = start('<p>First</p><blockquote><p><strong>Quote</strong></p></blockquote><p>Last</p>')
    const before = current.getJSON()
    const blocks = topLevelBlocks(current.state.doc)
    current.commands.setTextSelection({ from: 1, to: blocks[1].pos + 4 })
    expect(duplicateSelectedNoteBlocks(current)).toBe(true)
    expect(current.getJSON().content?.slice(2, 4)).toEqual(before.content?.slice(0, 2))
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
  })
  it('duplicates a complete nested block and deletes exactly one copy with separate undo steps', () => {
    const current = start('<p>Before</p><blockquote><p><strong>Rich</strong></p><p>Context</p></blockquote><p>After</p>')
    const before = current.getJSON()
    const block = topLevelBlocks(current.state.doc)[1]
    expect(duplicateNoteBlock(current, block.pos)).toBe(true)
    expect(current.getJSON().content?.[2]).toEqual(before.content?.[1])
    const duplicated = current.getJSON()
    expect(deleteNoteBlock(current, topLevelBlocks(current.state.doc)[2].pos)).toBe(true)
    expect(current.getJSON()).toEqual(before)
    current.commands.undo()
    expect(current.getJSON()).toEqual(duplicated)
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
    current.commands.redo()
    expect(current.getJSON()).toEqual(duplicated)
  })

  it('leaves an editable paragraph when deleting the only block and restores the exact original on undo', () => {
    const current = start('<p><strong>Only block</strong></p>')
    const before = current.getJSON()
    expect(deleteNoteBlock(current, 0)).toBe(true)
    expect(current.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(current.getText()).toBe('')
    current.commands.insertContent('New')
    current.commands.undo()
    expect(current.getText()).toBe('')
    current.commands.undo()
    expect(current.getJSON()).toEqual(before)
  })

  it('separates rapid typing and formatting so undo does not discard the typed words', () => {
    const current = start('<p>Before</p>')
    current.commands.setTextSelection(7)
    current.commands.insertContent(' typed')
    current.commands.setTextSelection({ from: 8, to: 13 })
    expect(toggleNoteMark(current, 'bold')).toBe(true)
    current.commands.undo()
    expect(current.getText()).toBe('Before typed')
    expect(current.getHTML()).not.toContain('<strong>')
    current.commands.undo()
    expect(current.getText()).toBe('Before')
  })
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
