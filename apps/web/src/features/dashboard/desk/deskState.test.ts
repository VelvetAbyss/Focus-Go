// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_DESK, DESK_STORAGE_KEY, parseDeskSettings, readDeskSettings, writeDeskSettings } from './deskState'

describe('desk settings', () => {
  afterEach(() => window.localStorage.removeItem(DESK_STORAGE_KEY))

  it('starts with the lamp off, a book and a coffee', () => {
    expect(parseDeskSettings(null)).toEqual(DEFAULT_DESK)
    expect(DEFAULT_DESK).toMatchObject({ lampOn: false, item: 'book', drink: 'coffee' })
  })

  it('round-trips through storage', () => {
    const settings = { lampOn: true, pose: { a1: 0.1, a2: 1.5, a3: -1.2 }, item: 'laptop' as const, drink: 'cola' as const }
    writeDeskSettings(settings)
    expect(readDeskSettings()).toEqual(settings)
  })

  it('falls back field by field on damaged data', () => {
    expect(parseDeskSettings('{not json')).toEqual(DEFAULT_DESK)
    expect(parseDeskSettings(JSON.stringify({ lampOn: 'yes', pose: { a1: 'x' }, item: 'tablet', drink: 'tea' }))).toEqual(DEFAULT_DESK)
    expect(parseDeskSettings(JSON.stringify({ lampOn: true }))).toEqual({ ...DEFAULT_DESK, lampOn: true })
  })
})
