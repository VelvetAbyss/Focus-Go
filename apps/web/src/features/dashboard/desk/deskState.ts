// The desk is a per-device setting, like the quote skip: whether the lamp is on,
// how it is posed, and which props stand on the desk. Never synced.
import { DEFAULT_POSE, parsePose, type LampPose } from './lampKinematics'
import type { DeskDrink, DeskItem } from './deskTypes'

export type DeskSettings = {
  lampOn: boolean
  pose: LampPose
  item: DeskItem
  drink: DeskDrink
}

export const DESK_STORAGE_KEY = 'focusgo.dashboard.desk'

export const DEFAULT_DESK: DeskSettings = { lampOn: false, pose: DEFAULT_POSE, item: 'book', drink: 'coffee' }

export const parseDeskSettings = (raw: string | null): DeskSettings => {
  if (!raw) return DEFAULT_DESK
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null
    if (!value || typeof value !== 'object') return DEFAULT_DESK
    return {
      lampOn: value.lampOn === true,
      pose: parsePose(value.pose) ?? DEFAULT_POSE,
      item: value.item === 'laptop' ? 'laptop' : 'book',
      drink: value.drink === 'cola' ? 'cola' : 'coffee',
    }
  } catch {
    return DEFAULT_DESK
  }
}

export const readDeskSettings = (): DeskSettings => {
  try {
    return parseDeskSettings(window.localStorage.getItem(DESK_STORAGE_KEY))
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
