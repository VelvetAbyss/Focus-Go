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

type Wave = {
  yBase: number
  amp: number
  freq: number
  phase: number
  speed: number
  alpha: number
  thickness: number
}

const COUNT = 40
const WAVE_COUNT = 5

export const createOceanBreezeScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  const motes: Mote[] = []
  const waves: Wave[] = []

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

  const buildWaves = () => {
    waves.length = 0
    // Stack waves near the bottom for a horizon-line shimmer.
    for (let i = 0; i < WAVE_COUNT; i += 1) {
      waves.push({
        yBase: height * (0.7 + i * 0.05),
        amp: 6 + Math.random() * 10,
        freq: 0.004 + Math.random() * 0.003,
        phase: Math.random() * Math.PI * 2,
        speed: 0.45 + Math.random() * 0.35,
        alpha: 0.07 + i * 0.022,
        thickness: 1 + Math.random() * 0.5,
      })
    }
  }

  return {
    init(canvas, nextTheme) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = nextTheme
      motes.length = 0
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      buildWaves()
      for (let i = 0; i < COUNT; i += 1) motes.push(spawn(true))
    },
    tick(dtMs) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      const baseFoam = theme === 'dark' ? '210, 230, 230' : '245, 248, 245'

      // Horizon shimmer — animated sine waves drawn as thin polylines.
      const waveColor = theme === 'dark' ? '180, 210, 220' : '255, 255, 255'
      const step = Math.max(8, Math.floor(width / 80))
      for (let wi = 0; wi < waves.length; wi += 1) {
        const w = waves[wi]
        w.phase += dt * w.speed
        ctx.strokeStyle = `rgba(${waveColor}, ${w.alpha})`
        ctx.lineWidth = w.thickness
        ctx.beginPath()
        for (let x = 0; x <= width; x += step) {
          const y = w.yBase + Math.sin(x * w.freq + w.phase) * w.amp
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Foam motes — drift up and fade.
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
        const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.55
        ctx.fillStyle = `rgba(${baseFoam}, ${alpha})`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    cleanup() {
      motes.length = 0
      waves.length = 0
      ctx = null
    },
    particleCount() {
      return motes.length + waves.length
    },
  }
}
