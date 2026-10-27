// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createSpringRenderer } from './renderer'
import { SPRING_DEFAULTS } from '../sceneSettings'

vi.mock('./terrain', () => ({
  WORLD: { height: 2240 }, random: () => () => .5,
  createTerrain: () => ({ canvas: {}, trees: [] }), createCloud: () => ({}),
  createPaper: () => { throw new Error('canvas allocation failed') },
  createEdge: vi.fn(), riverX: vi.fn(), riverWidth: vi.fn(), wrap: vi.fn(),
}))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('releases observers and visibility listening when the first frame cannot allocate its canvas', () => {
  const resizeDisconnect = vi.fn(), intersectionDisconnect = vi.fn()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = resizeDisconnect })
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect = intersectionDisconnect })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const remove = vi.spyOn(document, 'removeEventListener')
  const canvas = document.createElement('canvas')
  vi.spyOn(canvas, 'getContext').mockReturnValue({} as CanvasRenderingContext2D)
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 100 } as DOMRect)
  const ready = vi.fn()
  const renderer = createSpringRenderer(canvas, { ...SPRING_DEFAULTS, palette: 'day' }, ready)
  expect(ready).toHaveBeenLastCalledWith(false)
  expect(resizeDisconnect).toHaveBeenCalledOnce()
  expect(intersectionDisconnect).toHaveBeenCalledOnce()
  expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  expect(() => renderer.update({ ...SPRING_DEFAULTS, palette: 'day' })).not.toThrow()
  renderer.dispose()
})
