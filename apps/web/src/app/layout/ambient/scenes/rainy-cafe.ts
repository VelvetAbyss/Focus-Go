import { drawGlow, makeRadialGlowSprite } from './glowSprite'
import type { SceneSignals, SceneStrategy, SceneTheme } from './types'

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
}

type Condensation = {
  x: number
  y: number
  r: number
  vy: number
  wobblePhase: number
  alpha: number
  resetY: number
}

type Silhouette = {
  x: number
  width: number
  height: number
  speed: number
  alpha: number
  delay: number
}

const BASE_DROPS = 180
const ANGLE = 0.18
const MAX_RIPPLES = 14
const GLINT_COUNT = 4
const CONDENSATION_COUNT = 7

const CURSOR_AVOID_RADIUS = 70
const CURSOR_AVOID_RADIUS_SQ = CURSOR_AVOID_RADIUS * CURSOR_AVOID_RADIUS

let lastSteamOn: string | null = null
const applySteamFog = (enabled: boolean) => {
  if (typeof document === 'undefined') return
  const next = enabled ? '1' : '0'
  if (next === lastSteamOn) return
  lastSteamOn = next
  document.documentElement.style.setProperty('--rainy-cafe-steam-on', next)
}

const clearSteamFog = () => {
  lastSteamOn = null
  if (typeof document === 'undefined') return
  document.documentElement.style.removeProperty('--rainy-cafe-steam-on')
}

export const createRainyCafeScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  let glintSprite: HTMLCanvasElement | null = null
  const drops: Drop[] = []
  const ripples: Ripple[] = []
  const glints: Glint[] = []
  const condensation: Condensation[] = []
  const silhouettes: Silhouette[] = []
  let nextSilhouetteIn = 30_000 + Math.random() * 40_000

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
  })

  const spawnCondensation = (initial = false): Condensation => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : -30,
    r: 8 + Math.random() * 14,
    vy: 14 + Math.random() * 22,
    wobblePhase: Math.random() * Math.PI * 2,
    alpha: 0.06 + Math.random() * 0.08,
    resetY: height + 40,
  })

  const spawnSilhouette = (): Silhouette => ({
    x: -120,
    width: 24 + Math.random() * 28,
    height: 60 + Math.random() * 80,
    speed: 40 + Math.random() * 30,
    alpha: 0.08 + Math.random() * 0.06,
    delay: 0,
  })

  const trySpawnRipple = (drop: Drop) => {
    if (ripples.length >= MAX_RIPPLES) return
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
    init(canvas, runtime) {
      ctx = canvas.getContext('2d')
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = runtime.theme
      // Pre-render the warm glint glow once (theme-dependent colour).
      glintSprite = makeRadialGlowSprite(theme === 'dark' ? '255, 218, 168' : '255, 224, 178')
      drops.length = 0
      ripples.length = 0
      glints.length = 0
      condensation.length = 0
      silhouettes.length = 0
      nextSilhouetteIn = 30_000 + Math.random() * 40_000
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < BASE_DROPS; i += 1) drops.push(spawnDrop(true))
      for (let i = 0; i < GLINT_COUNT; i += 1) glints.push(spawnGlint())
      if (runtime.prefs.effects.rainyCafe.condensationDrops) {
        for (let i = 0; i < CONDENSATION_COUNT; i += 1) condensation.push(spawnCondensation(true))
      }
      applySteamFog(runtime.prefs.effects.rainyCafe.steamFog)
    },
    tick(dtMs, runtime, signals: SceneSignals) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Sync steam-fog var.
      applySteamFog(runtime.prefs.effects.rainyCafe.steamFog)

      const intensity = signals.intensity
      const rainVol = signals.noise.rain.enabled ? signals.noise.rain.volume : 0
      const cafeVol = signals.noise.cafe.enabled ? signals.noise.cafe.volume : 0
      // Audio drives density — clamp to 0.6..1.2 of base, so quiet rain still rains.
      const densityMul = 0.6 + rainVol * 0.6
      const targetCount = Math.round(BASE_DROPS * densityMul * intensity)

      // Resize drops array toward target.
      while (drops.length < targetCount) drops.push(spawnDrop())
      if (drops.length > targetCount) drops.length = targetCount

      // ── Window-light glints (warm bokeh) ── cached glow sprite (see glowSprite.ts)
      const glintColor = theme === 'dark' ? '255, 218, 168' : '255, 224, 178'
      const glintBoost = 1 + cafeVol * 0.6
      for (let i = 0; i < glints.length; i += 1) {
        const g = glints[i]
        g.x += g.vx * dt
        if (g.x - g.r > width) {
          g.x = -g.r
          g.y = height * (0.05 + Math.random() * 0.25)
          g.r = 70 + Math.random() * 70
        }
        const a = g.alpha * glintBoost * intensity
        if (!drawGlow(ctx, glintSprite, g.x, g.y, g.r, a)) {
          // Fallback to live gradient if sprite unavailable.
          const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r)
          grad.addColorStop(0, `rgba(${glintColor}, ${a})`)
          grad.addColorStop(1, `rgba(${glintColor}, 0)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Rain ──
      const baseColor = theme === 'dark' ? '245, 243, 240' : '58, 55, 51'
      ctx.lineCap = 'round'
      ctx.lineWidth = 1.05
      const cursorOn = runtime.prefs.cursorReactivity && signals.cursor.inside
      const cx = signals.cursor.x
      const cy = signals.cursor.y
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
        // Cursor avoidance — bend nearby drops outward.
        if (cursorOn) {
          const dx = d.x - cx
          const dy = d.y - cy
          const distSq = dx * dx + dy * dy
          if (distSq < CURSOR_AVOID_RADIUS_SQ && distSq > 1) {
            const force = (1 - distSq / CURSOR_AVOID_RADIUS_SQ) * 2.5
            const dist = Math.sqrt(distSq)
            d.x += (dx / dist) * force
          }
        }
        ctx.strokeStyle = `rgba(${baseColor}, ${d.alpha * intensity})`
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.len * ANGLE, d.y - d.len)
        ctx.stroke()
      }

      // ── Splash ripples ──
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
        const alpha = (1 - t) * r.alpha * intensity
        ctx.strokeStyle = `rgba(${baseColor}, ${alpha})`
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.45, 0, 0, Math.PI * 2)
        ctx.stroke()
      }

      // ── Condensation droplets ──
      if (runtime.prefs.effects.rainyCafe.condensationDrops) {
        while (condensation.length < CONDENSATION_COUNT) condensation.push(spawnCondensation())
        const condColor = theme === 'dark' ? '255, 240, 220' : '245, 248, 250'
        for (let i = 0; i < condensation.length; i += 1) {
          const c = condensation[i]
          c.y += c.vy * dt
          c.wobblePhase += dt * 1.2
          if (c.y - c.r > c.resetY) {
            condensation[i] = spawnCondensation()
            continue
          }
          const drawX = c.x + Math.sin(c.wobblePhase) * 4
          const grad = ctx.createRadialGradient(drawX, c.y, 0, drawX, c.y, c.r)
          grad.addColorStop(0, `rgba(${condColor}, ${c.alpha * 2 * intensity})`)
          grad.addColorStop(0.7, `rgba(${condColor}, ${c.alpha * intensity})`)
          grad.addColorStop(1, `rgba(${condColor}, 0)`)
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.ellipse(drawX, c.y, c.r * 0.8, c.r, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (condensation.length) {
        condensation.length = 0
      }

      // ── Passerby silhouettes ──
      if (runtime.prefs.effects.rainyCafe.passerbySilhouettes) {
        nextSilhouetteIn -= dtMs
        if (nextSilhouetteIn <= 0 && silhouettes.length < 2) {
          silhouettes.push(spawnSilhouette())
          nextSilhouetteIn = 30_000 + Math.random() * 40_000
        }
        const sCol = theme === 'dark' ? '0, 0, 0' : '58, 55, 51'
        for (let i = silhouettes.length - 1; i >= 0; i -= 1) {
          const s = silhouettes[i]
          s.x += s.speed * dt
          if (s.x > width + 120) {
            silhouettes.splice(i, 1)
            continue
          }
          ctx.fillStyle = `rgba(${sCol}, ${s.alpha * intensity})`
          ctx.beginPath()
          // Stylized walking silhouette: ellipse head + tapered body.
          ctx.ellipse(s.x, height * 0.55 - s.height * 0.6, s.width * 0.32, s.width * 0.36, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillRect(s.x - s.width * 0.5, height * 0.55 - s.height * 0.25, s.width, s.height)
        }
      } else if (silhouettes.length) {
        silhouettes.length = 0
      }
    },
    cleanup() {
      drops.length = 0
      ripples.length = 0
      glints.length = 0
      condensation.length = 0
      silhouettes.length = 0
      ctx = null
      clearSteamFog()
    },
    particleCount() {
      return drops.length + ripples.length + glints.length + condensation.length + silhouettes.length
    },
  }
}
