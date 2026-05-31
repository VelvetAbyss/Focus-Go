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
  isSpark: boolean
}

const COUNT = 60
const MAX_TOTAL = 90

export const createCozyFiresideScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const embers: Ember[] = []
  let nextBurstIn = 4_000 + Math.random() * 4_000

  const spawn = (initial = false): Ember => {
    const life = 2_400 + Math.random() * 3_200
    return {
      x: Math.random() * width,
      y: initial ? height * (0.3 + Math.random() * 0.7) : height + 8,
      r: 0.9 + Math.random() * 1.8,
      vy: -(24 + Math.random() * 40),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 8 + Math.random() * 16,
      life,
      age: initial ? Math.random() * life : 0,
      hue: 18 + Math.random() * 22,
      isSpark: false,
    }
  }

  const spawnSpark = (): Ember => {
    const life = 900 + Math.random() * 700
    return {
      x: width * (0.3 + Math.random() * 0.4),
      y: height - 20 - Math.random() * 60,
      r: 1.8 + Math.random() * 1.6,
      vy: -(80 + Math.random() * 100),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 4 + Math.random() * 8,
      life,
      age: 0,
      hue: 12 + Math.random() * 18,
      isSpark: true,
    }
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      embers.length = 0
      nextBurstIn = 4_000 + Math.random() * 4_000
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) embers.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      // Periodic spark bursts — a small flurry of brighter, faster embers.
      nextBurstIn -= dtMs
      if (nextBurstIn <= 0 && embers.length < MAX_TOTAL) {
        const count = 3 + Math.floor(Math.random() * 4)
        for (let i = 0; i < count && embers.length < MAX_TOTAL; i += 1) {
          embers.push(spawnSpark())
        }
        nextBurstIn = 4_000 + Math.random() * 4_500
      }

      for (let i = embers.length - 1; i >= 0; i -= 1) {
        const e = embers[i]
        e.age += dtMs
        if (e.age > e.life || e.y < -10) {
          if (e.isSpark) {
            embers.splice(i, 1)
          } else {
            embers[i] = spawn()
          }
          continue
        }
        e.y += e.vy * dt
        e.wobblePhase += dt * (e.isSpark ? 2.4 : 1.6)
        const drawX = e.x + Math.sin(e.wobblePhase) * e.wobbleAmp
        const t = e.age / e.life
        const fadeFloor = e.isSpark ? 0.9 : (theme === 'dark' ? 0.85 : 0.7)
        const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * fadeFloor
        const lightness = (e.isSpark ? 65 : 55) + (1 - t) * 22
        ctx.fillStyle = `hsla(${e.hue}, 92%, ${lightness}%, ${alpha})`
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
