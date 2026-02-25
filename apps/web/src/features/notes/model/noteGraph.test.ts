import { describe, expect, it } from 'vitest'
import { buildBacklinkIndex, extractWikiLinkTitles } from './noteGraph'

describe('noteGraph', () => {
  it('extracts unique wiki link titles in order', () => {
    const titles = extractWikiLinkTitles('Start [[Project X]] then [[Meeting Notes]] then [[Project X]]')

    expect(titles).toEqual(['Project X', 'Meeting Notes'])
  })

  it('builds backlinks by title matching', () => {
    const notes = [
      { id: '1', title: 'Project X', contentMd: 'See [[Meeting Notes]]', deletedAt: null },
      { id: '2', title: 'Meeting Notes', contentMd: 'Follow [[Project X]]', deletedAt: null },
      { id: '3', title: 'Archive', contentMd: 'No links', deletedAt: 100 },
    ]

    const index = buildBacklinkIndex(notes)

    expect(index.get('1')).toEqual(['2'])
    expect(index.get('2')).toEqual(['1'])
    expect(index.get('3')).toEqual([])
  })
})
