import { useEffect, useRef, useState, type RefObject } from 'react'
import type { SurfaceHandle, SurfaceModule, SurfaceOptions } from './surface'

/**
 * Mounts a lazily imported three.js scene on a canvas and keeps its params in
 * sync with React. `load` must be a stable function that calls `import()` on
 * the scene module, so three.js ships in that module's chunk only.
 * Returns 'loading' | 'ready' | 'failed' so the host can show a CSS fallback.
 */
export function useThreeSurface<P>(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  load: () => Promise<SurfaceModule<P>>,
  params: P,
  options?: SurfaceOptions,
) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const handleRef = useRef<SurfaceHandle<P> | null>(null)
  const paramsRef = useRef(params)
  paramsRef.current = params
  const fps = options?.fps

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    load()
      .then((mod) => {
        if (cancelled) return
        const handle = mod.mount(canvas, paramsRef.current, options)
        handleRef.current = handle
        setStatus(handle.ok ? 'ready' : 'failed')
      })
      .catch((error) => {
        console.error('[three] failed to load scene', error)
        if (!cancelled) setStatus('failed')
      })
    return () => {
      cancelled = true
      handleRef.current?.dispose()
      handleRef.current = null
    }
    // The surface is created once per canvas; params and fps flow through the
    // effects below instead of rebuilding the GL context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, load])

  useEffect(() => {
    handleRef.current?.setParams(params)
  }, [params])

  useEffect(() => {
    if (fps) handleRef.current?.setFps(fps)
  }, [fps])

  return status
}
