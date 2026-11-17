import type { DashboardLayoutItem } from '../../data/models/types'

export type WidgetRect = { key: string; x: number; y: number; width: number; height: number }

/** Pure display geometry. Never write these coordinates to a layout repository. */
export function fitDashboardLayout(items: DashboardLayoutItem[], width: number, height: number, columns: number): WidgetRect[] {
  return fitLayout(items, width, height, columns, false)
}

function fitLayout(items: DashboardLayoutItem[], width: number, height: number, columns: number, preferOverview: boolean): WidgetRect[] {
  if (!items.length || width <= 0 || height <= 0) return []
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const gap = width < 600 || height < 380 ? 8 : 12
  const compact = preferOverview || width < 1100 || height < 360
  let grid: DashboardLayoutItem[]
  let gridColumns: number
  let gridRows: number
  if (compact) {
    // A phone is a small overview; landscape gains columns rather than tiny type.
    const preferredColumns = width < 540 ? 2 : width < 900 ? 3 : 4
    const readableRows = Math.max(1, Math.floor((height + gap) / 80))
    gridColumns = Math.min(items.length, Math.max(preferredColumns, Math.min(Math.floor((width + gap) / 100), Math.ceil(items.length / readableRows))))
    if ((height + gap) / Math.ceil(items.length / gridColumns) - gap < 48) {
      gridColumns = Math.min(items.length, Math.max(gridColumns, Math.floor((width + gap) / 52)))
    }
    let cursor = 0
    grid = ordered.map((item, index) => {
      const wide = index === 0 && items.length <= 8 && height >= 380 && (item.key === 'tasks' || item.key === 'library')
      const w = wide ? Math.min(2, gridColumns) : 1
      if (cursor % gridColumns + w > gridColumns) cursor += gridColumns - cursor % gridColumns
      const result = { ...item, x: cursor % gridColumns, y: Math.floor(cursor / gridColumns), w, h: 1 }
      cursor += w
      return result
    })
    gridRows = Math.ceil(cursor / gridColumns)
    // Give the last tile the spare column instead of an accidental empty hole.
    const last = grid.at(-1)!
    last.w = gridColumns - last.x
  } else {
    gridColumns = columns
    grid = []
    for (const item of ordered) {
      const w = Math.max(1, Math.min(columns, item.w))
      const x = Math.max(0, Math.min(columns - w, item.x))
      const h = Math.max(1, item.h)
      const blockers = grid.filter(other => x < other.x + other.w && x + w > other.x)
      const y = Math.max(0, ...blockers.map(other => other.y + other.h))
      grid.push({ ...item, x, y, w, h })
    }
    gridRows = Math.max(...grid.map(item => item.y + item.h))
  }
  // Gutters belong to widgets, not every virtual row: a saved 50-row layout
  // still fits and does not consume its entire height in 49 gaps.
  const rects = grid.map(item => ({
    key: item.key,
    x: item.x / gridColumns * (width + gap),
    y: item.y / gridRows * (height + gap),
    width: Math.max(1, item.w / gridColumns * (width + gap) - gap),
    height: Math.max(1, item.h / gridRows * (height + gap) - gap),
  }))
  // Long, user-built desks can have extremely uneven saved row weights.
  // Fall back to the overview before a tool becomes too small to operate.
  if (!compact && rects.some(rect => rect.width < 44 || rect.height < 44)) {
    return fitLayout(items, width, height, columns, true)
  }
  return rects
}
