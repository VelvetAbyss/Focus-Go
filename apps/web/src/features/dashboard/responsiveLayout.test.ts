import { describe, expect, it } from 'vitest'
import { reflowDashboardLayout } from './responsiveLayout'
const saved = [
  { key: 'tasks', x: 0, y: 0, w: 8, h: 8 },
  { key: 'weather', x: 8, y: 0, w: 4, h: 3 },
  { key: 'worldclock', x: 8, y: 3, w: 4, h: 5 },
  { key: 'summary', x: 0, y: 8, w: 8, h: 5 },
]
describe('responsive dashboard presentation', () => {
  it.each([280, 615, 720, 900, 1119])('fits all cards without overlap at %ipx and preserves saved positions', width => {
    const snapshot = structuredClone(saved)
    const result = reflowDashboardLayout(saved, width, 4)
    expect(saved).toEqual(snapshot)
    expect(result.map(item => item.key).sort()).toEqual(saved.map(item => item.key).sort())
    for (let i = 0; i < result.length; i++) {
      const a = result[i]
      expect(a.x + a.w).toBeLessThanOrEqual(4)
      if (width < 720) expect(a.w).toBe(4)
      for (const b of result.slice(i + 1)) {
        expect(a.x >= b.x + b.w || b.x >= a.x + a.w || a.y >= b.y + b.h || b.y >= a.y + a.h).toBe(true)
      }
    }
  })
  it('restores the exact saved desktop arrangement on return to wide view', () => {
    reflowDashboardLayout(saved, 390, 4)
    expect(reflowDashboardLayout(saved, 1440, 12)).toBe(saved)
  })
})
