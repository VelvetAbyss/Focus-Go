import { describe, expect, it } from 'vitest'
import type { NoteEntity } from '../../../data/models/types'
import { extractHashTagsFromMarkdown, filterNotesByTagAndKeyword, mergeTags, normalizeTag } from './tags'

const makeNote = (overrides: Partial<NoteEntity>): NoteEntity => ({
  id: 'note-1',
  createdAt: 1,
  updatedAt: 1,
  title: 'Untitled',
  contentMd: '',
  contentJson: null,
  manualTags: [],
  tags: [],
  linkedNoteIds: [],
  backlinks: [],
  deletedAt: null,
  expiresAt: null,
  ...overrides,
})

describe('tags utilities', () => {
  it('normalizes tags and strips invalid characters', () => {
    expect(normalizeTag('  ##Project-2026! ')).toBe('Project-2026')
  })

  it('extracts hashtag tokens from markdown', () => {
    expect(extractHashTagsFromMarkdown('Plan #Project with #Roadmap and #项目')).toEqual(['Project', 'Roadmap', '项目'])
  })

  it('merges manual and auto tags with case-insensitive dedupe', () => {
    expect(mergeTags(['Project', 'Urgent'], ['project', 'Client'])).toEqual(['Project', 'Urgent', 'Client'])
  })

  it('filters notes by single tag and keyword using AND', () => {
    const notes = [
      makeNote({ id: 'a', title: 'Roadmap', contentMd: 'Contains #Project scope', tags: ['Project'] }),
      makeNote({ id: 'b', title: 'Shopping', contentMd: 'No relation', tags: ['Personal'] }),
    ]

    const output = filterNotesByTagAndKeyword(notes, { selectedTag: 'project', keyword: 'scope' })
    expect(output.map((item) => item.id)).toEqual(['a'])
  })
})

