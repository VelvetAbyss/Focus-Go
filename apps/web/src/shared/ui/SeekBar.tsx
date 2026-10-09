import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { formatClock } from './seekTime'
import { waveform } from './waveform'
import './AudioSliders.css'

type SeekBarProps = {
  /** Seconds played. */
  currentTime: number
  /** Seconds in all; 0 or less when it isn't known yet. */
  duration: number
  /** Called with the fraction (0–1) to jump to. */
  onSeek: (fraction: number) => void
  label: string
  /** What the waveform is drawn from, e.g. the episode id. */
  seed?: string
  disabled?: boolean
  className?: string
}

/** One bar every BAR_PITCH px of width. */
const BAR_PITCH = 4
/** Bars drawn before the width is known (first paint, tests). */
const FALLBACK_BARS = 40

/**
 * Playback position as a waveform (DESIGN.md › Volume and seek): bars played
 * are ink, bars ahead are pencil, and the playhead is the pen because it is
 * "now". The ink copy is clipped to the played width, so progress only moves
 * one CSS variable. A native range input lies over it.
 */
const SeekBar = ({ currentTime, duration, onSeek, label, seed = '', disabled = false, className }: SeekBarProps) => {
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const count = width > 0 ? Math.max(12, Math.floor(width / BAR_PITCH)) : FALLBACK_BARS
  const bars = useMemo(
    () => waveform(seed, count).map((height, index) => <i key={index} style={{ height: `${Math.round(height * 100)}%` }} />),
    [count, seed],
  )

  const known = duration > 0
  const fraction = known ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const percent = Math.round(fraction * 1000) / 10
  const off = disabled || !known
  return (
    <div
      ref={wrapRef}
      className={`seek-bar${className ? ` ${className}` : ''}`}
      data-disabled={off || undefined}
      style={{ '--seek': `${percent}%` } as CSSProperties}
    >
      <span className="seek-bar__wave" aria-hidden="true">
        <span className="seek-bar__bars">{bars}</span>
        <span className="seek-bar__bars seek-bar__bars--played">{bars}</span>
        {known ? <span className="seek-bar__head" /> : null}
      </span>
      <input
        type="range"
        className="seek-bar__input"
        min={0}
        max={100}
        step={0.1}
        value={percent}
        disabled={off}
        aria-label={label}
        aria-valuetext={known ? `${formatClock(currentTime)} / ${formatClock(duration)}` : undefined}
        onChange={(event) => onSeek(Number(event.target.value) / 100)}
      />
    </div>
  )
}

export default SeekBar
