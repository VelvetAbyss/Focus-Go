import { describe, expect, it } from 'vitest'
import { BREAKPOINTS, MIN_CARD_WIDTH_PX, cardWidthFor, projectLayout, resolveDashboardGrid } from './breakpoints'

// The real device widths this ladder exists to serve (StatCounter, Aug 2026).
const PHONES = [360, 384, 390, 393, 414]
const TABLETS_PORTRAIT = [768, 800, 810, 820]
const LAPTOPS = [1024, 1280, 1366, 1536, 1920, 2560]

describe('dashboard column ladder', () => {
  it('stacks on every common phone width', () => {
    for (const width of PHONES) {
      expect(resolveDashboardGrid({ viewportWidth: width, baseColumns: 12 }).mode, `${width}px`).toBe('stacked')
    }
  })

  it('keeps the authored column count on laptops and desktops', () => {
    for (const width of LAPTOPS) {
      expect(resolveDashboardGrid({ viewportWidth: width, baseColumns: 12 }), `${width}px`).toMatchObject({ mode: 'grid', columns: 12 })
    }
  })

  it('never hands a tablet the full desktop grid', () => {
    // The bug this replaces: an 820px iPad Air rendered 12 columns at 68px each.
    for (const width of TABLETS_PORTRAIT) {
      const grid = resolveDashboardGrid({ viewportWidth: width, baseColumns: 12 })
      expect(grid.mode, `${width}px`).toBe('grid')
      expect(grid.columns, `${width}px`).toBeLessThan(12)
    }
  })

  it('keeps the narrowest possible card readable at every width', () => {
    // The point of the ladder: no card is ever rendered too narrow to read.
    // Measured against real rendered width — gutters and padding included.
    for (const width of [...PHONES, ...TABLETS_PORTRAIT, ...LAPTOPS, 640, 700]) {
      const grid = resolveDashboardGrid({ viewportWidth: width, baseColumns: 12 })
      if (grid.mode === 'stacked' || !grid.projected) continue
      const narrowest = cardWidthFor(grid.minSpan, width, grid.columns)
      expect(narrowest, `${width}px → ${grid.columns} cols`).toBeGreaterThanOrEqual(MIN_CARD_WIDTH_PX)
    }
  })

  it('measures the container, not the viewport', () => {
    // A 1366px viewport leaves the grid ~1080px once the sidebar and padding are
    // taken out; sizing off the viewport silently produced 251px cards.
    const grid = resolveDashboardGrid({ viewportWidth: 900, containerWidth: 860, baseColumns: 12 })
    expect(grid.projected).toBe(true)
    expect(cardWidthFor(grid.minSpan, 860, grid.columns)).toBeGreaterThanOrEqual(MIN_CARD_WIDTH_PX)
  })

  it('reproduces an authored desktop layout exactly, holes and slivers included', () => {
    // Enforcing a minimum span here would widen cards, push their neighbours to
    // new rows, and leave the user's own layout full of gaps — worse than the
    // narrow card it set out to fix. Narrow cards at the authored column count
    // are a card-content problem, not a grid problem.
    // A container this wide is at the authored column count.
    const grid = resolveDashboardGrid({ viewportWidth: 1500, baseColumns: 12 })
    expect(grid.projected).toBe(false)
    const authored = [{ x: 0, w: 2 }, { x: 2, w: 3 }]
    const { items, changed } = projectLayout(authored, grid, 12)
    expect(changed).toBe(false)
    expect(items).toEqual(authored)
  })

  it('does enforce the minimum span once it is already reshaping the layout', () => {
    const grid = resolveDashboardGrid({ viewportWidth: 800, baseColumns: 12 })
    expect(grid.projected).toBe(true)
    const { items } = projectLayout([{ x: 0, w: 1 }], grid, 12)
    expect(cardWidthFor(items[0].w, 800, grid.columns)).toBeGreaterThanOrEqual(MIN_CARD_WIDTH_PX)
  })

  it('leaves a comfortably-sized desktop layout exactly as authored', () => {
    const grid = resolveDashboardGrid({ viewportWidth: 1920, baseColumns: 12 })
    const authored = [{ x: 0, w: 6 }, { x: 6, w: 6 }]
    const { items, changed } = projectLayout(authored, grid, 12)
    expect(changed).toBe(false)
    expect(items).toEqual(authored)
  })

  it('collapses every card to full width when stacked', () => {
    const grid = resolveDashboardGrid({ viewportWidth: 390, baseColumns: 12 })
    const { items } = projectLayout([{ x: 6, w: 4 }, { x: 0, w: 8 }], grid, 12)
    expect(items.every((item) => item.x === 0 && item.w === 1)).toBe(true)
  })

  it('scales the ladder to the Life dashboard, which authors against 24 columns', () => {
    expect(resolveDashboardGrid({ viewportWidth: 1920, baseColumns: 24 })).toMatchObject({ mode: 'grid', columns: 24 })
    expect(resolveDashboardGrid({ viewportWidth: 800, baseColumns: 24 }).columns).toBe(4)
    expect(resolveDashboardGrid({ viewportWidth: 414, baseColumns: 24 }).mode).toBe('stacked')
  })

  it('changes behaviour exactly at the breakpoints, not around them', () => {
    expect(resolveDashboardGrid({ viewportWidth: BREAKPOINTS.sm - 1, baseColumns: 12 }).mode).toBe('stacked')
    expect(resolveDashboardGrid({ viewportWidth: BREAKPOINTS.sm, baseColumns: 12 }).mode).toBe('grid')
    expect(resolveDashboardGrid({ viewportWidth: BREAKPOINTS.lg - 1, baseColumns: 12 }).columns).toBeLessThan(12)
    expect(resolveDashboardGrid({ viewportWidth: BREAKPOINTS.lg, baseColumns: 12 }).columns).toBe(12)
  })
})
