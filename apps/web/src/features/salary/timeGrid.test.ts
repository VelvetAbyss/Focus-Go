import { describe, expect, it } from 'vitest'
import { CellState, dayGrid, dayGridCells, GRID_COLS, priceGrid } from './timeGrid'
import type { SalarySettings } from './salaryModel'

const settings: SalarySettings = {
  monthlySalary: 12000,
  workStart: 9 * 60,
  workEnd: 18 * 60,
  lunch: { start: 12 * 60, end: 13 * 60 },
  workdays: [1, 2, 3, 4, 5],
}

const at = (hours: number, minutes = 0, day = 15) => new Date(2026, 6, day, hours, minutes).getTime()
const cellAt = (hours: number, minutes: number) => ((hours - 9) * 60 + minutes) / 5

describe('day grid', () => {
  it('lays a 9-to-6 day out as nine rows of twelve five-minute cells', () => {
    const grid = dayGrid(settings, at(14, 22))!
    expect(grid.rows).toBe(9)
    expect(grid.states).toHaveLength(9 * GRID_COLS)
  })

  it('inks what has passed, marks now, crosses out lunch and leaves the rest in pencil', () => {
    const grid = dayGrid(settings, at(14, 22))!
    expect(grid.states[cellAt(9, 0)]).toBe(CellState.done)
    expect(grid.states[cellAt(14, 15)]).toBe(CellState.done)
    expect(grid.states[cellAt(14, 20)]).toBe(CellState.now)
    expect(grid.fills[cellAt(14, 20)]).toBeCloseTo(0.4, 5)
    expect(grid.states[cellAt(12, 30)]).toBe(CellState.lunch)
    expect(grid.states[cellAt(17, 55)]).toBe(CellState.future)
  })

  it('shows breaks: taken ones struck through, the running one in pen', () => {
    const grid = dayGrid(settings, at(14, 22), [[at(13, 20), at(13, 57)]], [at(14, 12), at(14, 22)])!
    const taken = grid.states.map((state, index) => (state === CellState.breakDone ? index : -1)).filter((index) => index >= 0)
    // 13:20–13:57 covers seven cells fully; the two minutes into 13:55 don't count.
    expect(taken).toEqual([cellAt(13, 20), cellAt(13, 25), cellAt(13, 30), cellAt(13, 35), cellAt(13, 40), cellAt(13, 45), cellAt(13, 50)])
    // 14:12 onwards: three of 14:10's five minutes, all of 14:15, and the lived part of 14:20.
    expect(grid.states[cellAt(14, 10)]).toBe(CellState.breakNow)
    expect(grid.states[cellAt(14, 15)]).toBe(CellState.breakNow)
    expect(grid.states[cellAt(14, 20)]).toBe(CellState.breakNow)
    expect(grid.states[cellAt(14, 5)]).toBe(CellState.done)
  })

  it('marks a short break that fits inside one cell', () => {
    const grid = dayGrid(settings, at(15, 0), [[at(10, 1), at(10, 3)]])!
    expect(grid.states[cellAt(10, 0)]).toBe(CellState.breakDone)
  })

  it('has no grid on a day off, and hides the cells past a day that ends mid-hour', () => {
    expect(dayGrid(settings, at(11, 0, 18))).toBeNull()
    const short = dayGrid({ ...settings, workEnd: 17 * 60 + 30 }, at(10, 0))!
    expect(short.rows).toBe(9)
    expect(short.states.slice(-6).every((state) => state === CellState.hidden)).toBe(true)
  })

  it('fits the cells into the box, right-aligned', () => {
    const cells = dayGridCells(108, 81, dayGrid(settings, at(10, 0))!)
    const last = cells[GRID_COLS - 1]
    expect(last.x + last.size).toBeCloseTo(108, 5)
    expect(cells[cells.length - 1].y + cells[0].size).toBeLessThanOrEqual(81.001)
  })
})

describe('price grid', () => {
  it('shows a price as hour cells in working-day blocks, the last hour by its share', () => {
    const layout = priceGrid(270, 23, 21.45, 8)
    expect(layout.cells).toHaveLength(24)
    expect(layout.cells.filter((cell) => cell.state === CellState.done)).toHaveLength(21)
    const partial = layout.cells.find((cell) => cell.state === CellState.partial)
    expect(partial?.fill).toBeCloseTo(0.45, 5)
    expect(layout.cells.filter((cell) => cell.state === CellState.spare)).toHaveLength(2)
    expect(layout.extraDays).toBe(0)
  })

  it('leaves the last slot for +N when the days do not fit', () => {
    const layout = priceGrid(200, 23, 429.3, 8)
    const shown = layout.cells.length / 8
    expect(shown + layout.extraDays).toBe(54)
    expect(layout.extraDays).toBeGreaterThan(0)
    expect(layout.cells.every((cell) => cell.state === CellState.done)).toBe(true)
    expect(layout.labelLeft).toBeLessThan(200)
  })

  it('shows nothing without a price', () => {
    expect(priceGrid(270, 23, null, 8).cells).toHaveLength(0)
  })
})
