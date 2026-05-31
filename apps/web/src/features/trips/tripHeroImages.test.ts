import { describe, expect, it } from 'vitest'
import { buildTripHeroImageQuery, resolveTripHeroImage } from './tripHeroImages'

describe('buildTripHeroImageQuery', () => {
  it('prefers destination text', () => {
    expect(buildTripHeroImageQuery(' Tokyo,   Japan ', 'Tokyo Trip')).toBe('Tokyo, Japan')
  })

  it('falls back to title without the generic trip suffix', () => {
    expect(buildTripHeroImageQuery('', 'Seoul Trip')).toBe('Seoul')
  })
})

describe('resolveTripHeroImage', () => {
  it('uses curated destination matches for common cities', () => {
    const match = resolveTripHeroImage('Paris, France', 'Summer')

    expect(match.label).toBe('Paris, France')
    expect(match.url).toContain('images.unsplash.com')
  })

  it('matches destinations written without spaces', () => {
    const match = resolveTripHeroImage('NewZealand', 'Holiday')

    expect(match.label).toBe('New Zealand')
    expect(match.url).toContain('images.unsplash.com')
  })

  it('uses a stable fallback image for unknown destinations', () => {
    const match = resolveTripHeroImage('Reykjavik, Iceland', 'Winter')

    expect(match.label).toBe('Iceland')
    expect(match.url).toContain('images.unsplash.com')
    expect(match.url).not.toContain('source.unsplash.com')
  })
})
