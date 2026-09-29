import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export type InkMarkState = 'todo' | 'doing' | 'done'

type InkMarkProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  state: InkMarkState
  /** Diameter in px; defaults to 16. */
  size?: number
}

/**
 * The task state mark (DESIGN.md › Three hands): a dashed pencil circle while
 * the item is only intended, an ochre ring while in progress, and a filled ink
 * circle with a paper check once it is done. Styles live in
 * shared/theme/marks.css.
 */
const InkMark = ({ state, size, className, style, ...props }: InkMarkProps) => (
  <button
    type="button"
    className={cn('ink-mark', className)}
    data-state={state}
    style={size ? { ...style, ['--ink-mark-size' as string]: `${size}px` } : style}
    {...props}
  >
    <svg className="ink-mark__check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 8.5L6.8 11.2L12 5.5" />
    </svg>
  </button>
)

export default InkMark
