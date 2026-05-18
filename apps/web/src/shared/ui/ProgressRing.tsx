import { motion } from 'framer-motion'

type ProgressRingProps = {
  progress: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
  showText?: boolean
}

const EASE_OUT = [0.16, 1, 0.3, 1] as const

/**
 * Animated circular progress ring with an inline percentage text. Used in
 * project cards, project detail hero, and anywhere else a compact progress
 * indicator is needed. Pure SVG, no external deps.
 */
const ProgressRing = ({
  progress,
  size = 96,
  strokeWidth = 6,
  label,
  className,
  showText = true,
}: ProgressRingProps) => {
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, progress))
  const offset = circumference * (1 - clamped / 100)
  return (
    <svg width={size} height={size} className={className ?? 'pd-ring'} aria-label={label}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="pd-ring__track"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="pd-ring__fill"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {showText ? (
        <text
          x={size / 2}
          y={size / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          className="pd-ring__text"
        >
          {Math.round(clamped)}%
        </text>
      ) : null}
    </svg>
  )
}

export default ProgressRing
