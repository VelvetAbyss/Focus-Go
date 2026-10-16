import { describe, expect, it } from 'vitest'
import { cleanDayNote, groupDayNotes, MAX_DAY_NOTE_LENGTH, MAX_DAY_NOTES, normalizeDayNotesState } from './dayNotesStorage'

const note = (id: string, date: string, text: string, createdAt = 1_000) => ({ id, date, text, createdAt, updatedAt: createdAt })

describe('day notes storage', () => {
  it('keeps one clean line per note and drops what cannot be a note', () => {
    const state = normalizeDayNotesState({
      notes: [
        note('a', '2026-11-17', '  妈妈\n生日  '),
        note('a', '2026-11-17', 'duplicate id'),
        note('b', '17/11/2026', 'bad date'),
        note('c', '2026-11-18', '   '),
        { id: 'd', date: '2026-11-18', text: 'no time' },
        { ...note('e', '2026-11-19', 'x'.repeat(MAX_DAY_NOTE_LENGTH + 20)), updatedAt: 'later' },
      ],
    })
    expect(state.notes.map((item) => [item.id, item.text.length])).toEqual([
      ['a', 5],
      ['e', MAX_DAY_NOTE_LENGTH],
    ])
    expect(state.notes[0].text).toBe('妈妈 生日')
    expect(state.notes[1].updatedAt).toBe(state.notes[1].createdAt)
  })

  it('shows notes on the dashboard unless switched off', () => {
    expect(normalizeDayNotesState(null).showOnDashboard).toBe(true)
    expect(normalizeDayNotesState({ notes: [] }).showOnDashboard).toBe(true)
    expect(normalizeDayNotesState({ notes: [], showOnDashboard: false }).showOnDashboard).toBe(false)
  })

  it('drops the days furthest back once over the cap', () => {
    const notes = Array.from({ length: MAX_DAY_NOTES + 2 }, (_, index) =>
      note(`n${index}`, `2026-01-01`.replace('01-01', `${String((index % 12) + 1).padStart(2, '0')}-01`), `n${index}`),
    )
    notes.push(note('old', '2020-05-05', 'oldest'))
    const kept = normalizeDayNotesState({ notes }).notes
    expect(kept).toHaveLength(MAX_DAY_NOTES)
    expect(kept.some((item) => item.id === 'old')).toBe(false)
  })

  it('groups notes by day, oldest first within a day', () => {
    const byDate = groupDayNotes([note('b', '2026-11-17', 'second', 2), note('c', '2026-11-18', 'other'), note('a', '2026-11-17', 'first', 1)])
    expect(byDate.get('2026-11-17')?.map((item) => item.text)).toEqual(['first', 'second'])
    expect(byDate.get('2026-11-18')).toHaveLength(1)
    expect(byDate.get('2026-11-19')).toBeUndefined()
  })

  it('cleans typed text to one capped line', () => {
    expect(cleanDayNote('  带伞 \n 下午有雨 ')).toBe('带伞 下午有雨')
    expect(cleanDayNote('x'.repeat(500))).toHaveLength(MAX_DAY_NOTE_LENGTH)
  })
})
