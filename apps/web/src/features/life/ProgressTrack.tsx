import { useCallback, useRef } from 'react'

const clampPct = (clientX: number, rect: DOMRect) =>
  Math.round(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))

const clampValue = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

type ProgressTrackProps = {
  value: number
  onChange: (pct: number) => void
  label?: string
  showLabel?: boolean
  color?: string
}

const ProgressTrack = ({ value, onChange, label, showLabel = true, color = '#3A3733' }: ProgressTrackProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const safeValue = clampValue(value)

  const commit = useCallback((clientX: number) => {
    const el = trackRef.current
    if (!el) return
    onChange(clampPct(clientX, el.getBoundingClientRect()))
  }, [onChange])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    commit(e.clientX)
  }, [commit])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    commit(e.clientX)
  }, [commit])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(clampValue(safeValue - step))
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(clampValue(safeValue + step))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onChange(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      onChange(100)
    }
  }, [onChange, safeValue])

  return (
    <div className="life-field">
      {showLabel ? <span>{label ?? 'Progress'} — {safeValue}%</span> : null}
      <div
        ref={trackRef}
        className="life-progress-track"
        role="slider"
        tabIndex={0}
        aria-label={label ?? 'Progress'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safeValue}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <div className="life-progress-track__fill" style={{ width: `${safeValue}%`, background: color }} />
        <div className="life-progress-track__thumb" style={{ left: `${safeValue}%`, background: color }} />
      </div>
    </div>
  )
}

export default ProgressTrack
