import { useSyncExternalStore } from 'react'

/**
 * The one breakpoint ladder for the app.
 *
 * The values are the real device clusters (StatCounter worldwide, Aug 2026),
 * not round numbers:
 *
 *   sm  640 — above the phone cluster (360×800, 384×832, 390×844, 414×896)
 *   md  768 — tablet portrait (768×1024 is the single most common tablet)
 *   lg  1024 — tablet landscape and the smallest laptops (1280×800)
 *   xl  1366 — the mainstream laptop cluster (1366×768, 1536×864)
 *   xxl 1920 — desktop (1920×1080 is 22% of all desktops on its own)
 *
 * Note that 1536×864 is simply 1920×1080 at Windows' 125% display scaling, so
 * these are CSS pixels and DPI scaling is the common case rather than an edge
 * case: always reason in CSS px, never assume physical resolution.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1366,
  xxl: 1920,
} as const

export type BreakpointName = keyof typeof BREAKPOINTS

/** Media query text for a breakpoint, for use with matchMedia or CSS-in-JS. */
export const above = (name: BreakpointName) => `(min-width: ${BREAKPOINTS[name]}px)`
export const below = (name: BreakpointName) => `(max-width: ${BREAKPOINTS[name] - 1}px)`

const subscribe = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

const getWidth = () => (typeof window === 'undefined' ? BREAKPOINTS.xl : window.innerWidth)

/** Current viewport width in CSS pixels, re-rendering on resize and rotation. */
export const useViewportWidth = (): number =>
  useSyncExternalStore(subscribe, getWidth, () => BREAKPOINTS.xl)

/**
 * The narrowest a dashboard card may be rendered before its content starts
 * clipping. Measured, not guessed: at 1366px the old grid produced 228px cards,
 * and that is where the recap stat row, the To-do tabs and the weather
 * temperatures all began truncating.
 */
export const MIN_CARD_WIDTH_PX = 280

export type DashboardGrid = {
  /** `stacked` is too narrow for a grid: render the cards as one vertical list. */
  mode: 'stacked' | 'grid'
  columns: number
  /** Fewest columns a card may span, derived so it stays at least MIN_CARD_WIDTH_PX. */
  minSpan: number
  /**
   * True when the rendered grid differs from the authored one. Only then may the
   * minimum span be enforced: at the authored column count the stored layout is
   * reproduced exactly, because widening a card there would push its neighbours
   * onto new rows and leave the user's own desktop layout full of holes.
   */
  projected: boolean
}

/**
 * How a dashboard should lay out at the current width.
 *
 * Stored layouts are authored against `baseColumns` (12 for the main dashboard,
 * 24 for Life). The column count controls *granularity*; `minSpan` is what
 * actually stops cards collapsing into unreadable slivers, and it is derived
 * from the real column width rather than hard-coded — a span of 2 is generous
 * at 1920px and far too narrow at 1366px.
 *
 * Replaces a single binary switch at 768px, which left an 820px iPad Air
 * rendering 12 columns at 68px each and a 414px phone rendering 4 columns at
 * ~95px each.
 */
export type GridMetrics = {
  /** Gap between columns, in px. */
  gutter: number
  /** Horizontal padding inside the grid container, in px. */
  padding: number
}

const DEFAULT_METRICS: GridMetrics = { gutter: 18, padding: 18 }

/**
 * How a dashboard should lay out in the space it actually has.
 *
 * `availableWidth` is the grid *container* width, not the viewport: the sidebar,
 * page padding and gutters all take a bite, and measuring the viewport instead
 * overstates the room by enough to matter (at a 1366px viewport the grid really
 * has ~1080px, which is the difference between a 341px card and a 251px one).
 *
 * Stored layouts are authored against `baseColumns` (12 for the main dashboard,
 * 24 for Life). The column count controls *granularity*; `minSpan` is what stops
 * cards collapsing into unreadable slivers, and it is solved from the real
 * rendered card width rather than hard-coded — a span of 2 is generous at 1920px
 * and far too narrow at 1366px.
 *
 * Replaces a single binary switch at 768px, which left an 820px iPad Air
 * rendering 12 columns at 68px each and a 414px phone rendering 4 columns at
 * ~95px each.
 */
export type GridInput = {
  /** Viewport width — classifies the device band. */
  viewportWidth: number
  /** Width the grid actually has. Defaults to the viewport. */
  containerWidth?: number
  baseColumns: number
  metrics?: GridMetrics
}

/**
 * How a dashboard should lay out.
 *
 * The *band* is chosen from the viewport, because that is what describes the
 * device: a 1366px laptop should get the layout its owner authored, even though
 * the sidebar leaves the grid only ~1080px. The *card-width floor* is then
 * measured against the width the grid really has, since that is what decides
 * whether a card is legible.
 *
 * Stored layouts are authored against `baseColumns` (12 for the main dashboard,
 * 24 for Life). The column count controls granularity; `minSpan` stops cards
 * collapsing into slivers, and applies only when the grid is already being
 * reshaped — see `projected`.
 *
 * Replaces a single binary switch at 768px, which left an 820px iPad Air
 * rendering 12 columns at 68px each and a 414px phone rendering 4 columns at
 * ~95px each.
 */
export const resolveDashboardGrid = ({
  viewportWidth,
  containerWidth = viewportWidth,
  baseColumns,
  metrics = DEFAULT_METRICS,
}: GridInput): DashboardGrid => {
  // Phones: a drag-and-drop grid is neither usable nor readable at this width.
  if (viewportWidth < BREAKPOINTS.sm) return { mode: 'stacked', columns: 1, minSpan: 1, projected: true }

  // Reshape only where the authored layout genuinely cannot work — phones and
  // tablet portrait. From `lg` up the stored layout is reproduced exactly, which
  // also keeps drag editing available: editing a reshaped grid would persist the
  // narrow-screen coordinates over what the user actually authored.
  const columns =
    viewportWidth < BREAKPOINTS.md ? 2 : viewportWidth < BREAKPOINTS.lg ? 4 : baseColumns

  const projected = columns !== baseColumns
  if (!projected) return { mode: 'grid', columns, minSpan: 1, projected }

  const usable = containerWidth - metrics.padding * 2 - metrics.gutter * (columns - 1)
  const columnWidth = usable / columns
  const cardWidth = (span: number) => span * columnWidth + (span - 1) * metrics.gutter

  let minSpan = 1
  while (minSpan < columns && cardWidth(minSpan) < MIN_CARD_WIDTH_PX) minSpan += 1
  return { mode: 'grid', columns, minSpan, projected }
}

/** Rendered width of a card spanning `span` columns — the ladder's own maths. */
export const cardWidthFor = (
  span: number,
  availableWidth: number,
  columns: number,
  metrics: GridMetrics = DEFAULT_METRICS,
) => {
  const usable = availableWidth - metrics.padding * 2 - metrics.gutter * (columns - 1)
  return span * (usable / columns) + (span - 1) * metrics.gutter
}

export const useDashboardGrid = (baseColumns: number, containerWidth?: number): DashboardGrid =>
  resolveDashboardGrid({ viewportWidth: useViewportWidth(), containerWidth, baseColumns })

/**
 * Project an authored layout onto the current grid. Returns `changed` so the
 * caller can refuse to persist — and to offer drag editing — whenever what is on
 * screen is not what the user actually authored.
 */
export const projectLayout = <T extends { x: number; w: number }>(
  layout: T[],
  grid: DashboardGrid,
  baseColumns: number,
): { items: T[]; changed: boolean } => {
  if (grid.mode === 'stacked') {
    return { items: layout.map((item) => ({ ...item, x: 0, w: 1 })), changed: layout.length > 0 }
  }
  // At the authored column count, reproduce the layout untouched.
  if (!grid.projected) return { items: layout, changed: false }
  let changed = false
  const items = layout.map((item) => {
    const scaled = Math.round((item.w / baseColumns) * grid.columns)
    const w = Math.min(grid.columns, Math.max(grid.minSpan, scaled))
    const x = Math.min(grid.columns - w, Math.max(0, Math.round((item.x / baseColumns) * grid.columns)))
    if (w !== item.w || x !== item.x) changed = true
    return { ...item, x, w }
  })
  return { items, changed }
}
