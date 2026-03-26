import { useCallback, useEffect, useRef, useState } from 'react'
import type { DashboardLayoutItem } from '../../data/models/types'

/**
 * Custom drag & resize engine for the dashboard grid.
 *
 * Replaces react-grid-layout's built-in drag/resize to fix the
 * click-to-shift bug and give full control over interaction UX.
 *
 * - Drag starts only after a 5 px pointer movement (threshold).
 * - Positions snap to grid cells during drag (cell-to-cell movement).
 * - Colliding items are pushed downward and cascade-resolved.
 * - Layout is calculated from the pre-drag snapshot so displaced
 *   items snap back when the dragged item moves away.
 */

const THRESHOLD_SQ = 25 // 5 px, squared

// ── internal types ──────────────────────────────────────────────

type Op = {
  id: string
  kind: 'drag' | 'resize'
  x0: number // clientX at pointer-down
  y0: number // clientY at pointer-down
  col: number // item grid-x at start
  row: number // item grid-y at start
  w: number // item width at start
  h: number // item height at start
  moved: boolean // past threshold?
  prevCol: number
  prevRow: number
  prevW: number
  prevH: number
}

// ── geometry helpers ────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function overlaps(a: DashboardLayoutItem, b: DashboardLayoutItem) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

/**
 * Push every item that collides with the moved item below it,
 * then cascade-resolve any secondary overlaps top-to-bottom.
 */
function pushDown(items: DashboardLayoutItem[], movedKey: string): DashboardLayoutItem[] {
  const out = items.map((i) => ({ ...i }))
  const moved = out.find((i) => i.key === movedKey)
  if (!moved) return out

  for (const it of out) {
    if (it.key !== movedKey && overlaps(moved, it)) {
      it.y = moved.y + moved.h
    }
  }

  const rest = out.filter((i) => i.key !== movedKey).sort((a, b) => a.y - b.y)
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      if (overlaps(rest[i], rest[j])) {
        rest[j].y = rest[i].y + rest[i].h
      }
    }
  }

  return out
}

// ── hook ────────────────────────────────────────────────────────

export function useDashboardGridEdit(cfg: {
  layout: DashboardLayoutItem[]
  enabled: boolean
  cols: number
  rowHeight: number
  margin: [number, number]
  padding: [number, number]
  width: number
  minW: number
  minH: number
  onUpdate: (layout: DashboardLayoutItem[]) => void
  onCommit: (layout: DashboardLayoutItem[]) => void
}) {
  const r = useRef(cfg)
  r.current = cfg

  const opRef = useRef<Op | null>(null)
  const snapRef = useRef<DashboardLayoutItem[]>([]) // pre-drag snapshot
  const lastRef = useRef<DashboardLayoutItem[]>(cfg.layout)
  const [activeId, setActiveId] = useState<string | null>(null)

  const step = () => {
    const { width, cols, margin, padding, rowHeight } = r.current
    const cw = (width - padding[0] * 2 - margin[0] * (cols - 1)) / cols
    return { x: cw + margin[0], y: rowHeight + margin[1] }
  }

  const begin = useCallback((id: string, kind: 'drag' | 'resize', e: React.PointerEvent) => {
    if (!r.current.enabled) return
    const it = r.current.layout.find((i) => i.key === id)
    if (!it) return
    e.preventDefault()
    if (kind === 'resize') e.stopPropagation()

    opRef.current = {
      id,
      kind,
      x0: e.clientX,
      y0: e.clientY,
      col: it.x,
      row: it.y,
      w: it.w,
      h: it.h,
      moved: false,
      prevCol: it.x,
      prevRow: it.y,
      prevW: it.w,
      prevH: it.h,
    }
    snapRef.current = r.current.layout.map((i) => ({ ...i }))
    lastRef.current = r.current.layout
    setActiveId(id)
  }, [])

  useEffect(() => {
    if (!cfg.enabled) {
      opRef.current = null
      setActiveId(null)
      return
    }

    const onMove = (e: PointerEvent) => {
      const op = opRef.current
      if (!op) return
      const dx = e.clientX - op.x0
      const dy = e.clientY - op.y0

      if (!op.moved && dx * dx + dy * dy < THRESHOLD_SQ) return
      op.moved = true

      const { cols, minW, minH, onUpdate } = r.current
      const s = step()
      const base = snapRef.current

      let next: DashboardLayoutItem[]
      if (op.kind === 'drag') {
        const c = clamp(op.col + Math.round(dx / s.x), 0, cols - op.w)
        const row = Math.max(0, op.row + Math.round(dy / s.y))
        if (c === op.prevCol && row === op.prevRow) return
        op.prevCol = c
        op.prevRow = row
        next = base.map((i) => (i.key === op.id ? { ...i, x: c, y: row } : i))
      } else {
        const w = clamp(op.w + Math.round(dx / s.x), minW, cols - op.col)
        const h = Math.max(minH, op.h + Math.round(dy / s.y))
        if (w === op.prevW && h === op.prevH) return
        op.prevW = w
        op.prevH = h
        next = base.map((i) => (i.key === op.id ? { ...i, w, h } : i))
      }

      const resolved = pushDown(next, op.id)
      lastRef.current = resolved
      onUpdate(resolved)
    }

    const onUp = () => {
      const op = opRef.current
      opRef.current = null
      setActiveId(null)
      if (op?.moved) r.current.onCommit(lastRef.current)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [cfg.enabled])

  return {
    activeId,
    dragProps: useCallback(
      (id: string) => ({
        onPointerDown: (e: React.PointerEvent) => begin(id, 'drag', e),
      }),
      [begin]
    ),
    resizeProps: useCallback(
      (id: string) => ({
        onPointerDown: (e: React.PointerEvent) => begin(id, 'resize', e),
      }),
      [begin]
    ),
  }
}
