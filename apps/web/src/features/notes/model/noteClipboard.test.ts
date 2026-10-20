// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRichTextExtensions } from './richTextExtensions'
import { cancelPendingNoteImagePaste, NoteClipboard, parseNoteTsv } from './noteClipboard'

let editor: Editor
let mount: HTMLElement
afterEach(() => { editor?.destroy(); mount?.remove() })
const start = (content: string, uploadImage = async () => 'data:image/png;base64,AA==', onError = vi.fn()) => {
  mount = document.body.appendChild(document.createElement('div'))
  editor = new Editor({ element: mount, extensions: [...createRichTextExtensions(), NoteClipboard.configure({ uploadImage, onError })], content })
  return editor
}
const paste = (text = '', html = '', images: File[] = []) => {
  const event = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: { getData: (type: string) => type === 'text/html' ? html : type === 'text/plain' ? text : '',
    files: images, items: images.map(file => ({ type: file.type, getAsFile: () => file })),
  } })
  editor.view.dom.dispatchEvent(event)
}

describe('note clipboard flows', () => {
  it('preserves quoted spreadsheet cells, trailing empty columns and empty rows', () => {
    expect(parseNoteTsv('Name\tValue\t\n"two\twords"\t"line 1\nline 2"\t\n\t\t\n')).toEqual([
      ['Name', 'Value', ''], ['two\twords', 'line 1\nline 2', ''], ['', '', ''],
    ])
    expect(parseNoteTsv('Ordinary, prose\nMore prose')).toBeNull()
  })

  it('replaces the selected text with a table and undoes the paste in one step', async () => {
    start('<p>Replace me</p><p>Leave me</p>')
    const before = editor.getJSON()
    editor.commands.setTextSelection({ from: 1, to: 11 })
    paste('a\tb\n1\t2')
    expect(editor.getText()).not.toContain('Replace me')
    expect(editor.getHTML()).toContain('<table')
    expect(editor.getText()).toContain('Leave me')
    await Promise.resolve()
    editor.commands.undo()
    expect(editor.getJSON()).toEqual(before)
    editor.commands.redo()
    expect(editor.getHTML()).toContain('<table')
  })

  it('keeps rich table headers, inline colors and surrounding content through native paste', () => {
    start('<p></p>')
    editor.commands.setTextSelection(1)
    paste('Heading\na\tb', '<h2>Heading</h2><table><tr><th><strong>A</strong></th><th>B</th></tr><tr><td><span style="color:#d44c47">Red</span></td><td>Cell</td></tr></table><p>After</p>')
    expect(editor.getHTML()).toContain('<h2>Heading</h2>')
    expect(editor.getHTML()).toContain('<th')
    expect(editor.getHTML()).toContain('<strong>A</strong>')
    expect(editor.getHTML()).toContain('color: rgb(212, 76, 71)')
    expect(editor.getText()).toContain('After')
  })

  it('pastes tabs as code inside a code block', () => {
    start('<pre><code></code></pre>')
    editor.commands.setTextSelection(1)
    paste('a\tb\n1\t2')
    expect(editor.state.doc.firstChild?.textContent).toBe('a\tb\n1\t2')
    expect(editor.getHTML()).not.toContain('<table')
  })

  it('respects paste-without-formatting instead of converting spreadsheet text into a table', () => {
    start('<p></p>')
    editor.commands.setTextSelection(1)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
    paste('a\tb\n1\t2')
    expect(editor.getHTML()).not.toContain('<table')
    expect(editor.getText()).toContain('a\tb')
    editor.commands.selectAll()
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
    paste('https://example.com/plain')
    expect(editor.getHTML()).not.toContain('<a ')
    expect(editor.getText()).toContain('https://example.com/plain')
  })

  it('anchors async images to their original selection without stealing a later caret or external focus', async () => {
    let resolve!: (src: string) => void
    start('<p>Replace me</p><p>Keep typing</p>', () => new Promise<string>(done => { resolve = done }))
    editor.commands.setTextSelection({ from: 1, to: 11 })
    paste('', '', [new File(['image'], 'sample.png', { type: 'image/png' })])
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.insertContent(' X')
    const input = document.body.appendChild(document.createElement('input'))
    input.focus()
    resolve('data:image/png;base64,AA==')
    await vi.waitFor(() => expect(editor.getHTML()).toContain('<img'))
    expect(editor.getText()).not.toContain('Replace me')
    expect(editor.getText()).toContain('Keep typing X')
    expect(document.activeElement).toBe(input)
    editor.commands.undo()
    expect(editor.getText()).toContain('Replace me')
    expect(editor.getText()).toContain('Keep typing X')
    input.remove()
  })

  it('keeps the original text when image reading fails', async () => {
    const onError = vi.fn()
    start('<p>Original</p>', async () => { throw new Error('read failed') }, onError)
    editor.commands.selectAll()
    paste('', '', [new File(['image'], 'sample.png', { type: 'image/png' })])
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(editor.getText()).toBe('Original')
    expect(editor.getHTML()).not.toContain('<img')
  })

  it('cancels a pending paste before undoing earlier text, so delayed images never reappear', async () => {
    let resolve!: (src: string) => void
    start('<p>Original</p>', () => new Promise<string>(done => { resolve = done }))
    editor.commands.selectAll()
    paste('', '', [new File(['image'], 'sample.png', { type: 'image/png' })])
    expect(cancelPendingNoteImagePaste(editor)).toBe(true)
    resolve('data:image/png;base64,AA==')
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(editor.getText()).toBe('Original')
    expect(editor.getHTML()).not.toContain('<img')
    expect(cancelPendingNoteImagePaste(editor)).toBe(false)
  })

  it('retains blank lines and significant trailing spaces when copying code', () => {
    start('<pre><code>one  \n\n\nlast  </code></pre>')
    const slice = editor.state.doc.slice(1, editor.state.doc.content.size - 1)
    const copied = editor.view.someProp('clipboardTextSerializer', serialize => serialize(slice, editor.view))
    expect(copied).toBe('one  \n\n\nlast  ')
  })
})
