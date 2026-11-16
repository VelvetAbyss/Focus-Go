import type { DashboardLayoutItem } from '../../data/models/types'

/** Presentation only: never persist this arrangement over a saved desk. */
export function reflowDashboardLayout(items: DashboardLayoutItem[], width: number, columns: number): DashboardLayoutItem[] {
  if (width >= 1120) return items
  const tracks = width >= 720 ? 2 : 1
  const bottoms = Array<number>(tracks).fill(0)
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x).map(item => {
    const fullWidth = tracks === 1 || item.key === 'tasks'
    const track = fullWidth ? 0 : bottoms.indexOf(Math.min(...bottoms))
    const y = fullWidth ? Math.max(...bottoms) : bottoms[track]
    const next = { ...item, x: fullWidth ? 0 : track * columns / tracks, y, w: fullWidth ? columns : columns / tracks }
    if (fullWidth) bottoms.fill(y + item.h)
    else bottoms[track] = y + item.h
    return next
  })
}
