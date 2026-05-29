import type { SceneStrategy, SceneTheme } from './types'

type Mote = {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  life: number
  age: number
}

const COUNT = 40

export const createOceanBreezeScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const motes: Mote[] = []

  const spawn = (initial = false): Mote => {
    const life = 4_000 + Math.random() * 5_000
    return {
      x: Math.random() * width,
      y: initial ? Math.random() * height : height + 12,
      r: 1.4 + Math.random() * 2.6,
      vx: -8 + Math.random() * 16,
      vy: -(14 + Math.random() * 22),
      life,
      age: initial ? Math.random() * life : 0,
    }
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      motes.length = 0
      for (let i = 0; i < COUNT; i += 1) motes.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      const base = theme === 'dark' ? '210, 230, 230' : '245, 248, 245'
      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i]
        m.age += dtMs
        if (m.age > m.life || m.y < -20) {
          motes[i] = spawn()
          continue
        }
        m.x += m.vx * dt
        m.y += m.vy * dt
        const t = m.age / m.life
        // fade in then out
        const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.55
        ctx.fillStyle = `rgba(${base}, ${alpha})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
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
