import { describe, expect, it } from 'vitest'
import { buildNoteRouteWithReturn, readNoteReturnPath, readReturnPath, withReturnPath, withTaskContext } from './returnPath'

describe('return paths', () => {
  it('round-trips a project notes filter and task detail', () => {
    expect(readReturnPath(new URL(buildNoteRouteWithReturn('n 1', '/projects/p1?tab=notes&q=plan'), 'https://focusgo.local').search))
      .toBe('/projects/p1?tab=notes&q=plan')
    expect(readReturnPath(new URL(withReturnPath('/focus', '/tasks?task=t1'), 'https://focusgo.local').search))
      .toBe('/tasks?task=t1')
  })

  it('rejects external and unrelated destinations', () => {
    for (const from of ['//evil.example', '/\\evil.example', '/admin', 'https://evil.example', '/tasks#fragment']) {
      expect(readReturnPath(`?from=${encodeURIComponent(from)}`)).toBeNull()
    }
  })

  it('falls back to the task detail when the source route cannot restore it', () => {
    expect(withTaskContext('/calendar', 't 1')).toBe('/tasks?task=t%201')
  })

  it('returns from a task only to a selected note', () => {
    expect(readNoteReturnPath(new URL(withReturnPath('/tasks?task=t1', '/note?note=n%201'), 'https://focusgo.local').search))
      .toBe('/note?note=n%201')
    for (const from of ['/note', '/note?note=', '/admin', '//evil.example', '/note?note=n1#fragment']) {
      expect(readNoteReturnPath(`?from=${encodeURIComponent(from)}`)).toBeNull()
    }
  })
})
