import { describe, expect, it } from 'vitest'
import {
  buildRssEntryId,
  dedupeEntries,
  extractThumbnailUrl,
  groupEntriesByDay,
  isCacheExpired,
  markEntriesRead,
} from './rssModel'

describe('rssModel', () => {
  it('builds stable entry id from route and guid/link', () => {
    expect(buildRssEntryId('/github/trending', 'https://example.com/a')).toBe('/github/trending::https://example.com/a')
  })

  it('dedupes entries by route + guidOrLink', () => {
    const items = dedupeEntries([
      { route: '/a', guidOrLink: '1', title: 'v1' },
      { route: '/a', guidOrLink: '1', title: 'v2' },
      { route: '/a', guidOrLink: '2', title: 'v3' },
    ])

    expect(items).toHaveLength(2)
    expect(items[0]?.title).toBe('v2')
    expect(items[1]?.title).toBe('v3')
  })

  it('checks ttl expiration in minutes', () => {
    expect(isCacheExpired(undefined, 30, 1700000000000)).toBe(true)
    expect(isCacheExpired(1700000000000 - 31 * 60 * 1000, 30, 1700000000000)).toBe(true)
    expect(isCacheExpired(1700000000000 - 5 * 60 * 1000, 30, 1700000000000)).toBe(false)
  })

  it('marks entries read in batch', () => {
    const next = markEntriesRead(
      [
        { userId: 'u', entryId: 'a', readAt: 1 },
        { userId: 'u', entryId: 'b', readAt: 2 },
      ],
      'u',
      ['b', 'c'],
      9,
    )

    const byId = new Map(next.map((item) => [item.entryId, item]))
    expect(byId.get('a')?.readAt).toBe(1)
    expect(byId.get('b')?.readAt).toBe(9)
    expect(byId.get('c')?.readAt).toBe(9)
  })

  it('groups entries by today/yesterday/date buckets', () => {
    const now = new Date('2026-02-25T12:00:00.000Z').getTime()
    const entries = [
      { id: 'a', publishedAt: new Date('2026-02-25T10:00:00.000Z').getTime() },
      { id: 'b', publishedAt: new Date('2026-02-24T11:00:00.000Z').getTime() },
      { id: 'c', publishedAt: new Date('2026-02-20T11:00:00.000Z').getTime() },
    ]

    const buckets = groupEntriesByDay(entries, now)
    expect(buckets).toHaveLength(3)
    expect(buckets[0]?.type).toBe('today')
    expect(buckets[1]?.type).toBe('yesterday')
    expect(buckets[2]?.type).toBe('date')
  })

  it('extracts thumbnail url from html image tag', () => {
    const html = '<p>hello</p><img src="https://cdn.example.com/a.png" alt="a" />'
    expect(extractThumbnailUrl(html)).toBe('https://cdn.example.com/a.png')
    expect(extractThumbnailUrl('no image')).toBeNull()
  })
})
