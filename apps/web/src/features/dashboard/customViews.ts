import type { DashboardLayoutItem } from '../../data/models/types'

export type CustomView = { id: string; name: string; items: DashboardLayoutItem[] }
export const CUSTOM_VIEWS_KEY = 'focusgo.dashboard.customViews.v1'

export function readCustomViews(): CustomView[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CUSTOM_VIEWS_KEY) ?? '[]')
    if (!Array.isArray(value)) return []
    const ids = new Set<string>()
    return value.filter((view): view is CustomView => {
      if (!view || typeof view.id !== 'string' || ids.has(view.id) || typeof view.name !== 'string' || !view.name.trim() || !Array.isArray(view.items)) return false
      const keys = new Set<string>()
      const valid = view.items.every((item: DashboardLayoutItem) => {
        if (!item || typeof item.key !== 'string' || keys.has(item.key)) return false
        keys.add(item.key)
        return [item.x, item.y, item.w, item.h].every(Number.isInteger) && item.x >= 0 && item.y >= 0 && item.w >= 2 && item.w <= 12 && item.x + item.w <= 12 && item.h >= 2
      })
      if (valid) ids.add(view.id)
      return valid
    })
  } catch { return [] }
}

export function saveCustomViews(views: CustomView[]) {
  // Let quota / disabled-storage errors reach the editor: never claim a failed save succeeded.
  localStorage.setItem(CUSTOM_VIEWS_KEY, JSON.stringify(views))
}

export function viewNameError(name: string, views: CustomView[], id?: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 40) return 'name'
  if (views.some(view => view.id !== id && view.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) return 'duplicate'
  return null
}

export function uniqueViewName(base: string, views: CustomView[]) {
  let name = base.slice(0, 35)
  let suffix = 2
  while (viewNameError(name, views)) name = `${base.slice(0, 35)} ${suffix++}`
  return name
}

export function appendViewWidget(items: DashboardLayoutItem[], key: string, w: number, h: number): DashboardLayoutItem[] {
  if (items.some(item => item.key === key)) return items
  const bottom = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x <= 12 - w; x++) {
      if (items.every(item => x >= item.x + item.w || x + w <= item.x || y >= item.y + item.h || y + h <= item.y)) {
        return [...items, { key, x, y, w, h }]
      }
    }
  }
  return [...items, { key, x: 0, y: bottom, w, h }]
}
