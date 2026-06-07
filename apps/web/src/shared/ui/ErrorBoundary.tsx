import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../i18n/translator'
import { normalizeLanguageCode } from '../i18n/detectLanguage'
import { LANGUAGE_KEY } from '../prefs/preferences'
import type { LanguageCode } from '../i18n/types'

interface ErrorBoundaryProps {
  children: ReactNode
}

/**
 * Read the persisted UI language directly. The boundary mounts above the
 * preferences provider, so the useI18n hook isn't available here — and it must
 * stay dependency-light so it can render even when the app tree is broken.
 */
function resolveLanguage(): LanguageCode {
  try {
    const raw = localStorage.getItem(LANGUAGE_KEY)
    if (raw) return normalizeLanguageCode(raw)
  } catch {
    // localStorage can throw (private mode, blocked storage) — fall through.
  }
  return 'zh'
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * App-level error boundary. A render error anywhere below this point shows a
 * branded, recoverable fallback instead of a blank white screen.
 *
 * Class component because React error boundaries require lifecycle hooks that
 * have no functional equivalent (getDerivedStateFromError / componentDidCatch).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for telemetry / local debugging. Swap for a real reporter later.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleHome = () => {
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const lang = resolveLanguage()

    return (
      <main
        role="alert"
        className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}
      >
        <div
          className="flex w-full max-w-md flex-col items-center rounded-[28px] border px-8 py-10"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border)',
            boxShadow: 'var(--shadow-card-lg)',
          }}
        >
          <div
            className="mb-5 flex size-14 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }}
            aria-hidden="true"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>

          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {t('error.title', lang)}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t('error.body', lang)}
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="h-9 rounded-full px-5 text-sm font-medium transition-colors"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
            >
              {t('error.reload', lang)}
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="h-9 rounded-full px-4 text-sm font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              {t('error.home', lang)}
            </button>
          </div>
        </div>
      </main>
    )
  }
}

export default ErrorBoundary
