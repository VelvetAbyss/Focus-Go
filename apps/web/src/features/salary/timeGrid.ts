import { atMinutes, isWorkday, startOfLocalDay, type SalarySettings } from './salaryModel'

/**
 * The time grid behind the pay cards: a working day as five-minute cells, one
 * hour to a row, and a price as hour cells grouped into working days. Pure; the
 * three.js scene draws what these return.
 */

export const CELL_MINUTES = 5
export const GRID_COLS = 60 / CELL_MINUTES

/** What a cell shows. The numbers are read by the grid shader. */
export const CellState = {
  hidden: -1,
  /** Time still ahead: a thin pencil outline. */
  future: 0,
  /** Paid time worked: an ink square. */
  done: 1,
  /** The cell you're in: pen outline, filling as it passes. */
  now: 2,
  /** Unpaid lunch: crossed out in pencil. */
  lunch: 3,
  /** A break taken: pencil outline, struck through. */
  breakDone: 4,
  /** The break running now: a dashed pen outline, left unwritten. */
  breakNow: 5,
  /** A price's last, part-worked hour: ink up to its share. */
  partial: 6,
  /** A price's hour not needed: a dashed pencil outline. */
  spare: 7,
} as const

export type DayGrid = {
  rows: number
  states: number[]
  /** How far each cell is filled (only `now` and `partial` use it), 0–1. */
  fills: number[]
}

const MINUTE = 60_000

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))

/**
 * Today as a grid, or null on a day off. `breaks` are today's logged breaks;
 * `running` is the break in progress, up to now.
 */
export const dayGrid = (
  settings: SalarySettings,
  now: number,
  breaks: Array<[number, number]> = [],
  running: [number, number] | null = null,
): DayGrid | null => {
  const dayStart = startOfLocalDay(now)
  if (!isWorkday(settings, dayStart)) return null
  const span = settings.workEnd - settings.workStart
  const count = Math.ceil(span / CELL_MINUTES)
  const rows = Math.ceil(count / GRID_COLS)
  const states: number[] = []
  const fills: number[] = []
  for (let index = 0; index < rows * GRID_COLS; index++) {
    if (index >= count) {
      states.push(CellState.hidden)
      fills.push(0)
      continue
    }
    const startMinute = settings.workStart + index * CELL_MINUTES
    const endMinute = Math.min(settings.workEnd, startMinute + CELL_MINUTES)
    const from = atMinutes(dayStart, startMinute)
    const to = atMinutes(dayStart, endMinute)
    const length = to - from
    // A break marks a cell it covers at least half of (of the part already
    // lived, for the cell you're in), or that holds most of a short break.
    const marks = ([start, end]: [number, number]) => {
      const lived = Math.min(to, now)
      const shared = overlap(from, lived, start, end)
      return shared > 0 && shared >= Math.min((lived - from) / 2, (end - start) / 2)
    }
    const middle = (startMinute + endMinute) / 2
    let state: number
    let fill = 0
    if (settings.lunch && middle > settings.lunch.start && middle < settings.lunch.end) state = CellState.lunch
    else if (running && marks(running)) state = CellState.breakNow
    else if (breaks.some(marks)) state = CellState.breakDone
    else if (to <= now) state = CellState.done
    else if (from <= now) {
      state = CellState.now
      fill = Math.min(1, (now - from) / Math.max(MINUTE, length))
    } else state = CellState.future
    states.push(state)
    fills.push(fill)
  }
  return { rows, states, fills }
}

export type GridCell = { x: number; y: number; size: number; state: number; fill: number }

const DAY_GAP = 2

/** Positions for a day grid in a `width` × `height` box: right-aligned, top first. */
export const dayGridCells = (width: number, height: number, grid: DayGrid): GridCell[] => {
  const size = Math.max(
    2,
    Math.min((width - (GRID_COLS - 1) * DAY_GAP) / GRID_COLS, (height - (grid.rows - 1) * DAY_GAP) / grid.rows),
  )
  const left = width - (GRID_COLS * (size + DAY_GAP) - DAY_GAP)
  return grid.states.map((state, index) => ({
    x: left + (index % GRID_COLS) * (size + DAY_GAP),
    y: Math.floor(index / GRID_COLS) * (size + DAY_GAP),
    size,
    state,
    fill: grid.fills[index],
  }))
}

const PRICE_GAP = 3
const BLOCK_GAP = 8

export type PriceGridLayout = {
  cells: GridCell[]
  /** Working days beyond the blocks shown; the card writes them as +N. */
  extraDays: number
  /** Left edge of the +N label. */
  labelLeft: number
}

/**
 * A price as hour cells, a block of two rows per working day, left to right.
 * The last hour holds only its share; spare hours in the last block are dashed.
 * When the days don't fit, the last slot is left for the +N.
 */
export const priceGrid = (width: number, height: number, hours: number | null, hoursPerDay: number): PriceGridLayout => {
  const size = Math.max(3, (height - PRICE_GAP) / 2)
  const perDay = Math.max(1, Math.round(hoursPerDay))
  const columns = Math.ceil(perDay / 2)
  const blockWidth = columns * (size + PRICE_GAP) - PRICE_GAP
  const needed = hours && hours > 0 ? Math.ceil(hours - 1e-6) : 0
  const days = Math.ceil(needed / perDay)
  const fit = Math.max(1, Math.floor((width + BLOCK_GAP) / (blockWidth + BLOCK_GAP)))
  const shownDays = days > fit ? Math.max(1, fit - 1) : days
  const cells: GridCell[] = []
  for (let day = 0; day < shownDays; day++) {
    for (let hour = 0; hour < perDay; hour++) {
      const index = day * perDay + hour
      const x = day * (blockWidth + BLOCK_GAP) + (hour % columns) * (size + PRICE_GAP)
      const y = Math.floor(hour / columns) * (size + PRICE_GAP)
      let state: number = CellState.done
      let fill = 1
      if (index >= needed) {
        state = CellState.spare
        fill = 0
      } else if (index === needed - 1 && shownDays === days) {
        const share = (hours ?? 0) - (needed - 1)
        if (share < 0.98) {
          state = CellState.partial
          fill = share
        }
      }
      cells.push({ x, y, size, state, fill })
    }
  }
  return { cells, extraDays: days - shownDays, labelLeft: shownDays * (blockWidth + BLOCK_GAP) }
}
