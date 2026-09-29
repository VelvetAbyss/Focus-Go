import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import './EmptyState.css'
import Doodle, { type DoodleName } from './Doodle'

// ─── Legacy shape (existing callers) ─────────────────────────────────────────

export type EmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'default' | 'onboarding'
  className?: string
}

const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className,
}: EmptyStateProps) => {
  return (
    <div
      className={cn(
        // Top-left, never centred (DESIGN.md › Empty states).
        'flex flex-col items-start rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] px-6 py-8 text-left text-[var(--text-primary)]',
        variant === 'onboarding' ? 'bg-[var(--bg-elevated)] shadow-[var(--shadow-card-lg)]' : 'bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)]',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] text-[var(--text-primary)]">
        {icon}
      </div>
      <h3 className="font-display text-subhead font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-5 rounded-full bg-[var(--cta-bg)] px-5 text-[var(--cta-fg)] hover:bg-[var(--cta-bg-hover)]" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export default EmptyState

// ─── Discovery empty state (3-variant teaching system) ───────────────────────

interface DiscoveryFirstTimeProps {
  variant: 'first-time'
  title: string
  body?: string
  primaryAction?: ReactNode
  relatedFeature?: { label: string; href?: string; onClick?: () => void }
  /** Optional pencil-toned drawing above the title. */
  illustration?: DoodleName
  /** Drawing height in px: 112 on a page (default), 72–88 in a card. */
  illustrationHeight?: number
}

interface DiscoveryFilteredProps {
  variant: 'filtered'
  title: string
  primaryAction?: ReactNode
}

interface DiscoveryErrorProps {
  variant: 'error'
  title: string
  body?: string
  primaryAction?: ReactNode
}

export type DiscoveryEmptyStateProps =
  | DiscoveryFirstTimeProps
  | DiscoveryFilteredProps
  | DiscoveryErrorProps

/**
 * Teaching empty states with three explicit variants (DESIGN.md › Empty
 * states: top-left, one serif line, one sentence, one action):
 * - `first-time`: educate with body text and cross-feature link
 * - `filtered`: recover with a "clear filter" CTA
 * - `error`: retry with a clear error message
 */
export function DiscoveryEmptyState(props: DiscoveryEmptyStateProps) {
  const related = 'relatedFeature' in props ? props.relatedFeature : undefined
  return (
    <div className={`ds-empty ds-empty--${props.variant}`} aria-live="polite">
      {'illustration' in props && props.illustration ? (
        <Doodle name={props.illustration} height={props.illustrationHeight} className="ds-empty__art" />
      ) : null}

      <p className="ds-empty__title">{props.title}</p>

      {'body' in props && props.body && (
        <p className="ds-empty__body">{props.body}</p>
      )}

      {props.primaryAction && (
        <div className="ds-empty__action">{props.primaryAction}</div>
      )}

      {related ? (
        <div className="ds-empty__related">
          {related.href ? (
            <a href={related.href} className="ds-empty__related-link">
              {related.label}
            </a>
          ) : related.onClick ? (
            <button type="button" className="ds-empty__related-link" onClick={related.onClick}>
              {related.label}
            </button>
          ) : (
            // Without a destination it is a hint, not a link.
            <span className="ds-empty__related-hint">{related.label.replace(/\s*→$/, '')}</span>
          )}
        </div>
      ) : null}
    </div>
  )
}
