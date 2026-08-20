import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import './HelpBadge.css'

interface Props {
  /** aria-label for the trigger button */
  label: string
  children: React.ReactNode
}

/**
 * Persistent `?` glyph that toggles an explanation popover.
 * Click/tap to open; Escape or click-outside to close.
 * No hover-to-open — works on touch devices.
 */
export function HelpBadge({ label, children }: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="help-badge"
          aria-label={label}
        >
          <HelpCircle size={14} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="help-badge__popover" sideOffset={6}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
