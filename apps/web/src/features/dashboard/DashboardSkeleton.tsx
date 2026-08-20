import { useMemo } from 'react'
import { DEFAULT_DASHBOARD_LAYOUT_ITEMS } from '../../data/defaultDashboardLayout'
import './DashboardSkeleton.css'

interface DashboardSkeletonProps {
  /** Columns the real grid is using — matches DashboardPage `columns`. */
  columns: number
  /** Row height in px — matches DashboardPage rowHeight. */
  rowHeight?: number
  margin?: number
}

/**
 * Grid-position skeleton. Renders tinted boxes in the same coordinates the
 * real layout will use so the dashboard doesn't pop in from empty space while
 * `dashboardRepo.get()` / RxDB is still resolving. Cards fade-in via CSS
 * `dash-card-enter` once the real layout takes over.
 */
const DashboardSkeleton = ({ columns, rowHeight = 60, margin = 18 }: DashboardSkeletonProps) => {
  const items = useMemo(() => {
    // On mobile, scale 12-col → 4-col like DashboardPage.
    if (columns >= 12) return DEFAULT_DASHBOARD_LAYOUT_ITEMS
    return DEFAULT_DASHBOARD_LAYOUT_ITEMS.map((item) => {
      const w = Math.max(2, Math.round((item.w / 12) * columns))
      const x = Math.min(columns - w, Math.round((item.x / 12) * columns))
      return { ...item, w, x }
    })
  }, [columns])

  const maxY = items.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  const containerHeight = maxY * rowHeight + (maxY + 1) * margin + margin * 2

  return (
    <div
      className="dashboard-skeleton"
      style={{
        position: 'relative',
        padding: margin,
        minHeight: containerHeight,
      }}
      aria-hidden="true"
    >
      {items.map((item, idx) => (
        <div
          key={item.key}
          className="dashboard-skeleton__card"
          style={{
            position: 'absolute',
            top: item.y * (rowHeight + margin) + margin,
            left: `calc(${(item.x / columns) * 100}% + ${margin}px)`,
            width: `calc(${(item.w / columns) * 100}% - ${margin * 2}px)`,
            height: item.h * rowHeight + (item.h - 1) * margin,
            animationDelay: `${idx * 55}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default DashboardSkeleton
