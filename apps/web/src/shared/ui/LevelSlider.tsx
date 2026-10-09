import type { CSSProperties } from 'react'
import './AudioSliders.css'

type LevelSliderProps = {
  /** 0–1. */
  value: number
  onChange: (value: number) => void
  label: string
  /** The sound is playing: the bars inside the level dance. */
  playing?: boolean
  disabled?: boolean
  /** How many bars the level is drawn with. */
  bars?: number
  className?: string
}

// A fixed, uneven skyline, so every volume control draws the same shape.
// Every bar is at least about half height, so the level reads as a level.
const skyline = (x: number) => 0.28 + 0.72 * Math.abs(Math.sin(x * 1.7 + 0.4) * Math.cos(x * 0.31 + 1.1))
const barHeight = (index: number) => 0.35 + 0.65 * skyline(index * 1.9)

/**
 * Volume as a row of level bars (DESIGN.md › Volume and seek): bars up to the
 * level are ink, the rest pencil stubs, and while the sound plays the inked
 * bars dance on the compositor. A native range input lies over the bars, so
 * pointer, touch, keyboard and screen readers all work as they would on any
 * range.
 */
const LevelSlider = ({ value, onChange, label, playing = false, disabled = false, bars = 16, className }: LevelSliderProps) => {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const dancing = playing && !disabled && percent > 0
  return (
    <div
      className={`level-slider${className ? ` ${className}` : ''}`}
      data-playing={dancing || undefined}
      data-disabled={disabled || undefined}
    >
      <span className="level-slider__bars" aria-hidden="true">
        {Array.from({ length: bars }, (_, index) => (
          <i
            key={index}
            className={(index + 0.5) / bars <= percent / 100 ? 'is-on' : undefined}
            style={
              {
                '--bar-h': `${Math.round(barHeight(index) * 100)}%`,
                '--bar-dur': `${(0.9 + (index % 5) * 0.17).toFixed(2)}s`,
                '--bar-delay': `${(-((index * 0.37) % 1.3)).toFixed(2)}s`,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <input
        type="range"
        className="level-slider__input"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </div>
  )
}

export default LevelSlider
