import type { SceneStrategy } from './types'

export const createIdleScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  return {
    init(canvas) {
      ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
    tick() {
      // CSS-only animated mesh; nothing to draw.
    },
    cleanup() {
      ctx = null
    },
    particleCount() {
      return 0
    },
  }
}
