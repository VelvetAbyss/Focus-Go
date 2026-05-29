import type { SceneStrategy, SceneTheme } from './types'

type Drop = {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
  drift: number
}

const COUNT = 180
const ANGLE = 0.18 // slight slant in radians

export const createRainyCafeScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const drops: Drop[] = []

  const spawn = (initial = false): Drop => {
    const len = 10 + Math.random() * 16
    return {
      x: Math.random() * (width + 100) - 50,
      y: initial ? Math.random() * height : -len,
      len,
      speed: 220 + Math.random() * 260,
      alpha: 0.12 + Math.random() * 0.22,
      drift: 0.85 + Math.random() * 0.3,
    }
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      drops.length = 0
      for (let i = 0; i < COUNT; i += 1) drops.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)
      const baseColor = theme === 'dark' ? '245, 243, 240' : '58, 55, 51'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.05

      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i]
        const vy = d.speed * dt
        d.y += vy
        d.x += vy * ANGLE * d.drift
        if (d.y > height + d.len) {
          drops[i] = spawn()
          drops[i].y = -drops[i].len
          continue
        }
        ctx.strokeStyle = `rgba(${baseColor}, ${d.alpha})`
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.len * ANGLE, d.y - d.len)
        ctx.stroke()
      }
    },
    cleanup() {
      drops.length = 0
      ctx = null
    },
    particleCount() {
      return drops.length
    },
  }
}
