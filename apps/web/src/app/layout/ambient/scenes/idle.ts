import type { SceneSignals, SceneStrategy, SceneTheme } from './types'

type Mote = {
  x: number
  y: number
  r: number
  vx: number
  vy: number
  alpha: number
  phase: number
}

const COUNT = 12

// Five palette steps mapped to local hour. Returns CSS var strings.
const paletteForHour = (hour: number, theme: SceneTheme) => {
  // Light theme: morning warm → noon neutral → afternoon → dusk amber → night cool
  if (theme === 'dark') {
    if (hour < 5) return { tintA: '#1a1612', tintB: '#0e0c0a', muted: '180, 170, 158' } // deep night
    if (hour < 9) return { tintA: '#231d18', tintB: '#15110d', muted: '210, 190, 168' } // pre-dawn warm
    if (hour < 13) return { tintA: '#1f1c18', tintB: '#100e0c', muted: '220, 210, 196' } // morning
    if (hour < 17) return { tintA: '#1d1b18', tintB: '#0f0e0c', muted: '215, 205, 192' } // afternoon
    if (hour < 21) return { tintA: '#2a1f18', tintB: '#160f0a', muted: '230, 196, 156' } // dusk amber
    return { tintA: '#16140f', tintB: '#0a0907', muted: '170, 162, 150' }                 // night
  }
  if (hour < 5) return { tintA: '#F0E8D8', tintB: '#E5DDC8', muted: '120, 102, 80' }
  if (hour < 9) return { tintA: '#FAEFD9', tintB: '#F2DFB6', muted: '120, 86, 50' }    // morning warm
  if (hour < 13) return { tintA: '#F5F3F0', tintB: '#E8DFCF', muted: '90, 78, 60' }    // noon neutral
  if (hour < 17) return { tintA: '#F5F1E6', tintB: '#E8DEC4', muted: '95, 82, 60' }    // afternoon
  if (hour < 20) return { tintA: '#F5E6D2', tintB: '#E8CFA8', muted: '130, 84, 44' }   // dusk amber
  return { tintA: '#EAE2D2', tintB: '#D9CFBA', muted: '80, 74, 60' }                    // evening calm
}

const applyIdleVars = (palette: { tintA: string; tintB: string }) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--idle-tint-a', palette.tintA)
  root.style.setProperty('--idle-tint-b', palette.tintB)
}

const clearIdleVars = () => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.style.removeProperty('--idle-tint-a')
  root.style.removeProperty('--idle-tint-b')
  root.style.removeProperty('--idle-breath')
}

export const createIdleScene = (): SceneStrategy => {
  let ctx: CanvasRenderingContext2D | null = null
  let rootEl: HTMLElement | null = null
  let width = 0
  let height = 0
  let theme: SceneTheme = 'light'
  let breathPhase = 0
  let lastPaletteApply = 0
  let lastBreath = ''
  const motes: Mote[] = []

  const spawn = (initial = false): Mote => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : height + 8,
    r: 0.9 + Math.random() * 1.8,
    vx: -4 + Math.random() * 8,
    vy: -(3 + Math.random() * 8),
    alpha: 0.06 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
  })

  return {
    init(canvas, runtime) {
      ctx = canvas.getContext('2d')
      // The canvas's parent is .focus-shell__scene-backdrop, which is where the
      // brightness(var(--idle-breath)) rule lives. Writing the per-frame breath var
      // here (instead of <html>) scopes style invalidation to the backdrop subtree.
      rootEl = canvas.parentElement
      width = canvas.clientWidth
      height = canvas.clientHeight
      theme = runtime.theme
      motes.length = 0
      breathPhase = 0
      lastPaletteApply = 0
      lastBreath = ''
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < COUNT; i += 1) motes.push(spawn(true))

      // Seed palette + breath vars so first paint matches.
      if (runtime.prefs.effects.idle.timeOfDayPalette) {
        applyIdleVars(paletteForHour(new Date().getHours(), theme))
      } else {
        clearIdleVars()
      }
    },
    tick(dtMs, runtime, signals: SceneSignals) {
      if (!ctx) return
      const dt = dtMs / 1000
      ctx.clearRect(0, 0, width, height)

      // Re-apply palette every ~5s — cheap, follows actual time.
      if (runtime.prefs.effects.idle.timeOfDayPalette) {
        lastPaletteApply += dtMs
        if (lastPaletteApply > 5000) {
          applyIdleVars(paletteForHour(signals.now.getHours(), runtime.theme))
          lastPaletteApply = 0
        }
      } else if (lastPaletteApply !== -1) {
        clearIdleVars()
        lastPaletteApply = -1
      }

      // Slow breath — written to the backdrop element (scoped invalidation).
      if (runtime.prefs.effects.idle.slowBreath) {
        breathPhase += dt / 14 // ~14 second period
        const breath = (1 + Math.sin(breathPhase * Math.PI * 2) * 0.025).toFixed(4)
        if (breath !== lastBreath) {
          rootEl?.style.setProperty('--idle-breath', breath)
          lastBreath = breath
        }
      } else if (lastBreath !== '') {
        rootEl?.style.removeProperty('--idle-breath')
        lastBreath = ''
      }

      // Dust motes drift.
      const palette = paletteForHour(signals.now.getHours(), runtime.theme)
      const base = palette.muted
      const intensity = signals.intensity
      for (let i = 0; i < motes.length; i += 1) {
        const m = motes[i]
        m.x += m.vx * dt
        m.y += m.vy * dt
        m.phase += dt * 0.6
        if (m.y < -10 || m.x < -10 || m.x > width + 10) {
          motes[i] = spawn()
          continue
        }
        const wobble = Math.sin(m.phase) * 4
        const a = m.alpha * (runtime.theme === 'dark' ? 0.7 : 1) * intensity
        ctx.fillStyle = `rgba(${base}, ${a})`
        ctx.beginPath()
        ctx.arc(m.x + wobble, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    cleanup() {
      motes.length = 0
      ctx = null
      clearIdleVars()
      rootEl?.style.removeProperty('--idle-breath')
      rootEl = null
      lastBreath = ''
    },
    particleCount() {
      return motes.length
    },
  }
}
