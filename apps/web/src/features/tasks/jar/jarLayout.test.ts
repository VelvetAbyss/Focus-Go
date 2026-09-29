import { describe, expect, it } from 'vitest'
import { layoutJars } from './jarLayout'

describe('layoutJars', () => {
  it('puts the open jar first and as many shelf jars as fit, newest first', () => {
    const keys = ['w-1', 'w-2', 'w-3', 'w-4', 'w-5', 'w-6', 'w-7', 'w-8']
    const layout = layoutJars(300, 96, 'now', false, keys)
    expect(layout.main.key).toBe('now')
    expect(layout.main.sealed).toBe(false)
    expect(layout.shelf.length).toBeGreaterThan(2)
    expect(layout.shelf.map((slot) => slot.key)).toEqual(keys.slice(0, layout.shelf.length))
    expect(layout.shelf.every((slot) => slot.sealed)).toBe(true)
  })

  it('keeps every jar and its target inside the canvas', () => {
    const layout = layoutJars(260, 92, 'now', true, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])
    for (const slot of [layout.main, ...layout.shelf]) {
      expect(slot.hit.left).toBeGreaterThanOrEqual(0)
      expect(slot.hit.left + slot.hit.width).toBeLessThanOrEqual(260 + 1)
      expect(slot.hit.top).toBeGreaterThanOrEqual(-1)
    }
  })

  it('draws fewer shelf jars on a narrow card', () => {
    const wide = layoutJars(360, 96, 'now', false, Array.from({ length: 10 }, (_, i) => `w${i}`))
    const narrow = layoutJars(200, 96, 'now', false, Array.from({ length: 10 }, (_, i) => `w${i}`))
    expect(narrow.shelf.length).toBeLessThan(wide.shelf.length)
  })
})
