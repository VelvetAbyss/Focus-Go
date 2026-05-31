import type { SceneStrategy, SceneTheme } from './types'

type Mote = {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  phase: number
}

const COUNT = 12

export const createIdleScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const motes: Mote[] = []

  const spawn = (initial = false): Mote => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : height + 8,
    r: 0.9 + Math.random() * 1.8,
    vx: -4 + Math.random() * 8,
    vy: -(3 + Math.random() * 8),
    alpha: 0.06 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
  })

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      motes.length = 0
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) motes.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Dust motes drifting upward — like sun-light catching particles in a quiet room.
      const base = theme === 'dark' ? '245, 240, 226' : '90, 78, 60'
      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i]
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.phase += dt * 0.6
        if (m.y < -10 || m.x < -10 || m.x > width + 10) {
          motes[i] = spawn()
          continue
        }
        const wobble = Math.sin(m.phase) * 4
        const a = m.alpha * (theme === 'dark' ? 0.7 : 1)
        ctx.fillStyle = `rgba(${base}, ${a})`
        ctx.beginPath()
        ctx.arc(m.x + wobble, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    cleanup() {
      motes.length = 0
      ctx = null
    },
    particleCount() {
      return motes.length
    },
  }
}
