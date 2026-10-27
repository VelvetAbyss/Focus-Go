import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import type { SpringPalette, SpringSettings } from './sceneSettings'
import type { SpringRenderer } from './springfield/renderer'

export default function SpringField({ settings, palette, paused }: {
  settings: SpringSettings; palette: SpringPalette; paused: boolean
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<SpringRenderer | null>(null)
  const options = useRef({ ...settings, palette, paused })
  const [ready, setReady] = useState(false)
  const fieldPattern = useId()
  useEffect(() => {
    options.current = { ...settings, palette, paused }
    renderer.current?.update(options.current)
  }, [settings, palette, paused])
  useEffect(() => {
    let cancelled = false
    void import('./springfield/renderer').then(({ createSpringRenderer }) => {
      if (cancelled || !canvas.current) return
      renderer.current = createSpringRenderer(canvas.current, options.current, setReady)
    }).catch(() => { if (!cancelled) setReady(false) })
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null }
  }, [])
  return <div className="dash-cloudtrain-frame" aria-hidden="true">
    <div className="dash-springfield" data-ready={ready} data-palette={palette} data-paused={paused} data-anchor={settings.sceneAnchor} style={{
      '--train-opacity': settings.opacity / 100, '--train-width': settings.width / 100,
      '--scene-x': `${settings.sceneX}%`, '--scene-y': `${settings.sceneY}%`, '--scene-height': `${settings.sceneHeight}px`,
    } as CSSProperties}>
      <svg className="dash-springfield__still" viewBox="0 0 900 180" preserveAspectRatio="xMidYMid slice">
        <defs><pattern id={fieldPattern} width="110" height="90" patternUnits="userSpaceOnUse">
          <rect width="110" height="90" fill="#afc89b" /><path fill="#93bfc0" d="M2 2h73v38H2zm0 43h36v43H0zm42 0h64v43H44z" /><path fill="#a2c4aa" d="M80 2h28v38H80z" />
        </pattern></defs>
        <rect width="900" height="180" fill={`url(#${fieldPattern})`} />
        <path d="M-20 68C180 36 320 111 490 75S740 55 920 81" stroke="#d3d1a5" strokeWidth="42" fill="none" />
        <path d="M-20 68C180 36 320 111 490 75S740 55 920 81" stroke="#80aabb" strokeWidth="31" fill="none" />
        <path d="M280 0v180M690 0v180" stroke="#d5c3a1" strokeWidth="8" />
        <g fill="#e6b8bd"><circle cx="250" cy="121" r="13" /><circle cx="273" cy="130" r="15" /><circle cx="319" cy="129" r="12" /><circle cx="645" cy="112" r="14" /><circle cx="671" cy="121" r="12" /></g>
        {settings.plane && <path fill="#faf5df" d="m445 85 33-2 9-17 5 1-5 17 16 1 6-7 3 1-2 8 2 8-3 1-6-7-16 1 5 17-5 1-9-17z" />}
      </svg>
      <canvas ref={canvas} className="dash-springfield__canvas" />
    </div>
  </div>
}
