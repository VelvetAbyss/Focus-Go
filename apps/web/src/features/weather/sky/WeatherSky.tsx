import { useCallback, useRef } from 'react'
import { useThreeSurface } from '../../../shared/three/useThreeSurface'
import type { SurfaceModule } from '../../../shared/three/surface'
import type { SkyParams } from './skyModel'

const css = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`

/**
 * The painted sky behind the weather card. A CSS gradient in the same palette
 * sits underneath, so the card reads correctly before three.js has loaded (or
 * if WebGL is unavailable); the canvas fades in over it once it draws.
 */
const WeatherSky = ({ params }: { params: SkyParams }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const load = useCallback(
    () => import('./weatherSkyScene') as Promise<SurfaceModule<SkyParams>>,
    [],
  )
  const fps = params.rain > 0 || params.snow > 0 || params.hail > 0 || params.storm > 0 ? 30 : 20
  const status = useThreeSurface(canvasRef, load, params, { fps, maxDpr: 2 })

  return (
    <div
      className="weather-sky"
      data-status={status}
      aria-hidden="true"
      style={{ background: `linear-gradient(180deg, ${css(params.top)} 0%, ${css(params.bottom)} 100%)` }}
    >
      <canvas ref={canvasRef} className="weather-sky__canvas" />
    </div>
  )
}

export default WeatherSky
