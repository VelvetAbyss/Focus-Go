import { describe, expect, it } from 'vitest'
import type { DiaryEntry } from '../../data/models/types'
import { monthAgoDateKey, pickMonthAgoEntry } from './monthAgo'

const entry = (id: string, dateKey: string, contentMd: string, entryAt = 1, deletedAt: number | null = null): DiaryEntry => ({
  id, dateKey, contentMd, entryAt, tags: [], deletedAt, createdAt: 1, updatedAt: 1,
})

describe('monthAgoDateKey', () => {
  it('steps back one calendar month', () => {
    expect(monthAgoDateKey('2026-10-10')).toBe('2026-09-10')
    expect(monthAgoDateKey('2026-01-15')).toBe('2025-12-15')
  })

  it('has no answer when last month lacked the day', () => {
    expect(monthAgoDateKey('2026-03-31')).toBeNull()
    expect(monthAgoDateKey('2026-10-31')).toBeNull()
  })
})

describe('pickMonthAgoEntry', () => {
  it('picks the earliest written entry of that day, skipping blank and deleted ones', () => {
    const entries = [
      entry('late', '2026-09-10', '晚上又改了报价', 300),
      entry('blank', '2026-09-10', '   ', 100),
      entry('gone', '2026-09-10', '删掉的', 50, 123),
      entry('early', '2026-09-10', '早上去了展会', 200),
      entry('other', '2026-09-11', '第二天', 10),
    ]
    expect(pickMonthAgoEntry(entries, '2026-10-10')?.id).toBe('early')
  })

  it('returns null when nothing was written', () => {
    expect(pickMonthAgoEntry([entry('x', '2026-09-09', '前一天')], '2026-10-10')).toBeNull()
  })
})
