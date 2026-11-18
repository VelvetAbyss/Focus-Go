import { describe, expect, it } from 'vitest'
import { deriveEditedNoteTitle, getNoteListText } from './noteListText'

describe('note list presentation', () => {
  it('shows a first-line title for an existing untitled note and keeps the full searchable body', () => {
    const text = 'Plain heading\n\n' + 'word '.repeat(70) + 'late match'
    const result = getNoteListText({ title: '', contentMd: text, excerpt: text.slice(0, 140) }, 'en')
    expect(result.title).toBe('Plain heading')
    expect(result.excerpt).not.toContain('Plain heading')
    expect(result.text).toContain('late match')
  })

  it('reads old HTML table and truncated image previews without exposing markup', () => {
    const image = getNoteListText({ title: 'Picture', contentMd: '', excerpt: '![](data:image/png;base64,AAAA…' }, 'zh')
    expect(image.excerpt).toBe('图片')
    const table = getNoteListText({ title: 'Travel', contentMd: '<table><tr><td>Milan</td><td>Monday</td></tr></table>', excerpt: '' }, 'en')
    expect(table.excerpt).toContain('Milan Monday')
    expect(table.excerpt).not.toContain('<')
  })

  it('updates a derived title on edit and preserves an explicitly named plain document', () => {
    expect(deriveEditedNoteTitle('Revised\nbody', { title: 'First', contentMd: 'First\nbody' }, 'en')).toBe('Revised')
    expect(deriveEditedNoteTitle('Revised\nbody', { title: 'Imported minutes', contentMd: 'First\nbody' }, 'en')).toBe('Imported minutes')
    expect(deriveEditedNoteTitle('# New heading\nbody', { title: 'First', contentMd: 'First\nbody' }, 'en')).toBe('New heading')
  })
})
