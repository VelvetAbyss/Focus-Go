import type { SceneStrategy, SceneTheme } from './types'

type Drop = {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
  drift: number
}

type WindStreak = {
  x: number
  y: number
  len: number
  vx: number
  alpha: number
}

const COUNT = 220
const ANGLE = 0.32
const WIND_COUNT = 6

export const createStormyNightScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'dark'
  const drops: Drop[] = []
  const winds: WindStreak[] = []

  // Lightning flash state, JS-driven so timing feels organic.
  let flashAlpha = 0
  let preFlashAlpha = 0
  let nextFlashIn = 4_000 + Math.random() * 7_000
  let flashOriginX = 0.5
  let flashOriginY = 0.25

  const spawnDrop = (initial = false): Drop => {
    const len = 14 + Math.random() * 20
    return {
      x: Math.random() * (width + 200) - 100,
      y: initial ? Math.random() * height : -len,
      len,
      speed: 320 + Math.random() * 320,
      alpha: 0.16 + Math.random() * 0.26,
      drift: 0.9 + Math.random() * 0.25,
    }
  }

  const spawnWind = (initial = false): WindStreak => ({
    x: initial ? Math.random() * width : -200,
    y: height * (0.1 + Math.random() * 0.8),
    len: 120 + Math.random() * 240,
    vx: 90 + Math.random() * 120,
    alpha: 0.05 + Math.random() * 0.08,
  })

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      drops.length = 0
      winds.length = 0
      flashAlpha = 0
      preFlashAlpha = 0
      nextFlashIn = 4_000 + Math.random() * 7_000
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) drops.push(spawnDrop(true))
      for (let i = 0; i < WIND_COUNT; i += 1) winds.push(spawnWind(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Wind streaks — long, very faint horizontal trails.
      const windColor = theme === 'dark' ? '220, 230, 245' : '160, 175, 200'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.0
      for (let i = 0; i < winds.length; i += 1) {
        const w = winds[i]
        w.x += w.vx * dt
        if (w.x - w.len > width) {
          winds[i] = spawnWind()
          continue
        }
        ctx.strokeStyle = `rgba(${windColor}, ${w.alpha})`
        ctx.beginPath()
        ctx.moveTo(w.x, w.y)
        ctx.lineTo(w.x - w.len, w.y + 6)
        ctx.stroke()
      }

      // Rain
      const baseColor = theme === 'dark' ? '210, 220, 235' : '90, 110, 140'
      ctx.lineWidth = 1.15
      for (let i = 0; i < drops.length; i += 1) {
        const d = drops[i]
        const vy = d.speed * dt
        d.y += vy
        d.x += vy * ANGLE * d.drift
        if (d.y > height + d.len) {
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

      // Lightning: pre-flash micro-glow at origin, then full-screen flash.
      nextFlashIn -= dtMs
      if (nextFlashIn <= -120 && preFlashAlpha === 0 && flashAlpha === 0) {
        // schedule next flash, generate origin
        flashOriginX = 0.2 + Math.random() * 0.6
        flashOriginY = 0.15 + Math.random() * 0.35
        preFlashAlpha = 0.7
      }
      if (preFlashAlpha > 0) {
        const ox = flashOriginX * width
        const oy = flashOriginY * height
        const r = Math.max(width, height) * 0.55
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r)
        grad.addColorStop(0, `rgba(245, 244, 232, ${0.18 * preFlashAlpha})`)
        grad.addColorStop(1, 'rgba(245, 244, 232, 0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, width, height)
        preFlashAlpha = Math.max(0, preFlashAlpha - dt * 5.5)
        if (preFlashAlpha === 0) {
          flashAlpha = 0.55 + Math.random() * 0.25
          nextFlashIn = 6_000 + Math.random() * 9_000
        }
      }
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(245, 244, 232, ${flashAlpha})`
        ctx.fillRect(0, 0, width, height)
        flashAlpha = Math.max(0, flashAlpha - dt * 2.4)
      }
    },
    cleanup() {
      drops.length = 0
      winds.length = 0
      ctx = null
    },
    particleCount() {
      return drops.length + winds.length
    },
  }
}
