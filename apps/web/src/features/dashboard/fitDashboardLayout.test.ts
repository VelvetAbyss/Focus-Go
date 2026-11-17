import { describe, expect, it } from 'vitest'
import { fitDashboardLayout } from './fitDashboardLayout'
import { DEFAULT_DASHBOARD_LAYOUT_ITEMS } from '../../data/defaultDashboardLayout'

const sizes = [[280, 260], [320, 380], [366, 570], [820, 190], [744, 800], [1000, 500], [1180, 620], [1600, 760], [2400, 1200]]
describe('fixed dashboard geometry', () => {
  for (const count of [1, 5, 9, 13, 22]) {
    it.each(sizes)(`keeps all ${count} widgets visible at %i × %i without writing the saved desk`, (width, height) => {
      const source = Array.from({ length: count }, (_, index) => ({ key: index ? `widget-${index}` : 'tasks', x: index % 3 * 4, y: index * 8, w: 4, h: 4 + index % 4 }))
      const before = structuredClone(source)
      const fitted = fitDashboardLayout(source, width, height, 12)
      expect(source).toEqual(before)
      expect(fitted.map(item => item.key)).toEqual(source.map(item => item.key))
      for (const [index, a] of fitted.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(0)
        expect(a.y).toBeGreaterThanOrEqual(0)
        expect(a.width).toBeGreaterThan(0)
        expect(a.height).toBeGreaterThan(0)
        expect(a.x + a.width).toBeLessThanOrEqual(width + .01)
        expect(a.y + a.height).toBeLessThanOrEqual(height + .01)
        for (const b of fitted.slice(index + 1)) expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true)
      }
    })
  }
  it('keeps the wide task card and removes unused vertical gaps', () => {
    const result = fitDashboardLayout(DEFAULT_DASHBOARD_LAYOUT_ITEMS, 1400, 650, 12)
    expect(result.find(item => item.key === 'tasks')!.width).toBeGreaterThan(result.find(item => item.key === 'weather')!.width)
    expect(fitDashboardLayout([{ key: 'a', x: 0, y: 50, w: 12, h: 4 }], 1400, 650, 12)[0]).toEqual({ key: 'a', x: 0, y: 0, width: 1400, height: 650 })
  })
  it('waits for a measured canvas', () => {
    expect(fitDashboardLayout(DEFAULT_DASHBOARD_LAYOUT_ITEMS, 0, 700, 12)).toEqual([])
    expect(fitDashboardLayout(DEFAULT_DASHBOARD_LAYOUT_ITEMS, 1200, 0, 12)).toEqual([])
  })
  it.each([[1140, 600], [1400, 650], [1700, 800]])('keeps widgets tappable after appending to a saved desk at %i × %i', (width, height) => {
    const source = structuredClone(DEFAULT_DASHBOARD_LAYOUT_ITEMS)
    for (const [key, w, h] of [['spend', 4, 2], ['translation', 6, 3], ['salary-earned', 3, 4], ['salary-price', 3, 3], ['salary-breaks', 3, 6], ['bazi', 4, 4], ['astrology', 4, 4], ['tarot', 4, 4]] as const) {
      source.push({ key, x: 0, y: Math.max(...source.map(item => item.y + item.h)), w, h })
    }
    const before = structuredClone(source)
    const result = fitDashboardLayout(source, width, height, 12)
    expect(source).toEqual(before)
    expect(result).toHaveLength(13)
    expect(result.every(rect => rect.width >= 44 && rect.height >= 44)).toBe(true)
  })
})
