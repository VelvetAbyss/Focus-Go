// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent } from '@testing-library/dom'
import type { HangingNote } from '../../../data/models/types'
import { createHangingNotes } from './controller'

const a: HangingNote = { id: 'a', text: 'A', color: 'butter' }
const b: HangingNote = { id: 'b', text: 'B', color: 'sage' }
let engine: ReturnType<typeof createHangingNotes>, root: HTMLDivElement
const get = (name: string) => root.querySelector<HTMLElement>(`#fg-notes-${name}`)!
const click = (name: string) => get(name).click()
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Element.prototype.getAnimations = () => []
  document.body.innerHTML = '<main><header class="dash-header"><div class="dash-notes-anchor"></div><figure class="dash-hero__quote"></figure></header><div class="dashboard-notes"></div></main>'
  root = document.querySelector('.dashboard-notes')!
  Object.defineProperties(root, { clientWidth: { value: 1000 }, clientHeight: { value: 800 } })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const x = this.classList.contains('dash-notes-anchor') ? 440 : this.classList.contains('dash-hero__quote') ? 800 : 0
    const width = this === root ? 1000 : 100
    return { x, y: 0, left: x, right: x + width, top: 0, bottom: 100, width, height: 100, toJSON() {} }
  })
})
afterEach(() => { engine?.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('hanging note interaction state', () => {
  it('retries an earlier failed edit when saving a different sheet', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    engine = createHangingNotes(root, [a, b], (next, before) => save(next, before()))
    click('paper-stack'); fireEvent.input(get('note-text'), { target: { value: 'A changed' } }); await flush()
    expect(get('save-status').textContent).toContain('重试')
    click('next-note'); fireEvent.input(get('note-text'), { target: { value: 'B changed' } }); await flush()
    expect(save.mock.calls[1][0]).toEqual([{ ...a, text: 'A changed' }, { ...b, text: 'B changed' }])
    expect(save.mock.calls[1][1]).toEqual([a, b])
    expect(get('save-status').textContent).toBe('已保存')
  })
  it('compares a queued revert against the last completed write', async () => {
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const writes: { next: HangingNote[]; before: HangingNote[] }[] = []
    let queue = Promise.resolve()
    engine = createHangingNotes(root, [a], (next, getBefore) => {
      const save = queue.then(async () => {
        writes.push({ next, before: getBefore() })
        if (writes.length === 1) await barrier
      })
      queue = save
      return save
    })
    click('paper-stack')
    fireEvent.input(get('note-text'), { target: { value: 'B' } })
    fireEvent.input(get('note-text'), { target: { value: 'A' } })
    await flush(); release(); await flush(); await flush()
    expect(writes[1]).toEqual({ next: [a], before: [{ ...a, text: 'B' }] })
  })
  it('archives a just-added note even if the component unmounts while writes wait', async () => {
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const writes: { next: HangingNote[]; before: HangingNote[] }[] = []
    let queue = Promise.resolve()
    engine = createHangingNotes(root, [], (next, getBefore) => {
      const save = queue.then(async () => {
        writes.push({ next, before: getBefore() })
        if (writes.length === 1) await barrier
      })
      queue = save
      return save
    })
    click('paper-stack'); click('archive-note'); engine.destroy()
    await flush(); release(); await flush(); await flush()
    expect(writes[1].next).toEqual([])
    expect(writes[1].before).toEqual(writes[0].next)
    expect(writes[1].before).toHaveLength(1)
  })
  it('keeps a failed draft when unrelated incoming data arrives', async () => {
    engine = createHangingNotes(root, [a], vi.fn().mockRejectedValue(new Error('quota')))
    click('paper-stack'); fireEvent.input(get('note-text'), { target: { value: 'Unsaved draft' } }); await flush()
    engine.update([a, b]); click('close-note'); click('paper-stack')
    expect((get('note-text') as HTMLTextAreaElement).value).toBe('Unsaved draft')
  })
  it('archives the intended ID after a deferred incoming removal', () => {
    const save = vi.fn().mockResolvedValue(undefined)
    engine = createHangingNotes(root, [a, b], (next, before) => save(next, before()))
    click('paper-stack'); click('next-note'); engine.update([b]); click('archive-note')
    expect(save.mock.calls[0][0]).toEqual([])
    expect(root.dataset.hangingCount).toBe('0')
  })
  it('returns the latest note object after a deferred incoming edit', () => {
    const pinned = { ...b, pin: { u: .5, y: 200, tilt: 0 } }, save = vi.fn().mockResolvedValue(undefined)
    engine = createHangingNotes(root, [a, pinned], (next, before) => save(next, before()))
    root.querySelector<HTMLButtonElement>('.loose-note')!.click()
    engine.update([{ ...pinned, text: 'Remote edit' }]); click('return-note')
    expect(save.mock.calls[0][0]).toEqual([{ ...b, text: 'Remote edit' }])
    expect(root.querySelectorAll('.loose-note')).toHaveLength(0)
  })
  it('removes listeners and owned DOM on unmount', () => {
    engine = createHangingNotes(root, [a], vi.fn().mockResolvedValue(undefined))
    engine.destroy(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(root.childElementCount).toBe(0)
  })
})


describe('hanging anchor state', () => {
  it('retains a failed anchor move when the next action edits a note', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('disk unavailable')).mockResolvedValue(undefined)
    engine = createHangingNotes(root, [a], (next, before, anchor) => save(next, before(), anchor.next, anchor.before()), true, .5)
    fireEvent.keyDown(get('pin'), { key: 'ArrowRight' }); await flush()
    click('paper-stack'); fireEvent.input(get('note-text'), { target: { value: 'changed' } }); await flush()
    expect(save.mock.calls[1]).toEqual([[{ ...a, text: 'changed' }], [a], .508, .5])
    expect(get('save-status').textContent).toBe('已保存')
  })
  it('resolves queued anchor baselines after the previous write completes', async () => {
    let release!: () => void
    const barrier = new Promise<void>(resolve => { release = resolve })
    const writes: { next: number | undefined; before: number | undefined }[] = []
    let queue = Promise.resolve()
    engine = createHangingNotes(root, [a], (_next, _before, anchor) => {
      const save = queue.then(async () => {
        writes.push({ next: anchor.next, before: anchor.before() })
        if (writes.length === 1) await barrier
      })
      queue = save
      return save
    }, true, .5)
    fireEvent.keyDown(get('pin'), { key: 'ArrowRight' })
    fireEvent.keyDown(get('pin'), { key: 'ArrowLeft' })
    await flush(); release(); await flush(); await flush()
    expect(writes).toEqual([{ next: .508, before: .5 }, { next: .5, before: .508 }])
  })
  it('defers incoming anchor changes while reading a note and keeps pinned papers in place', async () => {
    const pinned = { ...b, pin: { u: .4, y: 350, tilt: 0 } }
    engine = createHangingNotes(root, [a, pinned], async () => undefined, true, .2)
    expect(get('pin').style.left).toBe('200px')
    const paper = root.querySelector<HTMLElement>('.loose-note')!, pose = paper.style.transform
    click('paper-stack'); engine.update([a, pinned], .6)
    expect(get('pin').style.left).toBe('200px')
    click('close-note')
    expect(get('pin').style.left).toBe('600px')
    expect(paper.style.transform).toBe(pose)
  })
})
