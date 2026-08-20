// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import mammoth from 'mammoth'
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
