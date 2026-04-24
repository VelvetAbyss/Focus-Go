import './BrandLoader.css'

type Variant = 'fullscreen' | 'inline'
type State = 'entry' | 'exit'

interface BrandLoaderProps {
  variant?: Variant
  state?: State
  /** Visible italic phrase below the mark. Undefined hides the label entirely. */
  label?: string
  /** Small signature block — only rendered for fullscreen variant. */
  showSignature?: boolean
  className?: string
  'data-testid'?: string
}

const BrandLoader = ({
  variant = 'fullscreen',
  state = 'entry',
  label,
  showSignature,
  className,
  'data-testid': testId,
}: BrandLoaderProps) => {
  const resolvedLabel = label ?? (variant === 'fullscreen' ? 'Preparing your workspace' : 'Loading')
  const renderSignature = showSignature ?? variant === 'fullscreen'

  return (
    <section
      className={`brand-loader brand-loader--${variant}${className ? ` ${className}` : ''}`}
      data-state={state}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-busy={state !== 'exit'}
    >
      <div className="brand-loader__aperture" aria-hidden="true">
        <div className="brand-loader__glow" />
        <svg viewBox="0 0 104 104">
          <circle className="brand-loader__ring-outer" cx="52" cy="52" r="44" />
          <circle className="brand-loader__ring-mid" cx="52" cy="52" r="34" />
          <circle className="brand-loader__ring-inner" cx="52" cy="52" r="22" />
          {variant === 'fullscreen' && (
            <>
              <line className="brand-loader__tick" x1="52" y1="6" x2="52" y2="12" />
              <line className="brand-loader__tick" x1="52" y1="92" x2="52" y2="98" />
              <line className="brand-loader__tick" x1="6" y1="52" x2="12" y2="52" />
              <line className="brand-loader__tick" x1="92" y1="52" x2="98" y2="52" />
            </>
          )}
          <circle className="brand-loader__dot" cx="52" cy="52" r="3" />
        </svg>
      </div>

      {resolvedLabel !== '' && (
        <div className="brand-loader__label">
          <em>{resolvedLabel}</em>
          {variant === 'fullscreen' && (
            <div className="brand-loader__dotline" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          )}
        </div>
      )}

      {renderSignature && (
        <div className="brand-loader__sig" aria-hidden="true">
          Focus<em>&amp;</em>go
          <small>calm systems · warm tools</small>
        </div>
      )}
    </section>
  )
}

export default BrandLoader
