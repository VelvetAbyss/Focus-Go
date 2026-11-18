// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import mammoth from 'mammoth'
import { htmlToRichDoc, noteExportMarkdown } from './richTextCodec'
import { NoteImportError, getNoteImportFormat, parseNoteImportFile } from './noteImport'

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: vi.fn(),
    images: {
      imgElement: (handler: unknown) => handler,
    },
  },
}))

const mammothMock = vi.mocked(mammoth)

describe('noteImport', () => {
  it('detects supported import formats', () => {
    expect(getNoteImportFormat('lecture.md')).toBe('markdown')
    expect(getNoteImportFormat('lecture.markdown')).toBe('markdown')
    expect(getNoteImportFormat('lecture.txt')).toBe('text')
    expect(getNoteImportFormat('lecture.docx')).toBe('docx')
    expect(getNoteImportFormat('lecture.pdf')).toBeNull()
  })

  it('imports markdown using the first heading as the note title', async () => {
    const file = new File(['# Midterm Review\n\n- Limits\n- Integrals'], 'review.md', { type: 'text/markdown' })

    const payload = await parseNoteImportFile(file)

    expect(payload.title).toBe('Midterm Review')
    expect(payload.contentMd).toContain('- Limits')
    expect(payload.contentJson?.type).toBe('doc')
    expect(payload.warnings).toEqual([])
  })

  it('keeps nested checked and unchecked items, text color, and links through Markdown export and import', async () => {
    const rich = htmlToRichDoc('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p><a href="https://example.com"><span style="color: rgb(51, 126, 169)">Read</span></a></p><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>Next</p></div></li></ul></div></li></ul>')
    const markdown = noteExportMarkdown(rich, 'Older saved projection')
    expect(markdown).toMatch(/- \[x\] .*Read/)
    expect(markdown).toMatch(/ {2,}- \[ \] Next/)
    const imported = await parseNoteImportFile(new File([markdown], 'tasks.md'))
    expect(imported.contentJson).toEqual(rich)
  })

  it('round-trips an empty parent task and a final empty child', async () => {
    const file = new File(['- [x]\n    - [ ]'], 'empty-tasks.md')
    const result = await parseNoteImportFile(file)
    expect(result.contentJson?.content).toMatchObject([{ type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph' },
        { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: false } }] }] },
    ] }])
    const output = noteExportMarkdown(result.contentJson, '')
    expect((await parseNoteImportFile(new File([output], 'reimport.md'))).contentJson).toEqual(result.contentJson)
  })

  it('preserves ordinary bullets on both sides of a Markdown task', async () => {
    const imported = await parseNoteImportFile(new File(['- A\n- [x] B\n- C'], 'mixed.md'))
    expect(imported.contentJson?.content).toMatchObject([
      { type: 'bulletList' },
      { type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true } }] },
      { type: 'bulletList' },
    ])
  })

  it('imports txt using the filename as title and escapes markdown syntax', async () => {
    const file = new File(['# not a heading\nBring 2 pencils'], 'exam-notes.txt', { type: 'text/plain' })

    const payload = await parseNoteImportFile(file)

    expect(payload.title).toBe('exam notes')
    expect(payload.contentMd).toContain('\\# not a heading')
    expect(payload.contentJson?.type).toBe('doc')
  })

  it('imports docx through mammoth and surfaces conversion warnings', async () => {
    mammothMock.convertToHtml.mockResolvedValueOnce({
      value: '<h1>Lecture 4</h1><p>Derivatives</p>',
      messages: [{ type: 'warning', message: 'Unrecognised paragraph style' }],
    })
    const file = new File(['fake docx'], 'lecture.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    const payload = await parseNoteImportFile(file)

    expect(mammothMock.convertToHtml).toHaveBeenCalledTimes(1)
    expect(payload.title).toBe('Lecture 4')
    expect(payload.contentMd).toContain('# Lecture 4')
    expect(payload.warnings).toEqual([{ code: 'docx-conversion', message: 'Unrecognised paragraph style' }])
  })

  it('rejects unsupported files before import', async () => {
    const file = new File(['data'], 'old-report.doc', { type: 'application/msword' })

    await expect(parseNoteImportFile(file)).rejects.toMatchObject({
      code: 'unsupported-format',
    })
  })

  it('rejects oversized files', async () => {
    const file = new File(['large'], 'large.md')

    await expect(parseNoteImportFile(file, { maxFileSize: 2 })).rejects.toMatchObject({
      code: 'file-too-large',
    })
  })

  it('reports empty files as import errors', async () => {
    const file = new File(['   \n'], 'empty.md')

    await expect(parseNoteImportFile(file)).rejects.toBeInstanceOf(NoteImportError)
  })
})
