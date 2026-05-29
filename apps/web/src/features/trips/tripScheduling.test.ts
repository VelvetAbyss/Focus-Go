import { describe, expect, it } from 'vitest'
import type { TripItineraryDay, TripItineraryItem } from '../../data/models/types'
import {
  computeGaps,
  detectConflicts,
  getItemBounds,
  minutesToHHMM,
  moveItem,
  parseHHMM,
  sortDayByTime,
} from './tripScheduling'

const item = (id: string, fields: Partial<TripItineraryItem> = {}): TripItineraryItem => ({
  id,
  title: id,
  time: '',
  location: '',
  type: 'spot',
  ...fields,
})

const day = (num: number, items: TripItineraryItem[]): TripItineraryDay => ({
  day: num,
  date: '2026-04-18',
  label: `Day ${num}`,
  items,
})

describe('parseHHMM', () => {
  it('parses valid times', () => {
    expect(parseHHMM('09:30')).toBe(570)
    expect(parseHHMM('00:00')).toBe(0)
    expect(parseHHMM('23:59')).toBe(23 * 60 + 59)
  })
  it('rejects invalid', () => {
    expect(parseHHMM('')).toBeNull()
    expect(parseHHMM(undefined)).toBeNull()
    expect(parseHHMM('25:00')).toBeNull()
    expect(parseHHMM('9:5')).toBeNull()
  })
})

describe('minutesToHHMM', () => {
  it('round-trips', () => {
    expect(minutesToHHMM(570)).toBe('09:30')
    expect(minutesToHHMM(0)).toBe('00:00')
  })
})

describe('getItemBounds', () => {
  it('uses startTime/endTime when present', () => {
    const b = getItemBounds(item('a', { startTime: '09:00', endTime: '10:30' }))
    expect(b.startMin).toBe(540)
    expect(b.endMin).toBe(630)
  })
  it('falls back to legacy time field', () => {
    const b = getItemBounds(item('a', { time: '14:00 – 16:00' }))
    expect(b.startMin).toBe(14 * 60)
    expect(b.endMin).toBe(16 * 60)
  })
  it('uses durationMin if endTime missing', () => {
    const b = getItemBounds(item('a', { startTime: '09:00', durationMin: 90 }))
    expect(b.endMin).toBe(540 + 90)
  })
  it('returns nulls when nothing set', () => {
    const b = getItemBounds(item('a'))
    expect(b.startMin).toBeNull()
    expect(b.endMin).toBeNull()
  })
})

describe('detectConflicts', () => {
  it('flags overlap', () => {
    const d = day(1, [
      item('a', { startTime: '09:00', endTime: '11:00' }),
      item('b', { startTime: '10:00', endTime: '12:00' }),
    ])
    const conflicts = detectConflicts(d)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ a: 'a', b: 'b', overlapMin: 60 })
  })
  it('no conflict for adjacent', () => {
    const d = day(1, [
      item('a', { startTime: '09:00', endTime: '10:00' }),
      item('b', { startTime: '10:00', endTime: '11:00' }),
    ])
    expect(detectConflicts(d)).toEqual([])
  })
  it('ignores items without start', () => {
    const d = day(1, [item('a'), item('b', { startTime: '09:00', endTime: '10:00' })])
    expect(detectConflicts(d)).toEqual([])
  })
  it('treats missing end as +60min', () => {
    const d = day(1, [
      item('a', { startTime: '09:00' }),
      item('b', { startTime: '09:30', endTime: '10:00' }),
    ])
    expect(detectConflicts(d)).toHaveLength(1)
  })
})

describe('computeGaps', () => {
  it('flags tight gap', () => {
    const d = day(1, [
      item('a', { startTime: '09:00', endTime: '10:00' }),
      item('b', { startTime: '10:05', endTime: '11:00' }),
    ])
    const gaps = computeGaps(d)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].severity).toBe('tight')
    expect(gaps[0].gapMin).toBe(5)
  })
  it('flags large gap', () => {
    const d = day(1, [
      item('a', { startTime: '09:00', endTime: '10:00' }),
      item('b', { startTime: '15:00', endTime: '16:00' }),
    ])
    const gaps = computeGaps(d)
    expect(gaps[0].severity).toBe('large')
  })
  it('ignores normal gap', () => {
    const d = day(1, [
      item('a', { startTime: '09:00', endTime: '10:00' }),
      item('b', { startTime: '11:00', endTime: '12:00' }),
    ])
    expect(computeGaps(d)).toEqual([])
  })
})

describe('moveItem', () => {
  it('reorders within a day', () => {
    const days = [day(1, [item('a'), item('b'), item('c')])]
    const next = moveItem(days, { dayNum: 1, itemId: 'a' }, { dayNum: 1, index: 1 })
    expect(next[0].items.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })
  it('moves cross-day', () => {
    const days = [day(1, [item('a'), item('b')]), day(2, [item('c')])]
    const next = moveItem(days, { dayNum: 1, itemId: 'a' }, { dayNum: 2, index: 0 })
    expect(next[0].items.map((i) => i.id)).toEqual(['b'])
    expect(next[1].items.map((i) => i.id)).toEqual(['a', 'c'])
  })
  it('returns input when source missing', () => {
    const days = [day(1, [item('a')])]
    expect(moveItem(days, { dayNum: 1, itemId: 'zzz' }, { dayNum: 1, index: 0 })).toBe(days)
  })
  it('clamps index past end', () => {
    const days = [day(1, [item('a'), item('b')])]
    const next = moveItem(days, { dayNum: 1, itemId: 'a' }, { dayNum: 1, index: 99 })
    expect(next[0].items.map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('sortDayByTime', () => {
  it('orders by start time, putting un-timed items last', () => {
    const d = day(1, [
      item('late', { startTime: '15:00' }),
      item('untimed'),
      item('early', { startTime: '08:00' }),
    ])
    const sorted = sortDayByTime(d)
    expect(sorted.items.map((i) => i.id)).toEqual(['early', 'late', 'untimed'])
  })
})
