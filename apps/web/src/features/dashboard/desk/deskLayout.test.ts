import { describe, expect, it } from 'vitest'
import { LAMP_X, PROP_FOOTPRINT, findFreeSpot, onDesk } from './deskLayout'
import type { DeskPropId } from './deskTypes'

const span = { left: -6, right: 6 }
const overlaps = (kind: DeskPropId, x: number, items: { kind: DeskPropId; x: number }[]) =>
  items.some((item) => Math.abs(item.x - x) < PROP_FOOTPRINT[item.kind].half + PROP_FOOTPRINT[kind].half)

describe('onDesk', () => {
  it('keeps a prop stored past the edge of a narrower desk on it', () => {
    expect(onDesk(-9, 0.5, span)).toBe(-5.5)
    expect(onDesk(2, 0.5, span)).toBe(2)
    expect(onDesk(1, 4, { left: -2, right: 2 })).toBe(0)
  })
})

describe('findFreeSpot', () => {
  it('puts the first prop in the middle, over the task card', () => {
    expect(findFreeSpot('book', [], LAMP_X, span)).toBe(0)
  })

  it('finds room nearest the middle without overlapping anything or the lamp', () => {
    const items = [{ kind: 'book' as const, x: 0 }, { kind: 'coffee' as const, x: -1.8 }]
    const x = findFreeSpot('plant', items, LAMP_X, span)
    expect(overlaps('plant', x, items)).toBe(false)
    expect(Math.abs(x - LAMP_X)).toBeGreaterThan(PROP_FOOTPRINT.plant.half + 0.45)
    expect(x).toBeGreaterThanOrEqual(span.left + PROP_FOOTPRINT.plant.half)
    expect(x).toBeLessThanOrEqual(span.right - PROP_FOOTPRINT.plant.half)
  })

  it('still finds a spot on a full desk', () => {
    const items = Array.from({ length: 14 }, (_, i) => ({ kind: 'coffee' as const, x: -6 + i * 0.9 }))
    const x = findFreeSpot('coffee', items, LAMP_X, span)
    expect(x).toBeGreaterThanOrEqual(span.left + 0.5)
    expect(x).toBeLessThanOrEqual(span.right - 0.5)
  })
})
