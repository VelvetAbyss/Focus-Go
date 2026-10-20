// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findNoteCommand, NoteCommands, noteCommandKey } from './noteCommands'

let editor: Editor | undefined
let mount: HTMLElement | undefined
afterEach(() => { editor?.destroy(); mount?.remove(); editor = undefined })

const openEditor = (content: string, onKey = vi.fn(() => true)) => {
  mount = document.body.appendChild(document.createElement('div'))
  editor = new Editor({ element: mount, extensions: [StarterKit, NoteCommands.configure({ onKey })], content })
  editor.commands.setTextSelection(editor.state.doc.content.size - 1)
  return editor
}

describe('note command boundary and keyboard ownership', () => {
  it('recognises a leading Chinese command while leaving URLs and code alone', () => {
    const current = openEditor('<p>/等待</p>')
    expect(findNoteCommand(current.state)?.query).toBe('等待')
    current.commands.setContent('<p>https://example.com/task</p>')
    current.commands.setTextSelection(current.state.doc.content.size - 1)
    expect(findNoteCommand(current.state)).toBeNull()
    current.commands.setContent('<pre><code>/task</code></pre>')
    current.commands.setTextSelection(current.state.doc.content.size - 1)
    expect(findNoteCommand(current.state)).toBeNull()
  })

  it('lets composition own Enter and Escape, then dispatches a committed command', async () => {
    const onKey = vi.fn(() => true)
    const current = openEditor('<p>/任务</p>', onKey)
    current.view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }))
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }))
    expect(onKey).not.toHaveBeenCalled()
    expect(noteCommandKey.getState(current.state)?.dismissedAt).toBeNull()
    current.view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    // ProseMirror also protects Enter immediately following compositionend
    // on WebKit; test the next deliberate command after that guard expires.
    await new Promise((resolve) => setTimeout(resolve, 550))
    current.commands.setTextSelection(current.state.doc.content.size - 1)
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(onKey).toHaveBeenCalledTimes(1)
  })

  it('keeps Escape dismissal until the trigger is removed, without changing the document', () => {
    const onKey = vi.fn(() => true)
    const current = openEditor('<p>/task</p>', onKey)
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(current.getText()).toBe('/task')
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(onKey).not.toHaveBeenCalled()
    current.commands.setContent('<p></p>')
    current.commands.insertContent('/task')
    current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(onKey).toHaveBeenCalledTimes(1)
  })

  it('leaves modified Enter and selection/navigation keys to the editor', () => {
    const onKey = vi.fn(() => true)
    const current = openEditor('<p>/quote</p>', onKey)
    for (const modifier of ['shiftKey', 'ctrlKey', 'metaKey', 'altKey']) {
      current.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', [modifier]: true, bubbles: true, cancelable: true }))
    }
    expect(onKey).not.toHaveBeenCalled()
    expect(current.getHTML()).not.toContain('<blockquote>')
  })
})
