import { useRef } from 'react'

type NoiseSliderProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  step?: number
  className?: string
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const NoiseSlider = ({ value, onChange, disabled = false, step = 0.01, className }: NoiseSliderProps) => {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return
    const { left, width } = trackRef.current.getBoundingClientRect()
    if (width <= 0) return
    const raw = clamp((clientX - left) / width, 0, 1)
    const stepped = Math.round(raw / step) * step
    onChange(clamp(stepped, 0, 1))
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromClientX(event.clientX)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return
    updateFromClientX(event.clientX)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    draggingRef.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handlePointerCancel = () => {
    draggingRef.current = false
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const delta = step
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      onChange(clamp(value + delta, 0, 1))
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      onChange(clamp(value - delta, 0, 1))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      onChange(0)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      onChange(1)
    }
  }

  return (
    <div
      className={`noise-slider ${disabled ? 'is-disabled' : ''} ${className ?? ''}`.trim()}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={Number(value.toFixed(2))}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={trackRef}
        className="noise-slider__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className="noise-slider__fill" style={{ width: `${value * 100}%` }} />
        <div className="noise-slider__thumb" style={{ left: `${value * 100}%` }} />
      </div>
    </div>
  )
}

export default NoiseSlider
