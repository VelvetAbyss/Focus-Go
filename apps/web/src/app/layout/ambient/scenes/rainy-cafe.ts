import type { SceneStrategy, SceneTheme } from './types'

type Drop = {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
  drift: number
}

type Ripple = {
  x: number
  y: number
  r: number
  maxR: number
  alpha: number
  age: number
  life: number
}

type Glint = {
  x: number
  y: number
  r: number
  vx: number
  alpha: number
  hue: number
}

const COUNT = 180
const ANGLE = 0.18
const MAX_RIPPLES = 14
const GLINT_COUNT = 4

export const createRainyCafeScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const drops: Drop[] = []
  const ripples: Ripple[] = []
  const glints: Glint[] = []

  const spawnDrop = (initial = false): Drop => {
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

  const spawnGlint = (): Glint => ({
    x: Math.random() * width,
    y: height * (0.05 + Math.random() * 0.25),
    r: 70 + Math.random() * 70,
    vx: 4 + Math.random() * 8,
    alpha: 0.04 + Math.random() * 0.06,
    hue: theme === 'dark' ? 32 : 36,
  })

  const trySpawnRipple = (drop: Drop) => {
    if (ripples.length >= MAX_RIPPLES) return
    // Only ~15% of drops produce a ripple; otherwise they recycle silently.
    if (Math.random() > 0.15) return
    ripples.push({
      x: drop.x - drop.len * ANGLE * 0.3,
      y: height - 8 - Math.random() * 18,
      r: 0,
      maxR: 6 + Math.random() * 12,
      alpha: 0.18 + Math.random() * 0.16,
      age: 0,
      life: 700 + Math.random() * 500,
    })
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      drops.length = 0
      ripples.length = 0
      glints.length = 0
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) drops.push(spawnDrop(true))
      for (let i = 0; i < GLINT_COUNT; i += 1) glints.push(spawnGlint())
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Window-light glints — soft warm circles drifting across the top.
      const glintColor = theme === 'dark' ? '255, 218, 168' : '255, 224, 178'
      for (let i = 0; i < glints.length; i += 1) {
        const g = glints[i]
        g.x += g.vx * dt
        if (g.x - g.r > width) {
          g.x = -g.r
          g.y = height * (0.05 + Math.random() * 0.25)
          g.r = 70 + Math.random() * 70
        }
        const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
        grad.addColorStop(0, `rgba(${glintColor}, ${g.alpha})`)
        grad.addColorStop(1, `rgba(${glintColor}, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // Rain
      const baseColor = theme === 'dark' ? '245, 243, 240' : '58, 55, 51'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.05
      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i]
        const vy = d.speed * dt
        d.y += vy
        d.x += vy * ANGLE * d.drift
        if (d.y > height + d.len) {
          trySpawnRipple(d)
          drops[i] = spawnDrop()
          drops[i].y = -drops[i].len
          continue
        }
        ctx.strokeStyle = `rgba(${baseColor}, ${d.alpha})`
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.len * ANGLE, d.y - d.len)
        ctx.stroke()
      }

      // Splash ripples — expanding rings near the bottom.
      ctx.lineWidth = 1
      for (let i = ripples.length - 1; i >= 0; i -= 1) {
        const r = ripples[i]
        r.age += dtMs
        if (r.age >= r.life) {
          ripples.splice(i, 1)
          continue
        }
        const t = r.age / r.life
        r.r = t * r.maxR
        const alpha = (1 - t) * r.alpha
        ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    },
    cleanup() {
      drops.length = 0
      ripples.length = 0
      glints.length = 0
      ctx = null
    },
    particleCount() {
      return drops.length + ripples.length + glints.length
    },
  }
}
