// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createUnsavedEditJournal } from './unsavedEdit'

const key = 'focusgo.test.recovery-journal'
const journal = createUnsavedEditJournal<{ title: string }>(key)

afterEach(() => window.localStorage.removeItem(key))

describe('note recovery journal', () => {
  it('keeps edits for separate notes and only clears the matching saved revision', () => {
    expect(journal.stash({ id: 'note-a', patch: { title: 'A1' }, at: 1 })).toBe(true)
    expect(journal.stash({ id: 'note-b', patch: { title: 'B1' }, at: 2 })).toBe(true)
    expect(journal.stash({ id: 'note-a', patch: { title: 'A2' }, at: 3 })).toBe(true)
    journal.clear('note-a', 1)
    expect(journal.list()).toEqual([
      { id: 'note-a', patch: { title: 'A2' }, at: 3 },
      { id: 'note-b', patch: { title: 'B1' }, at: 2 },
    ])
    journal.clear('note-b', 2)
    expect(journal.list()).toEqual([{ id: 'note-a', patch: { title: 'A2' }, at: 3 }])
  })

  it('reads the previous single-edit format without dropping it when another note is edited', () => {
    window.localStorage.setItem(key, JSON.stringify({ id: 'old-note', patch: { title: 'Old' }, at: 1 }))
    expect(journal.stash({ id: 'new-note', patch: { title: 'New' }, at: 2 })).toBe(true)
    expect(journal.list().map((edit) => edit.id)).toEqual(['old-note', 'new-note'])
  })
})
