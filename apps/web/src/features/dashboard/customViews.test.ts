// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CUSTOM_VIEWS_KEY, readCustomViews, saveCustomViews, uniqueViewName, viewNameError } from './customViews'
const view = { id: 'one', name: 'Work', items: [{ key: 'tasks', x: 0, y: 0, w: 4, h: 4 }] }
beforeEach(() => localStorage.clear())
describe('saved custom views', () => {
  it('round-trips independent layouts including intentionally empty views', () => {
    saveCustomViews([view, { id: 'two', name: 'Empty', items: [] }])
    expect(readCustomViews()).toEqual([view, { id: 'two', name: 'Empty', items: [] }])
  })
  it('rejects corrupt grid values and duplicate view/widget IDs without losing valid views', () => {
    localStorage.setItem(CUSTOM_VIEWS_KEY, JSON.stringify([view, view, { id: 'bad', name: 'Bad', items: [{ key: 'tasks', x: 0, y: 0, w: -1, h: 4 }] }, { id: 'dup', name: 'Duplicate', items: [view.items[0], view.items[0]] }]))
    expect(readCustomViews()).toEqual([view])
    localStorage.setItem(CUSTOM_VIEWS_KEY, '{')
    expect(readCustomViews()).toEqual([])
  })
  it('validates trimmed names and produces a unique copy name', () => {
    expect(viewNameError(' work ', [view])).toBe('duplicate')
    expect(viewNameError('Work', [view], 'one')).toBeNull()
    expect(viewNameError(' ', [])).toBe('name')
    expect(uniqueViewName('Work', [view])).toBe('Work 2')
  })
  it('reports storage failures to the caller', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota') })
    expect(() => saveCustomViews([view])).toThrow('Quota')
    spy.mockRestore()
  })
})
