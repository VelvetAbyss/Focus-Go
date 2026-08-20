import type { TripTemplate } from '../../../data/models/types'
import { tokyo5d } from './tokyo-5d'
import { paris4d } from './paris-4d'
import { nyc3d } from './nyc-3d'

export const TRIP_TEMPLATES: TripTemplate[] = [tokyo5d, paris4d, nyc3d]

const SUB_NS = '__tpl_id_dup__' // future-proof flag if we need to override ids

const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = (): string => addDaysIso(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, 0)

/**
 * Clone a template and shift its (empty) day dates to start on `startDate`.
 * IDs of nested items are rewritten so multiple instances of the same template
 * can co-exist without primary-key collisions on the items table.
 */
export const instantiateTemplate = (
  template: TripTemplate,
  options: { startDate?: string } = {},
): {
  title: string
  destination: string
  countryCode?: string
  coverEmoji: string
  startDate: string
  endDate: string
  itinerary: TripTemplate['itinerary']
  budget: NonNullable<TripTemplate['budget']>
  checklist: NonNullable<TripTemplate['checklist']>
  tags: string[]
  templateId: string
} => {
  const startDate = options.startDate ?? today()
  const endDate = addDaysIso(startDate, Math.max(0, template.days - 1))
  const seed = template.id + ':' + Date.now().toString(36)
  let counter = 0
  const newId = () => `${seed}:${counter++}`

  const itinerary = template.itinerary.map((day) => ({
    ...day,
    date: addDaysIso(startDate, day.day - 1),
    items: day.items.map((item) => ({ ...item, id: newId() })),
  }))

  const budget = (template.budget ?? []).map((b) => ({ ...b, id: newId() }))
  const checklist = (template.checklist ?? []).map((g) => ({
    ...g,
    id: newId(),
    items: g.items.map((it) => ({ ...it, id: newId() })),
  }))

  // SUB_NS reserved for future migrations
  void SUB_NS

  return {
    title: template.title,
    destination: template.destination,
    countryCode: template.countryCode,
    coverEmoji: template.coverEmoji,
    startDate,
    endDate,
    itinerary,
    budget,
    checklist,
    tags: template.tags,
    templateId: template.id,
  }
}

export type { TripTemplate }
