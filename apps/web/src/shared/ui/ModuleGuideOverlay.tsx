import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type AnchorRect = {
  top: number
  left: number
  width: number
  height: number
  borderRadius: number
}

type CardPosition = {
  top: number
  left: number
  placement: 'below' | 'above'
}

type ModuleGuideOverlayProps = {
  /** CSS selector for the element to spotlight. If null/empty, card floats in a default corner. */
  anchor?: string | null
  title: string
  description: string
  ctaLabel?: string
  onCta?: () => void
  onDismiss: () => void
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CARD_WIDTH = 300
const CARD_OFFSET = 14
const RING_PADDING = 6
const FADE_DURATION = 220 // ms

// ─── Helpers ─────────────────────────────────────────────────────────────────

const measureAnchor = (selector: string): AnchorRect | null => {
  const el = selector ? document.querySelector(selector) : null
  if (!(el instanceof HTMLElement)) return null
  const rect = el.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return null
  const style = window.getComputedStyle(el)
  const br = parseFloat(style.borderRadius) || 0
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, borderRadius: br }
}

const calcCardPosition = (anchorRect: AnchorRect, cardHeight: number): CardPosition => {
  const spaceBelow = window.innerHeight - (anchorRect.top + anchorRect.height)
  const spaceAbove = anchorRect.top
  const neededBelow = cardHeight + CARD_OFFSET + 24
  const placement: 'below' | 'above' = spaceBelow >= neededBelow || spaceBelow >= spaceAbove ? 'below' : 'above'

  const top =
    placement === 'below'
      ? anchorRect.top + anchorRect.height + CARD_OFFSET
      : anchorRect.top - cardHeight - CARD_OFFSET

  const rawLeft = anchorRect.left
  const left = Math.max(16, Math.min(rawLeft, window.innerWidth - CARD_WIDTH - 16))

  return { top, left, placement }
}

// ─── Component ────────────────────────────────────────────────────────────────

const ModuleGuideOverlay = ({ anchor, title, description, ctaLabel, onCta, onDismiss }: ModuleGuideOverlayProps) => {
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const [cardPos, setCardPos] = useState<CardPosition | null>(null)
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Measure anchor + card on mount and on resize/scroll
  const sync = () => {
    const rect = anchor ? measureAnchor(anchor) : null
    setAnchorRect(rect)
    if (cardRef.current) {
      const cardHeight = cardRef.current.offsetHeight
      if (rect) {
        setCardPos(calcCardPosition(rect, cardHeight))
      }
    }
  }

  useLayoutEffect(() => {
    // Delay one frame so lazy-loaded pages can paint their anchor elements
    const raf = requestAnimationFrame(() => {
      sync()
      setVisible(true)
    })
    return () => cancelAnimationFrame(raf)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor])

  useEffect(() => {
    window.addEventListener('resize', sync, { passive: true })
    window.addEventListener('scroll', sync, { passive: true, capture: true })
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, FADE_DURATION)
  }

  const handleCta = () => {
    setVisible(false)
    setTimeout(() => onCta?.(), FADE_DURATION)
  }

  // Fallback card position (bottom-right corner) when no anchor available
  const fallbackCardStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: CARD_WIDTH,
    zIndex: 81,
  }

  return (
    <>
      {/* ── Full-page soft dim (pointer-events: none — never blocks clicks) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 78,
          background: 'rgba(20, 18, 16, 0.12)',
          transition: `opacity ${FADE_DURATION}ms ease`,
          opacity: visible ? 1 : 0,
        }}
      />

      {/* ── Spotlight ring over anchor element ── */}
      {anchorRect && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: anchorRect.top - RING_PADDING,
            left: anchorRect.left - RING_PADDING,
            width: anchorRect.width + RING_PADDING * 2,
            height: anchorRect.height + RING_PADDING * 2,
            borderRadius: Math.max(anchorRect.borderRadius + RING_PADDING, 8),
            // White ring + large shadow that dims everything outside
            boxShadow: [
              '0 0 0 2px rgba(255,255,255,0.72)',
              '0 0 0 4px rgba(255,255,255,0.24)',
              '0 0 18px 0 rgba(255,255,255,0.3)',
              // Erase the dim for the anchor by creating a bright surrounding glow
            ].join(', '),
            pointerEvents: 'none',
            zIndex: 79,
            transition: `opacity ${FADE_DURATION}ms ease`,
            opacity: visible ? 1 : 0,
            // Subtle pulse animation
            animation: visible ? 'module-guide-pulse 2.4s ease-in-out infinite' : 'none',
          }}
        />
      )}

      {/* ── Hint card ── */}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-label={title}
        style={
          anchorRect && cardPos
            ? {
                position: 'fixed',
                top: cardPos.top,
                left: cardPos.left,
                width: CARD_WIDTH,
                zIndex: 81,
                transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
              }
            : {
                ...fallbackCardStyle,
                transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`,
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(6px)',
              }
        }
        className="pointer-events-auto rounded-[20px] border border-[#3A3733]/10 bg-[#F5F3F0] p-4 shadow-[0_20px_64px_rgba(20,18,16,0.22),0_4px_16px_rgba(20,18,16,0.1)]"
      >
        {/* Placement arrow cue — subtle dot line */}
        {anchorRect && cardPos && (
          <div
            aria-hidden="true"
            className="absolute left-4"
            style={{
              ...(cardPos.placement === 'below'
                ? { top: -CARD_OFFSET, height: CARD_OFFSET - 2 }
                : { bottom: -CARD_OFFSET, height: CARD_OFFSET - 2 }),
              width: 1,
              background: 'linear-gradient(to bottom, transparent, rgba(58,55,51,0.18), transparent)',
            }}
          />
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[#3A3733]">{title}</p>
            <p className="mt-1 text-[12px] leading-[1.6] text-[#3A3733]/64">{description}</p>
          </div>
          <button
            type="button"
            className="ml-1 mt-0.5 shrink-0 rounded-full p-1 text-[#3A3733]/40 transition-colors hover:bg-[#3A3733]/8 hover:text-[#3A3733]/72"
            onClick={handleDismiss}
            aria-label="Dismiss guide"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {ctaLabel && onCta && (
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              className="h-7 rounded-full bg-[#3A3733] px-3.5 text-[11px] font-medium text-[#F5F3F0] hover:bg-[#3A3733]/88"
              onClick={handleCta}
            >
              {ctaLabel}
            </Button>
          </div>
        )}
      </div>

      {/* ── Keyframe for pulse animation injected once ── */}
      <style>{`
        @keyframes module-guide-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.62; }
        }
      `}</style>
    </>
  )
}

export default ModuleGuideOverlay
