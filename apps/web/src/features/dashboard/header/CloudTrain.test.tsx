// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CloudTrain from './CloudTrain'
import { TRAIN_DEFAULTS } from './sceneSettings'
import { useHeaderScene, useSceneReducedMotion, HEADER_SCENE_KEY } from './useHeaderScene'
import { createTrainRenderer } from './cloudtrain/renderer'

// Auto-mocking also supports StrictMode's two concurrent dynamic imports;
// Vitest 3's manual factory recursion guard bypasses the mock for the second.
vi.mock('./cloudtrain/renderer')
const renderer = { create: vi.mocked(createTrainRenderer), update: vi.fn(), dispose: vi.fn() }
let reduced = false
const mediaListeners = new Set<() => void>()
let connection: EventTarget & { saveData: boolean }
beforeEach(() => {
  localStorage.clear(); reduced = false; mediaListeners.clear()
  delete document.documentElement.dataset.motion
  connection = Object.assign(new EventTarget(), { saveData: false })
  Object.defineProperty(navigator, 'connection', { configurable: true, value: connection })
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener: (_: string, fn: () => void) => mediaListeners.add(fn), removeEventListener: (_: string, fn: () => void) => mediaListeners.delete(fn) }))
  renderer.create.mockReset(); renderer.update.mockReset(); renderer.dispose.mockReset()
  renderer.create.mockImplementation((_canvas, _options, onReady) => { onReady(true); return { update: renderer.update, dispose: renderer.dispose } })
})
afterEach(async () => { cleanup(); await vi.dynamicImportSettled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete document.documentElement.dataset.motion })

function Harness() {
  const [scene, update] = useHeaderScene()
  const reducedMotion = useSceneReducedMotion()
  return <><button onClick={() => update({ paused: !scene.paused })}>pause</button><CloudTrain palette={scene.palette === 'auto' ? 'sunset' : scene.palette} paused={scene.paused || reducedMotion} /></>
}
describe('cloud train component lifecycle', () => {
  it('does not create a renderer after an asynchronous mount was cancelled', async () => {
    const { unmount } = render(<CloudTrain palette="sunset" paused={false} />)
    unmount()
    await act(async () => { await vi.dynamicImportSettled() })
    expect(renderer.create).not.toHaveBeenCalled()
  })
  it('creates only one live renderer in StrictMode and disposes it when leaving', async () => {
    const { rerender, unmount } = render(<StrictMode><CloudTrain palette="sunset" paused={false} /></StrictMode>)
    await waitFor(() => expect(renderer.create).toHaveBeenCalledTimes(1))
    rerender(<StrictMode><CloudTrain palette="night" paused settings={{ ...TRAIN_DEFAULTS, speed: 1.2, steam: 0, trainScale: 140 }} /></StrictMode>)
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, speed: 1.2, steam: 0, trainScale: 140, palette: 'night', paused: true })
    expect(renderer.create).toHaveBeenCalledTimes(1)
    unmount(); expect(renderer.dispose).toHaveBeenCalledTimes(1)
  })
  it('keeps the still illustration when WebGL cannot render', async () => {
    renderer.create.mockImplementation((_canvas, _options, onReady) => { onReady(false); return { update: renderer.update, dispose: renderer.dispose } })
    const { container } = render(<CloudTrain palette="morning" paused={false} />)
    await waitFor(() => expect(renderer.create).toHaveBeenCalledTimes(1))
    expect(container.querySelector('.dash-cloudtrain')?.getAttribute('data-ready')).toBe('false')
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('respects OS, app, save-data and persisted manual pause independently', async () => {
    const { unmount } = render(<Harness />)
    await waitFor(() => expect(renderer.create).toHaveBeenCalledTimes(1))
    act(() => { reduced = true; mediaListeners.forEach(fn => fn()) })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'sunset', paused: true })
    await act(async () => { document.documentElement.dataset.motion = 'reduce'; reduced = false; mediaListeners.forEach(fn => fn()) })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'sunset', paused: true })
    act(() => { connection.saveData = true; connection.dispatchEvent(new Event('change')) })
    await act(async () => { delete document.documentElement.dataset.motion })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'sunset', paused: true })
    act(() => { connection.saveData = false; connection.dispatchEvent(new Event('change')) })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'sunset', paused: false })
    act(() => { localStorage.setItem(HEADER_SCENE_KEY, JSON.stringify({ paused: true, palette: 'night' })); window.dispatchEvent(new StorageEvent('storage', { key: HEADER_SCENE_KEY })) })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'night', paused: true })
    act(() => { reduced = true; mediaListeners.forEach(fn => fn()); reduced = false; mediaListeners.forEach(fn => fn()) })
    expect(renderer.update).toHaveBeenLastCalledWith({ ...TRAIN_DEFAULTS, palette: 'night', paused: true })
    unmount(); expect(mediaListeners.size).toBe(0)
  })
})
