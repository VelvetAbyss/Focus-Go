import { describe, expect, it } from 'vitest'
import { BASE_NAV_ITEMS, ROUTES } from './routes'

describe('routes config', () => {
  it('defines labs, rss, and habits routes', () => {
    expect(ROUTES.LABS).toBe('/labs')
    expect(ROUTES.RSS).toBe('/rss')
    expect(ROUTES.HABITS).toBe('/habits')
  })

  it('keeps dashboard first in base nav and excludes rss', () => {
    expect(BASE_NAV_ITEMS[0]?.key).toBe('dashboard')
    expect(BASE_NAV_ITEMS.some((item) => item.key === 'rss')).toBe(false)
  })
})
