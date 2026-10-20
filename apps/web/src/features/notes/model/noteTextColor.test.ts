// @vitest-environment jsdom
import { Editor } from '@tiptap/core'
import { generateHTML } from '@tiptap/html'
import { describe, expect, it } from 'vitest'
import { createRichTextExtensions } from './richTextExtensions'
import { htmlToRichDoc, richDocToMarkdown } from './richTextCodec'
import { createNoteCrdt, noteCrdtProjection } from '../../../data/sync/noteCrdt'

describe('note text color', () => {
  it('colors only selected text, supports undo/redo and restores the inherited color', () => {
    const editor = new Editor({ extensions: createRichTextExtensions(), content: '<p>Hello world</p>' })
    try {
      editor.commands.setTextSelection({ from: 1, to: 6 })
      editor.commands.setColor('#d44c47')
      expect(editor.getHTML()).toContain('<span style="color: rgb(212, 76, 71);">Hello</span> world')
      editor.commands.undo()
      expect(editor.getHTML()).toBe('<p>Hello world</p>')
      editor.commands.redo()
      expect(editor.getAttributes('textStyle').color).toBe('#d44c47')
      editor.commands.unsetColor()
      expect(editor.getHTML()).toBe('<p>Hello world</p>')
    } finally { editor.destroy() }
  })

  it('preserves color through HTML import, JSON reload and CRDT snapshot projection without losing markdown text', () => {
    const content = htmlToRichDoc('<p><span style="color: #d44c47">Colored</span> text</p>')
    const doc = createNoteCrdt(content)
    const restored = createNoteCrdt(content, noteCrdtProjection(doc).crdtState)
    try {
      const projected = noteCrdtProjection(restored).contentJson
      expect(projected).toEqual(content)
      expect(generateHTML(projected, createRichTextExtensions())).toContain('color: #d44c47')
      expect(richDocToMarkdown(projected)).toBe('Colored text')
    } finally { doc.destroy(); restored.destroy() }
  })
})
