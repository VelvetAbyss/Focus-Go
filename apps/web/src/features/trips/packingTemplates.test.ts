import { describe, expect, it } from 'vitest'
import type { TripChecklistGroup } from '../../data/models/types'
import { PACKING_TEMPLATES, mergePackingTemplate } from './packingTemplates'

const beach = PACKING_TEMPLATES.find((t) => t.id === 'beach')!

describe('PACKING_TEMPLATES', () => {
  it('exposes six non-empty templates with unique ids', () => {
    expect(PACKING_TEMPLATES).toHaveLength(6)
    expect(new Set(PACKING_TEMPLATES.map((t) => t.id)).size).toBe(6)
    for (const tpl of PACKING_TEMPLATES) expect(tpl.items.length).toBeGreaterThan(0)
  })
})

describe('mergePackingTemplate', () => {
  it('adds a new group when none matches the label', () => {
    const next = mergePackingTemplate([], beach)
    expect(next).toHaveLength(1)
    expect(next[0].label).toBe('Beach')
    expect(next[0].items.map((i) => i.label)).toEqual(beach.items)
    expect(next[0].items.every((i) => !i.done)).toBe(true)
  })

  it('does not mutate the input array', () => {
    const input: TripChecklistGroup[] = []
    mergePackingTemplate(input, beach)
    expect(input).toHaveLength(0)
  })

  it('appends only missing items into a same-label group (case-insensitive)', () => {
    const existing: TripChecklistGroup[] = [
      { id: 'g1', label: 'beach', emoji: '🏖️', items: [{ id: 'x', label: 'Sunglasses', done: true }] },
    ]
    const next = mergePackingTemplate(existing, beach)
    expect(next).toHaveLength(1)
    const labels = next[0].items.map((i) => i.label)
    // Existing Sunglasses kept (still done), not duplicated
    expect(labels.filter((l) => l === 'Sunglasses')).toHaveLength(1)
    expect(next[0].items.find((i) => i.label === 'Sunglasses')!.done).toBe(true)
    expect(labels).toContain('Swimsuit')
    expect(next[0].items).toHaveLength(beach.items.length) // 1 existing + 6 new = 7 unique
  })

  it('is a no-op when the group already has every item', () => {
    const full: TripChecklistGroup[] = [
      { id: 'g1', label: 'Beach', emoji: '🏖️', items: beach.items.map((label, i) => ({ id: `i${i}`, label, done: false })) },
    ]
    const next = mergePackingTemplate(full, beach)
    expect(next).toBe(full) // same reference — nothing changed
  })
})
