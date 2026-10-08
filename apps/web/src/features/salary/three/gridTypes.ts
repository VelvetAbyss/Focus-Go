// Type-only contract between the pay cards and the lazily loaded time-grid
// scene, so the cards never pull three.js into their own chunks.
import type { DayGrid } from '../timeGrid'

export type GridColors = {
  /** Ink: time worked. '#rrggbb'. */
  ink: string
  /** Pencil line: time ahead, lunch, breaks taken. */
  pencil: string
  /** The pen: now, and a break running. */
  pen: string
}

export type TimeGridParams =
  | { kind: 'day'; grid: DayGrid; colors: GridColors }
  | {
      kind: 'price'
      /** What the price costs in paid hours; null shows nothing. */
      hours: number | null
      hoursPerDay: number
      /** Bumped for each new price, so the cells turn over again. */
      runId: number
      colors: GridColors
    }
