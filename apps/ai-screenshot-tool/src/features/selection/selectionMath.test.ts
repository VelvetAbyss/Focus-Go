import { describe, expect, it } from 'vitest'
import { findSnapWindow, rectFromPoints, toLocalRect } from './selectionMath'
import type { WindowInfo } from '../../native/screenshotCommands'

describe('selectionMath', () => {
  it('creates normalized rectangle from drag points', () => {
    const rect = rectFromPoints({ x: 200, y: 120 }, { x: 20, y: 40 })

    expect(rect).toEqual({
      x: 20,
      y: 40,
      width: 180,
      height: 80,
    })
  })

  it('snaps to matching window on active monitor', () => {
    const windows: WindowInfo[] = [
      {
        id: 1,
        monitorId: 1,
        appName: 'Focus&Go',
        title: 'Dashboard',
        x: 100,
        y: 100,
        width: 500,
        height: 400,
        z: 1,
        isFocused: true,
      },
      {
        id: 2,
        monitorId: 2,
        appName: 'Browser',
        title: 'Docs',
        x: 2000,
        y: 100,
        width: 600,
        height: 500,
        z: 2,
        isFocused: false,
      },
    ]

    const snapped = findSnapWindow(windows, { x: 150, y: 150 }, 1)

    expect(snapped?.id).toBe(1)
  })

  it('converts global window bounds into monitor-local bounds', () => {
    const window: WindowInfo = {
      id: 3,
      monitorId: 2,
      appName: 'Editor',
      title: 'Capture',
      x: 2200,
      y: 180,
      width: 800,
      height: 600,
      z: 5,
      isFocused: true,
    }

    const localRect = toLocalRect(window, { x: 1920, y: 0 })

    expect(localRect).toEqual({
      x: 280,
      y: 180,
      width: 800,
      height: 600,
    })
  })
})
