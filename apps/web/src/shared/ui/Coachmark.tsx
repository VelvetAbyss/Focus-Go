import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

type CoachmarkProps = {
  anchor: string
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
  onDismiss: () => void
}

type Position = {
  top: number
  left: number
}

const resolvePosition = (anchor: string): Position | null => {
  const target = document.querySelector(anchor)
  if (!(target instanceof HTMLElement)) return null
  const rect = target.getBoundingClientRect()
  return {
    top: rect.bottom + 12,
    left: Math.min(rect.left, window.innerWidth - 332),
  }
}

const Coachmark = ({ anchor, title, description, ctaLabel, onCta, onDismiss }: CoachmarkProps) => {
  const [position, setPosition] = useState<Position | null>(null)

  useEffect(() => {
    const sync = () => setPosition(resolvePosition(anchor))
    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [anchor])

  if (!position) return null

  return (
    <div
      className="pointer-events-auto fixed z-[80] w-[320px] rounded-[24px] border border-[#3A3733]/10 bg-[#F5F3F0] p-4 text-[#3A3733] shadow-[0_24px_80px_rgba(58,55,51,0.18)]"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-modal="false"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6 text-[#3A3733]/72">{description}</p>
        </div>
        <button
          type="button"
          className="rounded-full p-1 text-[#3A3733]/56 transition hover:bg-[#3A3733]/8 hover:text-[#3A3733]"
          onClick={onDismiss}
          aria-label="Dismiss coachmark"
        >
          <X className="size-4" />
        </button>
      </div>
      {ctaLabel && onCta ? (
        <div className="mt-4">
          <Button type="button" className="rounded-full bg-[#3A3733] px-4 text-[#F5F3F0] hover:bg-[#3A3733]/90" onClick={onCta}>
            {ctaLabel}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export default Coachmark
