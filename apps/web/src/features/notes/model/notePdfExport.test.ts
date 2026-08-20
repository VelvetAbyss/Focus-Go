// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { attachNotePdfExportElement, buildNotePdfBodyHtml, buildNotePdfFileName, createNotePdfExportElement } from './notePdfExport'

describe('notePdfExport', () => {
  it('builds export html from Tiptap JSON when available', () => {
    const html = buildNotePdfBodyHtml({
      title: 'JSON note',
      contentMd: 'Fallback copy',
      contentJson: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'JSON body' }] }],
      },
    })

    expect(html).toContain('JSON body')
    expect(html).not.toContain('Fallback copy')
  })

  it('falls back to markdown-derived content when JSON is missing', () => {
    const element = createNotePdfExportElement({
      title: 'Markdown note',
      contentMd: '# Markdown title\n\n**Bold** copy',
      contentJson: null,
    })

    expect(element.textContent).toContain('Markdown title')
    expect(element.querySelector('strong')?.textContent).toBe('Bold')
  })

  it('uses a sanitized pdf filename from the note title', () => {
    expect(buildNotePdfFileName(' Design Doc  V1 ')).toBe('design-doc-v1.pdf')
    expect(buildNotePdfFileName('')).toBe('untitled.pdf')
  })

  it('attaches the export element inside the viewport so html2canvas can paint it', () => {
    const element = createNotePdfExportElement({
      title: 'Visible export',
      contentMd: 'Body',
      contentJson: null,
    })

    attachNotePdfExportElement(element)

    expect(element.style.position).toBe('fixed')
    expect(element.style.left).toBe('0px')
    expect(element.style.top).toBe('0px')
    expect(element.style.opacity).toBe('')
    expect(element.style.visibility).toBe('')
    expect(document.body.contains(element)).toBe(true)

    element.remove()
  })
})
