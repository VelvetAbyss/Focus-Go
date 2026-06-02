import type { SceneSignals, SceneStrategy, SceneTheme } from './types'

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
  /** parallax layer 0..2 — 0=far,1=mid,2=near */
  layer: number
}

const COUNT = 40
const FAR_WAVES = 3
const MID_WAVES = 2
const NEAR_WAVES = 2

let lastCausticsOn: string | null = null
const applyCausticsVar = (enabled: boolean) => {
  if (typeof document === 'undefined') return
  const next = enabled ? '1' : '0'
  if (next === lastCausticsOn) return
  lastCausticsOn = next
  document.documentElement.style.setProperty('--ocean-breeze-caustics-on', next)
}

const clearCausticsVar = () => {
  lastCausticsOn = null
  if (typeof document === 'undefined') return
  document.documentElement.style.removeProperty('--ocean-breeze-caustics-on')
}

// Sun/moon position based on local hour. Moves from left at 6am to right at 6pm,
// sets after 18 and rises (as moon) opposite during night.
const sunPosForHour = (hour: number, minutes: number) => {
  const t = (hour + minutes / 60) / 24 // 0..1
  // Daytime arc 6→18, night arc 18→6 (moon).
  const isDay = hour >= 6 && hour < 18
  const arcT = isDay ? (t - 6 / 24) / (12 / 24) : ((t - 18 / 24 + 1) % 1) / (12 / 24)
  // Parabolic arc: x linear, y dips down (sin)
  const x = 0.1 + arcT * 0.8
  const y = 0.08 + (1 - Math.sin(arcT * Math.PI)) * 0.18 // 8% top peak, 26% lower at edges
  return { x, y, isDay }
}

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

  const buildWaves = (parallax: boolean) => {
    waves.length = 0
    if (parallax) {
      // 3-layer parallax: far (slow, low alpha), mid, near (fast, higher alpha).
      for (let i = 0; i < FAR_WAVES; i += 1) {
        waves.push({
          yBase: height * (0.6 + i * 0.02),
          amp: 3 + Math.random() * 4,
          freq: 0.003 + Math.random() * 0.002,
          phase: Math.random() * Math.PI * 2,
          speed: 0.18 + Math.random() * 0.12,
          alpha: 0.04 + i * 0.012,
          thickness: 0.9,
          layer: 0,
        })
      }
      for (let i = 0; i < MID_WAVES; i += 1) {
        waves.push({
          yBase: height * (0.75 + i * 0.04),
          amp: 8 + Math.random() * 6,
          freq: 0.005 + Math.random() * 0.002,
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 0.3,
          alpha: 0.08 + i * 0.022,
          thickness: 1.1,
          layer: 1,
        })
      }
      for (let i = 0; i < NEAR_WAVES; i += 1) {
        waves.push({
          yBase: height * (0.88 + i * 0.04),
          amp: 12 + Math.random() * 8,
          freq: 0.006 + Math.random() * 0.003,
          phase: Math.random() * Math.PI * 2,
          speed: 0.85 + Math.random() * 0.4,
          alpha: 0.13 + i * 0.026,
          thickness: 1.3,
          layer: 2,
        })
      }
    } else {
      // Flat: 5 mid-tier waves.
      for (let i = 0; i < 5; i += 1) {
        waves.push({
          yBase: height * (0.7 + i * 0.05),
          amp: 6 + Math.random() * 10,
          freq: 0.004 + Math.random() * 0.003,
          phase: Math.random() * Math.PI * 2,
          speed: 0.45 + Math.random() * 0.35,
          alpha: 0.07 + i * 0.022,
          thickness: 1 + Math.random() * 0.5,
          layer: 1,
        })
      }
    }
  }

  return {
    init(canvas, runtime) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = runtime.theme
      motes.length = 0
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      buildWaves(runtime.prefs.effects.oceanBreeze.parallaxLayers)
      for (let i = 0; i < COUNT; i += 1) motes.push(spawn(true))
      applyCausticsVar(runtime.prefs.effects.oceanBreeze.surfaceCaustics)
    },
    tick(dtMs, runtime, signals: SceneSignals) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      const flags = runtime.prefs.effects.oceanBreeze
      const intensity = signals.intensity
      const oceanVol = signals.noise.ocean.enabled ? signals.noise.ocean.volume : 0
      const windVol = signals.noise.wind.enabled ? signals.noise.wind.volume : 0
      applyCausticsVar(flags.surfaceCaustics)

      // ── Sun / moon highlight ──
      if (flags.sunMoonHighlight) {
        const pos = sunPosForHour(signals.now.getHours(), signals.now.getMinutes())
        const sunX = pos.x * width
        const sunY = pos.y * height
        const r = Math.max(width, height) * 0.32
        const lightColor = pos.isDay
          ? (theme === 'dark' ? '255, 232, 178' : '255, 246, 220')
          : (theme === 'dark' ? '210, 220, 240' : '232, 238, 250')
        const grad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, r)
        grad.addColorStop(0, `rgba(${lightColor}, ${(pos.isDay ? 0.18 : 0.12) * intensity})`)
        grad.addColorStop(0.4, `rgba(${lightColor}, ${(pos.isDay ? 0.08 : 0.05) * intensity})`)
        grad.addColorStop(1, `rgba(${lightColor}, 0)`)
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(sunX, sunY, r, 0, Math.PI * 2)
        ctx.fill()

        // Reflection on water — vertical streak from sun down to nearest wave.
        const reflectionTop = sunY
        const reflectionBottom = height
        const reflectionGrad = ctx.createLinearGradient(sunX, reflectionTop, sunX, reflectionBottom)
        reflectionGrad.addColorStop(0, `rgba(${lightColor}, ${(pos.isDay ? 0.16 : 0.10) * intensity})`)
        reflectionGrad.addColorStop(1, `rgba(${lightColor}, 0)`)
        ctx.fillStyle = reflectionGrad
        ctx.beginPath()
        ctx.ellipse(sunX, (reflectionTop + reflectionBottom) / 2, 18, (reflectionBottom - reflectionTop) / 2, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Horizon shimmer waves ──
      const waveColor = theme === 'dark' ? '180, 210, 220' : '255, 255, 255'
      const step = Math.max(8, Math.floor(width / 80))
      const speedMul = 1 + windVol * 0.6 + oceanVol * 0.3
      const ampMul = 1 + oceanVol * 0.5
      for (let wi = 0; wi < waves.length; wi += 1) {
        const w = waves[wi]
        w.phase += dt * w.speed * speedMul
        ctx.strokeStyle = `rgba(${waveColor}, ${w.alpha * intensity})`
        ctx.lineWidth = w.thickness
        ctx.beginPath()
        for (let x = 0; x <= width; x += step) {
          const y = w.yBase + Math.sin(x * w.freq + w.phase) * w.amp * ampMul
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // ── Foam motes (cursor-aware drift) ──
      const baseFoam = theme === 'dark' ? '210, 230, 230' : '245, 248, 245'
      const cursorOn = runtime.prefs.cursorReactivity && signals.cursor.inside
      const cx = signals.cursor.x
      const cy = signals.cursor.y
      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i]
        m.age += dtMs
        if (m.age > m.life || m.y < -20) {
          motes[i] = spawn()
          continue
        }
        m.x += m.vx * dt
        m.y += m.vy * dt
        if (cursorOn) {
          const dx = m.x - cx
          const dy = m.y - cy
          const distSq = dx * dx + dy * dy
          if (distSq < 6400 && distSq > 4) {
            const force = (1 - distSq / 6400) * 24
            const dist = Math.sqrt(distSq)
            m.x += (dx / dist) * force * dt
            m.y += (dy / dist) * force * dt
          }
        }
        const t = m.age / m.life
        const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.55 * intensity
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
      clearCausticsVar()
    },
    particleCount() {
      return motes.length + waves.length
    },
  }
}
