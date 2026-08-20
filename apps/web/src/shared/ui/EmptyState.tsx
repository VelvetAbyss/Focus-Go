import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import './EmptyState.css'

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
        'flex flex-col items-center justify-center rounded-[28px] border border-[color-mix(in_srgb,var(--text-primary)_8%,transparent)] px-6 py-10 text-center text-[var(--text-primary)]',
        variant === 'onboarding' ? 'bg-[var(--bg-elevated)] shadow-[var(--shadow-card-lg)]' : 'bg-[color-mix(in_srgb,var(--bg-elevated)_88%,transparent)]',
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] text-[var(--text-primary)]">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-[color-mix(in_srgb,var(--text-primary)_72%,transparent)]">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" className="mt-5 rounded-full bg-[var(--text-primary)] px-5 text-[var(--bg-elevated)] hover:bg-[color-mix(in_srgb,var(--text-primary)_90%,transparent)]" onClick={onAction}>
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
 * Teaching empty states with three explicit variants:
 * - `first-time`: educate with body text and cross-feature link
 * - `filtered`: recover with a "clear filter" CTA
 * - `error`: retry with a clear error message
 */
export function DiscoveryEmptyState(props: DiscoveryEmptyStateProps) {
  return (
    <div className={`ds-empty ds-empty--${props.variant}`} aria-live="polite">
      <p className="ds-empty__title">{props.title}</p>

      {'body' in props && props.body && (
        <p className="ds-empty__body">{props.body}</p>
      )}

      {props.primaryAction && (
        <div className="ds-empty__action">{props.primaryAction}</div>
      )}

      {'relatedFeature' in props && props.relatedFeature && (
        <div className="ds-empty__related">
          {props.relatedFeature.href ? (
            <a href={props.relatedFeature.href} className="ds-empty__related-link">
              {props.relatedFeature.label}
            </a>
          ) : (
            <button
              type="button"
              className="ds-empty__related-link"
              onClick={props.relatedFeature.onClick}
            >
              {props.relatedFeature.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
