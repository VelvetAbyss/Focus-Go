import { describe, expect, it } from 'vitest'
import { searchDocs, type SearchDoc } from './commandSearch'

const doc = (patch: Partial<SearchDoc> & Pick<SearchDoc, 'id' | 'title'>): SearchDoc => ({
  kind: 'task',
  body: '',
  updatedAt: 1,
  ...patch,
})

describe('searchDocs', () => {
  it('ranks title-prefix over title-contains over body matches, open before closed', () => {
    const hits = searchDocs(
      [
        doc({ id: 'body', title: '整理房间', body: '顺便写周报的草稿' }),
        doc({ id: 'contains', title: '本周写周报' }),
        doc({ id: 'prefix-done', title: '写周报（上周）', closed: true }),
        doc({ id: 'prefix', title: '写周报' }),
      ],
      '写周报',
    )
    expect(hits.map((hit) => hit.id)).toEqual(['prefix', 'contains', 'prefix-done', 'body'])
    expect(hits[3].snippet).toBe('顺便写周报的草稿')
  })

  it('is case-insensitive, strips markdown from snippets and caps hits per kind', () => {
    const docs = Array.from({ length: 8 }, (_, index) =>
      doc({ id: `n${index}`, kind: 'note', title: `Note ${index}`, body: '## Weekly Review - ship it', updatedAt: index }),
    )
    const hits = searchDocs(docs, 'weekly', 5)
    expect(hits).toHaveLength(5)
    expect(hits[0].id).toBe('n7')
    expect(hits[0].snippet).toBe('Weekly Review ship it')
  })

  it('returns nothing for a blank query', () => {
    expect(searchDocs([doc({ id: 'a', title: 'a' })], '   ')).toEqual([])
  })
})
