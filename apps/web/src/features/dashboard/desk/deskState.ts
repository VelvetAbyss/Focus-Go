// The desk is a per-device setting, like the quote skip: whether the lamp is on,
// where it stands and how it is posed, what stands on the desk and where, and
// the sticky note. Never synced.
import { LAMP_X } from './deskLayout'
import { DEFAULT_POSE, parsePose, type LampPose } from './lampKinematics'
import { DESK_PROPS, type DeskItem, type DeskPropId } from './deskTypes'

export type DeskSettings = {
  lampOn: boolean
  lampX: number
  pose: LampPose
  /** Back to front. */
  items: DeskItem[]
  /** The sticky note on the lamp, showing the task in progress. */
  note: boolean
}

export const DESK_STORAGE_KEY = 'focusgo.dashboard.desk'

export const DEFAULT_ITEMS: DeskItem[] = [
  { id: 'plant', kind: 'plant', x: -3.3 },
  { id: 'coffee', kind: 'coffee', x: -1.8 },
  { id: 'book', kind: 'book', x: 0 },
]

export const DEFAULT_DESK: DeskSettings = {
  lampOn: false,
  lampX: LAMP_X,
  pose: DEFAULT_POSE,
  items: DEFAULT_ITEMS,
  note: false,
}

/** Far enough that nothing stored can be wildly off the desk. */
const X_LIMIT = 40

export const newItemId = () => Math.random().toString(36).slice(2, 10)

const isProp = (value: unknown): value is DeskPropId => DESK_PROPS.includes(value as DeskPropId)
const isX = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= X_LIMIT
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

const parseItems = (value: unknown): DeskItem[] | null => {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const items: DeskItem[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const { id, kind, x, endsAt } = raw as Record<string, unknown>
    if (typeof id !== 'string' || !id || seen.has(id) || !isProp(kind) || !isX(x)) continue
    seen.add(id)
    items.push(kind === 'timer' && isTime(endsAt) ? { id, kind, x, endsAt } : { id, kind, x })
  }
  return items
}

/**
 * The desk before props could move stood them in fixed places: `slots`
 * (center, left, side), or before that `item` and `drink`; the kitchen timer's
 * ring time was kept on the desk.
 */
const fromPlaces = (value: Record<string, unknown>): DeskItem[] | null => {
  const slots = value.slots && typeof value.slots === 'object' ? (value.slots as Record<string, unknown>) : null
  if (!slots && !isProp(value.item) && !isProp(value.drink) && value.item !== 'cat' && value.drink !== 'cat') return null
  const place = slots ?? {}
  const centerValue = place.center ?? value.item
  const leftValue = place.left ?? value.drink
  const center = centerValue === 'cat' ? null : isProp(centerValue) ? centerValue : 'book'
  const left = leftValue === 'cat' ? null : isProp(leftValue) ? leftValue : 'coffee'
  const side = place.side === 'cat' || place.side === 'none' ? null : isProp(place.side) ? place.side : 'plant'
  const places: [string, DeskPropId | null, number][] = [['side', side, -3.3], ['left', left, -1.8], ['center', center, 0]]
  const items: DeskItem[] = []
  let endsAt = isTime(value.timerEndsAt) ? value.timerEndsAt : null
  for (const [id, kind, x] of places) {
    if (!kind) continue
    if (kind === 'timer' && endsAt) {
      items.push({ id, kind, x, endsAt })
      endsAt = null
    } else items.push({ id, kind, x })
  }
  return items
}

export const parseDeskSettings = (raw: string | null): DeskSettings => {
  if (!raw) return DEFAULT_DESK
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null
    if (!value || typeof value !== 'object') return DEFAULT_DESK
    return {
      lampOn: value.lampOn === true,
      lampX: isX(value.lampX) ? value.lampX : LAMP_X,
      pose: parsePose(value.pose) ?? DEFAULT_POSE,
      items: parseItems(value.items) ?? fromPlaces(value) ?? DEFAULT_ITEMS,
      note: value.note === true,
    }
  } catch {
    return DEFAULT_DESK
  }
}

export const readDeskSettings = (): DeskSettings => {
  try {
    const raw = window.localStorage.getItem(DESK_STORAGE_KEY)
    const settings = parseDeskSettings(raw)
    const value = raw ? JSON.parse(raw) as Record<string, unknown> | null : null
    if (value && typeof value === 'object') {
      const hasCat = Array.isArray(value.items) && value.items.some(item => item?.kind === 'cat')
      const hadCat = value.item === 'cat' || value.drink === 'cat'
        || (value.slots && typeof value.slots === 'object' && Object.values(value.slots).includes('cat'))
      // Persist the migration so removed props do not reappear on a later visit.
      if (hasCat || hadCat) writeDeskSettings(settings)
    }
    return settings
  } catch {
    return DEFAULT_DESK
  }
}

export const writeDeskSettings = (settings: DeskSettings) => {
  try {
    window.localStorage.setItem(DESK_STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // private mode / quota: the desk resets on the next visit
  }
}
