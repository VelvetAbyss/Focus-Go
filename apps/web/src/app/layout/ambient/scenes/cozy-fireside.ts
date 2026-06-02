import { drawGlow, makeRadialGlowSprite } from './glowSprite'
import type { SceneSignals, SceneStrategy, SceneTheme } from './types'

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

type Smoke = {
  x: number
  y: number
  vy: number
  r: number
  life: number
  age: number
}

const COUNT = 60
const MAX_TOTAL = 100
const SMOKE_COUNT = 3
const CURSOR_DRAW_RADIUS = 90
const CURSOR_DRAW_RADIUS_SQ = CURSOR_DRAW_RADIUS * CURSOR_DRAW_RADIUS

let lastLogOn: string | null = null
const applyLogSilhouette = (enabled: boolean) => {
  if (typeof document === 'undefined') return
  const next = enabled ? '1' : '0'
  if (next === lastLogOn) return
  lastLogOn = next
  document.documentElement.style.setProperty('--cozy-fireside-log-on', next)
}

const clearLogSilhouette = () => {
  lastLogOn = null
  if (typeof document === 'undefined') return
  document.documentElement.style.removeProperty('--cozy-fireside-log-on')
}

export const createCozyFiresideScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  let smokeSprite: HTMLCanvasElement | null = null
  const embers: Ember[] = []
  const smoke: Smoke[] = []
  let nextBurstIn = 4_000 + Math.random() * 4_000
  let nextWarmTickIn = 600 + Math.random() * 700
  let nextCrackleIn = 0

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

  const spawnSpark = (boost = 1): Ember => {
    const life = (900 + Math.random() * 700) * boost
    return {
      x: width * (0.25 + Math.random() * 0.5),
      y: height - 20 - Math.random() * 60,
      r: 1.8 + Math.random() * 1.6 * boost,
      vy: -(80 + Math.random() * 100) * boost,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleAmp: 4 + Math.random() * 8,
      life,
      age: 0,
      hue: 12 + Math.random() * 18,
      isSpark: true,
    }
  }

  const spawnSmoke = (initial = false): Smoke => ({
    x: width * (0.3 + Math.random() * 0.4),
    y: initial ? height * (0.5 + Math.random() * 0.5) : height + 20,
    vy: -(8 + Math.random() * 10),
    r: 36 + Math.random() * 28,
    life: 8_000 + Math.random() * 4_000,
    age: initial ? Math.random() * 4_000 : 0,
  })

  return {
    init(canvas, runtime) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = runtime.theme
      // Pre-render the smoke puff glow once (theme-dependent colour).
      smokeSprite = makeRadialGlowSprite(theme === 'dark' ? '60, 56, 50' : '120, 105, 88')
      embers.length = 0
      smoke.length = 0
      nextBurstIn = 4_000 + Math.random() * 4_000
      nextWarmTickIn = 600 + Math.random() * 700
      nextCrackleIn = 0
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) embers.push(spawn(true))
      if (runtime.prefs.effects.cozyFireside.smokeWisps) {
        for (let i = 0; i < SMOKE_COUNT; i += 1) smoke.push(spawnSmoke(true))
      }
      applyLogSilhouette(runtime.prefs.effects.cozyFireside.logSilhouette)
    },
    tick(dtMs, runtime, signals: SceneSignals) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      const flags = runtime.prefs.effects.cozyFireside
      const intensity = signals.intensity
      const fireVol = signals.noise.fireplace.enabled ? signals.noise.fireplace.volume : 0
      applyLogSilhouette(flags.logSilhouette)

      // ── Global warm flicker — emit shell signals at irregular intervals ──
      if (flags.globalWarmFlicker) {
        nextWarmTickIn -= dtMs
        if (nextWarmTickIn <= 0) {
          const strength = 0.4 + Math.random() * 0.6
          runtime.emit({ type: 'shell-warm-tint', intensity: strength * (0.5 + fireVol * 0.5) })
          // Irregular cadence — short bursts followed by occasional longer pauses.
          nextWarmTickIn = 280 + Math.random() * (Math.random() > 0.7 ? 1400 : 480)
        }
      }

      // ── Crackle: extra spark bursts triggered by fireplace volume peaks ──
      if (flags.crackleSparkSync && fireVol > 0.4) {
        nextCrackleIn -= dtMs
        if (nextCrackleIn <= 0 && embers.length < MAX_TOTAL) {
          const count = 4 + Math.floor(Math.random() * 4)
          for (let i = 0; i < count && embers.length < MAX_TOTAL; i += 1) {
            embers.push(spawnSpark(1 + fireVol * 0.4))
          }
          nextCrackleIn = 1500 + Math.random() * 2500
        }
      }

      // ── Baseline spark bursts ──
      nextBurstIn -= dtMs
      if (nextBurstIn <= 0 && embers.length < MAX_TOTAL) {
        const count = 3 + Math.floor(Math.random() * 4)
        for (let i = 0; i < count && embers.length < MAX_TOTAL; i += 1) embers.push(spawnSpark())
        nextBurstIn = 4_000 + Math.random() * 4_500
      }

      // ── Embers + sparks ──
      ctx.globalCompositeOperation = 'lighter'
      const cursorOn = runtime.prefs.cursorReactivity && signals.cursor.inside
      const cx = signals.cursor.x
      const cy = signals.cursor.y
      for (let i = embers.length - 1; i >= 0; i -= 1) {
        const e = embers[i]
        e.age += dtMs
        if (e.age > e.life || e.y < -10) {
          if (e.isSpark) embers.splice(i, 1)
          else embers[i] = spawn()
          continue
        }
        e.y += e.vy * dt
        e.wobblePhase += dt * (e.isSpark ? 2.4 : 1.6)
        // Cursor attraction — embers drift gently toward the cursor.
        if (cursorOn) {
          const dx = cx - e.x
          const dy = cy - e.y
          const distSq = dx * dx + dy * dy
          if (distSq < CURSOR_DRAW_RADIUS_SQ && distSq > 4) {
            const force = (1 - distSq / CURSOR_DRAW_RADIUS_SQ) * 12
            const dist = Math.sqrt(distSq)
            e.x += (dx / dist) * force * dt
          }
        }
        const drawX = e.x + Math.sin(e.wobblePhase) * e.wobbleAmp
        const t = e.age / e.life
        const fadeFloor = e.isSpark ? 0.9 : (theme === 'dark' ? 0.85 : 0.7)
        const alpha = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * fadeFloor * intensity
        const lightness = (e.isSpark ? 65 : 55) + (1 - t) * 22
        ctx.fillStyle = `hsla(${e.hue}, 92%, ${lightness}%, ${alpha})`
        ctx.beginPath()
        ctx.arc(drawX, e.y, e.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // ── Smoke wisps ──
      if (flags.smokeWisps) {
        while (smoke.length < SMOKE_COUNT) smoke.push(spawnSmoke())
        const smokeCol = theme === 'dark' ? '60, 56, 50' : '120, 105, 88'
        for (let i = 0; i < smoke.length; i += 1) {
          const s = smoke[i]
          s.age += dtMs
          s.y += s.vy * dt
          s.r += 0.06 * dt * 60
          if (s.age > s.life || s.y + s.r < 0) {
            smoke[i] = spawnSmoke()
            continue
          }
          const t = s.age / s.life
          const alpha = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.08 * intensity
          if (!drawGlow(ctx, smokeSprite, s.x, s.y, s.r, alpha)) {
            const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r)
            grad.addColorStop(0, `rgba(${smokeCol}, ${alpha})`)
            grad.addColorStop(1, `rgba(${smokeCol}, 0)`)
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      } else if (smoke.length) {
        smoke.length = 0
      }
    },
    cleanup() {
      embers.length = 0
      smoke.length = 0
      ctx = null
      clearLogSilhouette()
    },
    particleCount() {
      return embers.length + smoke.length
    },
  }
}
