import { useCallback, useMemo, useRef } from 'react'
import { useThreeSurface } from '../../../shared/three/useThreeSurface'
import { hex, mixRgb, type Rgb, type SurfaceModule } from '../../../shared/three/surface'
import type { ThemeMode } from '../../../shared/theme/theme'
import type { GlobeCity, GlobeParams } from './globeScene'

/** Reads a design token from :root as sRGB floats (hex or rgb()). */
const readToken = (name: string, fallback: string): Rgb => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  if (raw.startsWith('#')) {
    const v = raw.length === 4 ? raw.slice(1).split('').map((c) => c + c).join('') : raw.slice(1, 7)
    return hex(`#${v}`)
  }
  const nums = raw.match(/[\d.]+/g)?.map(Number)
  return nums && nums.length >= 3 ? [nums[0] / 255, nums[1] / 255, nums[2] / 255] : hex(fallback)
}

const readColors = (theme: ThemeMode): GlobeParams['colors'] => {
  const paper = readToken('--paper-raised', theme === 'dark' ? '#2d2b27' : '#ffffff')
  const ink1 = readToken('--ink-1', theme === 'dark' ? '#f2f0ec' : '#3a3733')
  const ink2 = readToken('--ink-2', theme === 'dark' ? '#c8c1b7' : '#5e5a54')
  const ink3 = readToken('--ink-3', theme === 'dark' ? '#a39c91' : '#77726b')
  const night = theme === 'dark' ? mixRgb(paper, hex('#0e0d0c'), 0.55) : mixRgb(paper, ink1, 0.26)
  return {
    paper,
    night,
    land: ink3,
    landNight: theme === 'dark' ? mixRgb(ink3, night, 0.55) : mixRgb(ink3, paper, 0.25),
    rule: readToken('--rule-strong', theme === 'dark' ? '#4a4640' : '#d6d0c5'),
    pencil: readToken('--pencil-line', theme === 'dark' ? '#8a847a' : '#948e84'),
    pen: readToken('--accent', theme === 'dark' ? '#7edbc7' : '#1b4f4a'),
    ink: ink2,
  }
}

type Props = {
  cities: GlobeCity[]
  highlightId: string | null
  theme: ThemeMode
}

/**
 * A dotted globe with the live day/night terminator (a pencil line), your home
 * city in the pen and tracked cities in ink. Purely decorative for assistive
 * tech — the rows carry the same facts as text.
 */
const WorldClockGlobe = ({ cities, highlightId, theme }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const load = useCallback(() => import('./globeScene') as Promise<SurfaceModule<GlobeParams>>, [])
  // Tokens are read from :root, so they change exactly when the theme does.
  const colors = useMemo(() => readColors(theme), [theme])
  const params = useMemo<GlobeParams>(() => ({ cities, highlightId, colors }), [cities, highlightId, colors])
  const status = useThreeSurface(canvasRef, load, params, { fps: 30, maxDpr: 2 })

  return (
    <div className="wc-globe" data-status={status} aria-hidden="true">
      <canvas ref={canvasRef} className="wc-globe__canvas" />
    </div>
  )
}

export default WorldClockGlobe
