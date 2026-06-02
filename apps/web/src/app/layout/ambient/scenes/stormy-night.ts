import { makeSceneRng } from './rng'
import type { SceneSignals, SceneStrategy, SceneTheme } from './types'

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

const BASE_DROPS = 220
const ANGLE = 0.32
const WIND_COUNT = 6
const CURSOR_AVOID_RADIUS = 80
const CURSOR_AVOID_RADIUS_SQ = CURSOR_AVOID_RADIUS * CURSOR_AVOID_RADIUS

export const createStormyNightScene = (): SceneStrategy => {
  let rng: () => number = Math.random
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'dark'
  const drops: Drop[] = []
  const winds: WindStreak[] = []

  let flashAlpha = 0
  let preFlashAlpha = 0
  let nextFlashIn = 4_000 + rng() * 7_000
  let flashOriginX = 0.5
  let flashOriginY = 0.25
  // Track flash transitions for emitting shell events.
  let lastFlashAlpha = 0

  const spawnDrop = (initial = false): Drop => {
    const len = 14 + rng() * 20
    return {
      x: rng() * (width + 200) - 100,
      y: initial ? rng() * height : -len,
      len,
      speed: 320 + rng() * 320,
      alpha: 0.16 + rng() * 0.26,
      drift: 0.9 + rng() * 0.25,
    }
  }

  const spawnWind = (initial = false): WindStreak => ({
    x: initial ? rng() * width : -200,
    y: height * (0.1 + rng() * 0.8),
    len: 120 + rng() * 240,
    vx: 90 + rng() * 120,
    alpha: 0.05 + rng() * 0.08,
  })

  return {
    init(canvas, runtime) {
      rng = makeSceneRng(runtime)
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = runtime.theme
      drops.length = 0
      winds.length = 0
      flashAlpha = 0
      preFlashAlpha = 0
      lastFlashAlpha = 0
      nextFlashIn = 4_000 + rng() * 7_000
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < BASE_DROPS; i += 1) drops.push(spawnDrop(true))
      for (let i = 0; i < WIND_COUNT; i += 1) winds.push(spawnWind(true))
    },
    tick(dtMs, runtime, signals: SceneSignals) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      const flags = runtime.prefs.effects.stormyNight
      const intensity = signals.intensity
      const thunderVol = signals.noise.thunder.enabled ? signals.noise.thunder.volume : 0
      const windVol = signals.noise.wind.enabled ? signals.noise.wind.volume : 0
      const rainVol = signals.noise.rain.enabled ? signals.noise.rain.volume : 0

      // Audio-reactive density.
      const densityMul = 0.65 + rainVol * 0.55
      const targetCount = Math.round(BASE_DROPS * densityMul * intensity)
      while (drops.length < targetCount) drops.push(spawnDrop())
      if (drops.length > targetCount) drops.length = targetCount

      const windTargetCount = Math.round(WIND_COUNT + windVol * 6)
      while (winds.length < windTargetCount) winds.push(spawnWind())
      if (winds.length > windTargetCount) winds.length = windTargetCount

      // ── Wind streaks ──
      const windColor = theme === 'dark' ? '220, 230, 245' : '160, 175, 200'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.0
      for (let i = 0; i < winds.length; i += 1) {
        const w = winds[i]
        w.x += w.vx * dt * (1 + windVol * 0.5)
        if (w.x - w.len > width) {
          winds[i] = spawnWind()
          continue
        }
        ctx.strokeStyle = `rgba(${windColor}, ${w.alpha * intensity})`
        ctx.beginPath()
        ctx.moveTo(w.x, w.y)
        ctx.lineTo(w.x - w.len, w.y + 6)
        ctx.stroke()
      }

      // ── Rain ──
      const rainBaseColor = theme === 'dark' ? '210, 220, 235' : '90, 110, 140'
      const rainFlashColor = '255, 255, 250'
      // During flash peak, draw rain brighter + whiter — feature #1 of this task.
      const flashRainBoost = flags.lightningFlashOnRain && flashAlpha > 0.02
      ctx.lineWidth = 1.15
      const cursorOn = runtime.prefs.cursorReactivity && signals.cursor.inside
      const cx = signals.cursor.x
      const cy = signals.cursor.y
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
        if (cursorOn) {
          const dx = d.x - cx
          const dy = d.y - cy
          const distSq = dx * dx + dy * dy
          if (distSq < CURSOR_AVOID_RADIUS_SQ && distSq > 1) {
            const force = (1 - distSq / CURSOR_AVOID_RADIUS_SQ) * 3
            const dist = Math.sqrt(distSq)
            d.x += (dx / dist) * force
          }
        }
        const color = flashRainBoost ? rainFlashColor : rainBaseColor
        const alpha = flashRainBoost ? Math.min(0.95, d.alpha * 3.5 * flashAlpha) : d.alpha * intensity
        ctx.strokeStyle = `rgba(${color}, ${alpha})`
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.len * ANGLE, d.y - d.len)
        ctx.stroke()
      }

      // ── Wet-ground reflection: mirrored rain at bottom 10% ──
      if (flags.wetGroundReflection) {
        const refHeight = height * 0.1
        const refTop = height - refHeight
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, refTop, width, refHeight)
        ctx.clip()
        ctx.translate(0, height * 2 - refHeight * 0.4)
        ctx.scale(1, -0.45)
        ctx.filter = 'blur(2px)'
        for (let i = 0; i < drops.length; i += 1) {
          const d = drops[i]
          if (d.y < height - refHeight * 4) continue
          ctx.strokeStyle = `rgba(${rainBaseColor}, ${d.alpha * 0.25 * intensity})`
          ctx.beginPath()
          ctx.moveTo(d.x, d.y)
          ctx.lineTo(d.x - d.len * ANGLE, d.y - d.len)
          ctx.stroke()
        }
        ctx.restore()
      }

      // ── Lightning: pre-flash glow → full flash → shell emits ──
      // Frequency modulated by thunder volume.
      const flashFreqMul = 1 - thunderVol * 0.55
      nextFlashIn -= dtMs / flashFreqMul
      if (nextFlashIn <= -120 && preFlashAlpha === 0 && flashAlpha === 0) {
        flashOriginX = 0.2 + rng() * 0.6
        flashOriginY = 0.15 + rng() * 0.35
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
          flashAlpha = 0.55 + rng() * 0.25
          nextFlashIn = 6_000 + rng() * 9_000
          // Emit thunder shake at flash trigger.
          runtime.emit({
            type: 'shell-shake',
            magnitude: 3 + rng() * 2.5,
            durationMs: 260 + rng() * 180,
          })
        }
      }
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(245, 244, 232, ${flashAlpha})`
        ctx.fillRect(0, 0, width, height)
        flashAlpha = Math.max(0, flashAlpha - dt * 2.4)
        // When flash decays past threshold, emit purple after-flash once.
        if (lastFlashAlpha > 0.04 && flashAlpha <= 0.04) {
          runtime.emit({ type: 'shell-purple-flash', intensity: 0.4 })
        }
      }
      lastFlashAlpha = flashAlpha
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
