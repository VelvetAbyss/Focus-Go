import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_WORLD_CLOCK_ITEMS, readWorldClockItems, writeWorldClockItems, WORLD_CLOCK_ITEMS_KEY, type WorldClockItem } from './preferences'

const makeItem = (index: number): WorldClockItem => ({
  id: `item-${index}`,
  label: `City ${index}`,
  searchValue: `City ${index}`,
  latitude: index,
  longitude: index,
  timeZone: 'UTC',
})

describe('world clock preferences', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => void store.clear(),
    })
  })

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns an empty array for invalid storage data', () => {
    localStorage.setItem(WORLD_CLOCK_ITEMS_KEY, '{bad json')
    expect(readWorldClockItems()).toEqual([])
  })

  it('returns preset cities when storage is empty', () => {
    expect(readWorldClockItems()).toEqual(DEFAULT_WORLD_CLOCK_ITEMS)
  })

  it('persists up to four valid items', () => {
    writeWorldClockItems([0, 1, 2, 3, 4].map(makeItem))

    expect(readWorldClockItems()).toHaveLength(4)
    expect(readWorldClockItems()[0]?.label).toBe('City 0')
    expect(readWorldClockItems()[3]?.label).toBe('City 3')
  })
})
