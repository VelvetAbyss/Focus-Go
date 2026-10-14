// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { LAMP_X } from './deskLayout'
import { DEFAULT_DESK, DESK_STORAGE_KEY, parseDeskSettings, readDeskSettings, writeDeskSettings, type DeskSettings } from './deskState'

describe('desk settings', () => {
  afterEach(() => window.localStorage.removeItem(DESK_STORAGE_KEY))

  it('starts with the lamp off over a book, with a coffee and a plant', () => {
    expect(parseDeskSettings(null)).toEqual(DEFAULT_DESK)
    expect(DEFAULT_DESK).toMatchObject({ lampOn: false, lampX: LAMP_X, note: false })
    expect(DEFAULT_DESK.items.map((item) => [item.kind, item.x])).toEqual([['plant', -3.3], ['coffee', -1.8], ['book', 0]])
  })

  it('round-trips through storage, any number of props, the same kind twice', () => {
    const settings: DeskSettings = {
      lampOn: true,
      lampX: -0.5,
      pose: { a1: 0.1, a2: 1.5, a3: -1.2 },
      items: [
        { id: 'a', kind: 'cat', x: -4.2 },
        { id: 'b', kind: 'cat', x: 3.1 },
        { id: 'c', kind: 'timer', x: 1.2, endsAt: 1_800_000_000_000 },
        { id: 'd', kind: 'record', x: 0 },
      ],
      note: true,
    }
    writeDeskSettings(settings)
    expect(readDeskSettings()).toEqual(settings)
  })

  it('stands the props of the desk with fixed places where those places were', () => {
    const stored = { lampOn: true, slots: { center: 'record', left: 'timer', side: 'cat' }, timerEndsAt: 1_800_000_000_000 }
    expect(parseDeskSettings(JSON.stringify(stored))).toMatchObject({
      lampOn: true,
      items: [
        { kind: 'cat', x: -3.3 },
        { kind: 'timer', x: -1.8, endsAt: 1_800_000_000_000 },
        { kind: 'record', x: 0 },
      ],
    })
    // An empty outer place, and the first desk's book-or-laptop and drink.
    expect(parseDeskSettings(JSON.stringify({ slots: { center: 'book', left: 'cola', side: 'none' } })).items.map((item) => item.kind)).toEqual(['cola', 'book'])
    expect(parseDeskSettings(JSON.stringify({ item: 'laptop', drink: 'cola' })).items.map((item) => item.kind)).toEqual(['plant', 'cola', 'laptop'])
  })

  it('keeps an empty desk empty', () => {
    expect(parseDeskSettings(JSON.stringify({ items: [] })).items).toEqual([])
  })

  it('drops damaged props and falls back field by field', () => {
    expect(parseDeskSettings('{not json')).toEqual(DEFAULT_DESK)
    expect(parseDeskSettings(JSON.stringify({ lampOn: 'yes', lampX: 'left', pose: { a1: 'x' } }))).toEqual(DEFAULT_DESK)
    const items = [
      { id: 'a', kind: 'tea', x: 0 },
      { id: 'b', kind: 'cat', x: Number.POSITIVE_INFINITY },
      { id: 'c', kind: 'cat', x: 1, endsAt: 5 },
      { id: 'c', kind: 'book', x: 2 },
      { kind: 'book', x: 2 },
    ]
    expect(parseDeskSettings(JSON.stringify({ items })).items).toEqual([{ id: 'c', kind: 'cat', x: 1 }])
  })
})
