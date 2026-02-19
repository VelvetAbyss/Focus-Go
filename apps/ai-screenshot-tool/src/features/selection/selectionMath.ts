import type { WindowInfo } from '../../native/screenshotCommands'

export type Point = { x: number; y: number }
export type Rect = { x: number; y: number; width: number; height: number }

export const rectFromPoints = (start: Point, end: Point): Rect => ({
  x: Math.min(start.x, end.x),
  y: Math.min(start.y, end.y),
  width: Math.abs(end.x - start.x),
  height: Math.abs(end.y - start.y),
})

export const containsPoint = (rect: Rect, point: Point): boolean =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height

export const findSnapWindow = (
  windows: WindowInfo[],
  globalPointer: Point,
  monitorId: number | null,
): WindowInfo | null => {
  const targetWindows = monitorId == null ? windows : windows.filter((window) => window.monitorId === monitorId)

  for (const window of targetWindows) {
    const rect: Rect = {
      x: window.x,
      y: window.y,
      width: window.width,
      height: window.height,
    }

    if (containsPoint(rect, globalPointer)) {
      return window
    }
  }

  return null
}

export const toLocalRect = (window: WindowInfo, monitorOrigin: Point): Rect => ({
  x: window.x - monitorOrigin.x,
  y: window.y - monitorOrigin.y,
  width: window.width,
  height: window.height,
})
