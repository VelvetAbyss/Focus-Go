import type { SceneStrategy, SceneTheme } from './types'

type Drop = {
  x: number
  y: number
  len: number
  speed: number
  alpha: number
  drift: number
}

const COUNT = 220
const ANGLE = 0.32 // heavier slant

export const createStormyNightScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'dark'
  const drops: Drop[] = []

  // Lightning flash state, JS-driven so timing feels organic.
  let flashAlpha = 0
  let nextFlashIn = 4_000 + Math.random() * 7_000
  let flashEnergy = 0

  const spawn = (initial = false): Drop => {
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

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      drops.length = 0
      flashAlpha = 0
      flashEnergy = 0
      nextFlashIn = 4_000 + Math.random() * 7_000
      for (let i = 0; i < COUNT; i += 1) drops.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Rain
      const baseColor = theme === 'dark' ? '210, 220, 235' : '90, 110, 140'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.15
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

      // Lightning flash
      nextFlashIn -= dtMs
      if (nextFlashIn <= 0) {
        flashEnergy = 0.55 + Math.random() * 0.25
        flashAlpha = flashEnergy
        nextFlashIn = 6_000 + Math.random() * 9_000
      }
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(245, 244, 232, ${flashAlpha})`
        ctx.fillRect(0, 0, width, height)
        flashAlpha = Math.max(0, flashAlpha - dt * 2.4)
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
