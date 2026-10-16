import { describe, expect, it } from 'vitest'
import { defaultPicture, fitPicture, parsePicture } from './pictureTypes'
import { parseDeskSettings } from './deskState'

describe('persistent pictures', () => {
  it('preserves multiple independent windows and a frame, including their crop and open state', () => {
    const window = { ...defaultPicture('window'), source: 'local:test-image', x: 0, y: 0.6, open: true, panX: 0.2, zoom: 1.4 }
    const items = [
      { id: 'a', kind: 'window', x: -3, picture: window },
      { id: 'b', kind: 'window', x: 2, picture: { ...defaultPicture('window'), source: 'neon' } },
      { id: 'c', kind: 'frame', x: 1, picture: defaultPicture('frame') },
    ]
    const saved = parseDeskSettings(JSON.stringify({ items }))
    expect(saved.items).toHaveLength(3)
    expect(saved.items[0].picture).toMatchObject({ source: 'local:test-image', y: 0.6, open: true, panX: 0.2, zoom: 1.4 })
    expect(saved.items[1].picture).toMatchObject({ source: 'neon', open: false })
    expect(parseDeskSettings(JSON.stringify(saved))).toEqual(saved)
  })
  it('rejects external URLs and nonfinite crop coordinates without losing the picture', () => {
    expect(parsePicture('window', { source: 'javascript:alert(1)', width: Infinity, zoom: NaN, panY: -2 })).toMatchObject({
      source: 'mediterranean', width: 3.6, zoom: 1, panY: 0,
    })
    expect(parsePicture('frame', { y: 3 }).y).toBe(3)
    expect(parsePicture('frame', { y: 0 }).y).toBe(defaultPicture('frame').y)
  })
  it('fits the full sill and preserves aspect ratio and the saved size after a resize', () => {
    const saved = { ...defaultPicture('window'), width: 7, height: 3, y: 2 }
    const shown = fitPicture(saved, { left: -2, right: 2 }, 2.4)
    expect(shown.width * 1.06).toBeLessThanOrEqual(4 - 0.16 + 1e-10)
    expect(shown.height + shown.y).toBeLessThanOrEqual(2.4 - 0.08)
    expect(shown.width / shown.height).toBeCloseTo(7 / 3)
    expect(saved).toMatchObject({ width: 7, height: 3, y: 2 })
    expect(fitPicture(saved, { left: -8, right: 8 }, 6)).toEqual(saved)
    const frame=fitPicture({ ...defaultPicture('frame'), height: 4, y: 3 }, {left:-3,right:3}, 2.4, 'frame')
    expect(frame.y).toBeGreaterThan(0)
    expect(frame.y + frame.height * 1.15).toBeLessThanOrEqual(2.4 - .08 + 1e-10)
  })
})
