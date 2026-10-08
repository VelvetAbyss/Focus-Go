import { useRef } from 'react'
import { useThreeSurface } from '../../shared/three/useThreeSurface'
import type { SurfaceModule } from '../../shared/three/surface'
import type { TimeGridParams } from './three/gridTypes'

const loadTimeGrid = () => import('./three/timeGridScene') as Promise<SurfaceModule<TimeGridParams>>

/**
 * The time grid's canvas. Decorative (the card states the same facts in text);
 * it fades in once the scene is up and simply stays empty without WebGL.
 * Memoise `params`: a new object asks the scene for a frame.
 */
const GridCanvas = ({ params, className }: { params: TimeGridParams; className: string }) => {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const status = useThreeSurface(ref, loadTimeGrid, params)
  return <canvas ref={ref} className={`salary-grid ${className}`} data-status={status} aria-hidden="true" />
}

export default GridCanvas
