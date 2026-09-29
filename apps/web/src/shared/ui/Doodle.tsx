import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import './Doodle.css'

export type DoodleName =
  | 'coffee'
  | 'reading-side'
  | 'sitting-reading'
  | 'laying'
  | 'chilling'
  | 'meditating'
  | 'levitate'
  | 'roller-skating'
  | 'plant'
  | 'strolling'
  | 'unboxing'
  | 'clumsy'
  | 'sitting'
  | 'swinging'
  | 'ice-cream'

// Width / height of each drawing. The SVGs are cropped to their ink (plus a
// small even margin), so every drawing sits flush left and a shared height
// gives them the same visual weight.
const DOODLE_RATIO: Record<DoodleName, number> = {
  coffee: 1.286,
  'reading-side': 1.591,
  'sitting-reading': 1.253,
  laying: 1.849,
  chilling: 1.549,
  meditating: 1.291,
  levitate: 1.781,
  'roller-skating': 1.324,
  plant: 1.065,
  strolling: 1.032,
  unboxing: 1.27,
  clumsy: 1.253,
  sitting: 1.082,
  swinging: 1.063,
  'ice-cream': 0.882,
}

type DoodleProps = {
  name: DoodleName
  /** Rendered height in px; the width follows the drawing. Defaults to 112. */
  height?: number
  className?: string
}

const mask = (url: string): CSSProperties => ({ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})` })

/**
 * A pencil-toned empty-state drawing (Open Doodles, CC0 — see
 * public/illustrations/README.md). Decorative: hidden from assistive tech.
 */
const Doodle = ({ name, height, className }: DoodleProps) => (
  <div
    className={cn('doodle', className)}
    style={
      {
        '--doodle-ratio': String(DOODLE_RATIO[name]),
        ...(height ? { '--doodle-height': `${height}px` } : {}),
      } as CSSProperties
    }
    aria-hidden="true"
  >
    <span className="doodle__wash" style={mask(`/illustrations/${name}-wash.svg`)} />
    <span className="doodle__lines" style={mask(`/illustrations/${name}-lines.svg`)} />
  </div>
)

export default Doodle
