import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { TrainPalette, TrainRenderer } from './cloudtrain/renderer'
import { TRAIN_DEFAULTS, type TrainSettings } from './sceneSettings'

export default function CloudTrain({ palette, paused, settings = TRAIN_DEFAULTS, anchor = 'bottom' }: { palette: TrainPalette; paused: boolean; settings?: TrainSettings; anchor?: 'top' | 'bottom' }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<TrainRenderer | null>(null)
  const options = useRef({ ...settings, palette, paused })
  const [ready, setReady] = useState(false)
  useEffect(() => {
    options.current = { ...settings, palette, paused }
    renderer.current?.update(options.current)
  }, [palette, paused, settings])
  useEffect(() => {
    let cancelled = false
    void import('./cloudtrain/renderer').then(({ createTrainRenderer }) => {
      if (cancelled || !canvas.current) return
      renderer.current = createTrainRenderer(canvas.current, options.current, setReady)
    }).catch(() => { if (!cancelled) setReady(false) })
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null }
  }, [])
  return (
    <div className="dash-cloudtrain-frame" aria-hidden="true">
      <div className="dash-cloudtrain" data-palette={palette} data-ready={ready} data-paused={paused} data-anchor={anchor} aria-hidden="true" style={{
        '--train-opacity': settings.opacity / 100, '--train-width': settings.width / 100,
        '--train-scale': settings.trainScale / 100, '--train-offset': `${settings.railOffset}%`,
        '--scene-x': `${settings.sceneX}%`, '--scene-y': `${settings.sceneY}%`,
        '--scene-height': `${settings.sceneHeight}px`,
      } as CSSProperties}>
        <svg className="dash-cloudtrain__still" viewBox="400 135 340 110" preserveAspectRatio="xMidYMid meet">
          <path className="dash-cloudtrain__cloud-back" d="M0 140 Q70 60 140 130 Q210 80 290 150 Q380 40 470 120 Q550 65 630 140 Q730 40 820 115 Q920 75 1000 140 Q1100 50 1200 110V300H0Z" />
          <path className="dash-cloudtrain__cloud-front" d="M0 205 Q90 125 170 200 Q270 150 350 220 Q440 140 520 195 Q630 135 720 205 Q820 160 900 210 Q1030 120 1200 200V300H0Z" />
          <g fill="none" stroke="currentColor" strokeWidth="2"><path d="M0 185Q150 270 300 185Q450 270 600 185Q750 270 900 185Q1050 270 1200 185" /><path strokeWidth="5" d="M0 228H1200M300 180V300M600 180V300M900 180V300" /></g>
          <g fill="currentColor"><path d="M425 201h65v21h-65zm72 0h65v21h-65zm72 8h38v13h-38zm45-17h24v30h-24zm24 10h52v20h-52zm39-20h8v22h-8z" /><circle cx="438" cy="224" r="4"/><circle cx="477" cy="224" r="4"/><circle cx="510" cy="224" r="4"/><circle cx="550" cy="224" r="4"/><circle cx="580" cy="224" r="4"/><circle cx="600" cy="224" r="4"/><circle cx="646" cy="222" r="6"/><circle cx="664" cy="222" r="6"/><circle cx="682" cy="222" r="6"/></g>
        </svg>
        <canvas ref={canvas} className="dash-cloudtrain__canvas" />
      </div>
    </div>
  )
}
