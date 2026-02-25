import { describe, expect, it } from 'vitest'
import { LEGACY_ROUTES, NAV_ITEMS, ROUTES } from './routes'

describe('routes config', () => {
  it('defines eight core module routes', () => {
    expect(Object.keys(ROUTES).length).toBe(8)
    expect(ROUTES.DASHBOARD).toBe('/')
    expect(ROUTES.RSS).toBe('/rss')
    expect(ROUTES.TASKS).toBe('/tasks')
    expect(ROUTES.CALENDAR).toBe('/calendar')
    expect(ROUTES.FOCUS).toBe('/focus')
    expect(ROUTES.NOTES).toBe('/note')
    expect(LEGACY_ROUTES.KNOWLEDGE).toBe('/knowledge')
    expect(ROUTES.REVIEW).toBe('/review')
    expect(ROUTES.SETTINGS).toBe('/workspace/settings')
  })

  it('has matching sidebar items and keeps dashboard first', () => {
    expect(NAV_ITEMS).toHaveLength(8)
    expect(NAV_ITEMS[0]?.key).toBe('dashboard')
    expect(NAV_ITEMS[0]?.to).toBe(ROUTES.DASHBOARD)
    expect(NAV_ITEMS[1]?.key).toBe('rss')
    expect(NAV_ITEMS[1]?.to).toBe(ROUTES.RSS)
  })
})
