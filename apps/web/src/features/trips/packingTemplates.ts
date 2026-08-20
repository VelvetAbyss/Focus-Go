import type { TripChecklistGroup } from '../../data/models/types'
import { createId } from '../../shared/utils/ids'

export type PackingTemplate = {
  id: string
  label: string
  emoji: string
  items: string[]
}

/** Ready-to-merge packing lists for common trip shapes. */
export const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    id: 'beach',
    label: 'Beach',
    emoji: '🏖️',
    items: ['Swimsuit', 'Sunscreen SPF 50', 'Beach towel', 'Sunglasses', 'Flip-flops', 'Sun hat', 'After-sun lotion'],
  },
  {
    id: 'business',
    label: 'Business',
    emoji: '💼',
    items: ['Suit / blazer', 'Dress shirts', 'Laptop + charger', 'Business cards', 'Notebook & pen', 'Dress shoes', 'Travel adapter'],
  },
  {
    id: 'ski',
    label: 'Ski',
    emoji: '🎿',
    items: ['Ski jacket', 'Thermal base layers', 'Ski gloves', 'Goggles', 'Beanie', 'Hand warmers', 'Lip balm SPF'],
  },
  {
    id: 'longhaul',
    label: 'Long-haul flight',
    emoji: '✈️',
    items: ['Neck pillow', 'Eye mask', 'Noise-cancelling earbuds', 'Compression socks', 'Refillable bottle', 'Snacks', 'Power bank'],
  },
  {
    id: 'family',
    label: 'Family',
    emoji: '👨‍👩‍👧',
    items: ['Kids snacks', 'Wet wipes', 'Travel games', 'First-aid kit', 'Spare clothes', 'Stroller / carrier', 'Favorite toy'],
  },
  {
    id: 'camping',
    label: 'Camping',
    emoji: '🏕️',
    items: ['Tent', 'Sleeping bag', 'Headlamp', 'Camp stove', 'Bug spray', 'Multi-tool', 'Water filter'],
  },
]

const norm = (value: string) => value.trim().toLowerCase()

/**
 * Merge a packing template into a checklist. If a group already exists with the
 * same (case-insensitive) label, append only the items it's missing; otherwise
 * add a fresh group. Pure — returns a new array and never mutates the input.
 */
export const mergePackingTemplate = (
  checklist: TripChecklistGroup[],
  template: PackingTemplate,
): TripChecklistGroup[] => {
  const idx = checklist.findIndex((group) => norm(group.label) === norm(template.label))
  if (idx >= 0) {
    const group = checklist[idx]
    const have = new Set(group.items.map((item) => norm(item.label)))
    const additions = template.items
      .filter((label) => !have.has(norm(label)))
      .map((label) => ({ id: createId(), label, done: false }))
    if (!additions.length) return checklist
    const next = [...checklist]
    next[idx] = { ...group, items: [...group.items, ...additions] }
    return next
  }
  return [
    ...checklist,
    {
      id: createId(),
      label: template.label,
      emoji: template.emoji,
      items: template.items.map((label) => ({ id: createId(), label, done: false })),
    },
  ]
}
