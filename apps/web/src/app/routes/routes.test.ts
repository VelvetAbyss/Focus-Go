import { describe, expect, it } from 'vitest'
import { BASE_NAV_ITEMS, LEGACY_ROUTES, ROUTES } from './routes'

describe('routes config', () => {
  it('defines note, labs, and habits routes', () => {
    expect(ROUTES.NOTE).toBe('/note')
    expect(ROUTES.LABS).toBe('/labs')
    expect(ROUTES.HABITS).toBe('/habits')
  })

  it('keeps dashboard first in base nav', () => {
    expect(BASE_NAV_ITEMS[0]?.key).toBe('dashboard')
  })

  it('keeps only the supported primary modules in navigation', () => {
    expect(BASE_NAV_ITEMS.map((item) => item.key)).toEqual([
      'dashboard',
      'tasks',
      'note',
      'calendar',
      'focus',
      'review',
      'settings',
    ])
    expect(LEGACY_ROUTES.KNOWLEDGE).toBe('/knowledge')
  })
})
