import type { SceneStrategy, SceneTheme } from './types'

type Ember = {
  x: number
  y: number
  r: number
  vy: number
  wobblePhase: number
  wobbleAmp: number
  life: number
  age: number
  hue: number
}

const COUNT = 60

export const createCozyFiresideScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const embers: Ember[] = []

  const spawn = (initial = false): Ember => {
    const life = 2_400 + Math.random() * 3_200
    // Embers rise from the bottom; spread across full width with a slight bias to lower 70%.
    return {
      x: Math.random() * width,
      y: initial ? height * (0.3 + Math.random() * 0.7) : height + 8,
      r: 0.9 + Math.random() * 1.8,
      vy: -(24 + Math.random() * 40),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 8 + Math.random() * 16,
      life,
      age: initial ? Math.random() * life : 0,
      hue: 18 + Math.random() * 22, // 18°–40°, ember-orange
    }
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      embers.length = 0
      for (let i = 0; i < COUNT; i += 1) embers.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < embers.length; i += 1) {
        const e = embers[i]
        e.age += dtMs
        if (e.age > e.life || e.y < -10) {
          embers[i] = spawn()
          continue
        }
        e.y += e.vy * dt
        e.wobblePhase += dt * 1.6
        const drawX = e.x + Math.sin(e.wobblePhase) * e.wobbleAmp
        const t = e.age / e.life
        const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * (theme === 'dark' ? 0.85 : 0.7)
        const lightness = 55 + (1 - t) * 20
        ctx.fillStyle = `hsla(${e.hue}, 90%, ${lightness}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(drawX, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
    },
    cleanup() {
      embers.length = 0
      ctx = null
    },
    particleCount() {
      return embers.length
    },
  }
}
