import { describe, expect, it } from 'vitest'
import { daylightAt, subsolarPoint, sunElevation } from './solar'

describe('solar position', () => {
  it('puts the sun over the equator near the equinox and over the tropic at the solstice', () => {
    expect(Math.abs(subsolarPoint(new Date('2026-03-20T12:00:00Z')).latitude)).toBeLessThan(0.6)
    expect(subsolarPoint(new Date('2026-06-21T12:00:00Z')).latitude).toBeCloseTo(23.44, 0)
    expect(subsolarPoint(new Date('2026-12-21T12:00:00Z')).latitude).toBeCloseTo(-23.44, 0)
  })

  it('puts the subsolar longitude near 0° at 12:00 UTC (within the equation of time)', () => {
    const { longitude } = subsolarPoint(new Date('2026-04-15T12:00:00Z'))
    expect(Math.abs(longitude)).toBeLessThan(4.5)
  })

  it('agrees with known daylight at real places', () => {
    // Hangzhou at local noon in late September: sun high in the sky.
    expect(sunElevation(new Date('2026-09-28T04:00:00Z'), 30.27, 120.15)).toBeGreaterThan(55)
    // Hangzhou at local 22:00: well below the horizon.
    expect(sunElevation(new Date('2026-09-28T14:00:00Z'), 30.27, 120.15)).toBeLessThan(-30)
    // London sunrise in late September is ~06:55 BST (05:55 UTC).
    expect(sunElevation(new Date('2026-09-28T05:40:00Z'), 51.51, -0.13)).toBeLessThan(0)
    expect(sunElevation(new Date('2026-09-28T06:15:00Z'), 51.51, -0.13)).toBeGreaterThan(0)
  })

  it('classifies daylight by elevation', () => {
    expect(daylightAt(30)).toBe('day')
    expect(daylightAt(3)).toBe('golden')
    expect(daylightAt(-3)).toBe('twilight')
    expect(daylightAt(-20)).toBe('night')
  })
})
