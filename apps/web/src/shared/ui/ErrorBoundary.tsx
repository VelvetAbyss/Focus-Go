import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, RotateCcw } from 'lucide-react'
import './ErrorBoundary.css'
import Doodle from './Doodle'
import { LANGUAGE_KEY } from '../prefs/preferences'
import { normalizeLanguageCode } from '../i18n/detectLanguage'
import { t } from '../i18n/translator'
import type { LanguageCode, TranslationKey } from '../i18n/types'

// The root boundary mounts outside the provider tree, so copy resolution cannot
// rely on PreferencesContext/useI18n — read the stored language directly and
// fall back to the browser locale.
const resolveLanguage = (): LanguageCode => {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    if (stored) return normalizeLanguageCode(stored)
  } catch {
    // localStorage unavailable (privacy mode) — fall through to navigator
  }
  return normalizeLanguageCode(navigator.language ?? 'en')
}

// Message tables load lazily, so a crash during boot can reach this boundary
// before any locale is cached — and `t` returns the raw key on a miss. A
// last-resort fallback must never render "error.title" at the user, so keep a
// minimal inline copy for exactly that window. The i18n files stay the source
// of truth everywhere else.
const FALLBACK_COPY: Record<LanguageCode, Record<string, string>> = {
  en: {
    'error.title': 'Something went wrong',
    'error.body': 'This part of the app hit an unexpected error. Your saved work is safe.',
    'error.retry': 'Try again',
    'error.reload': 'Reload app',
  },
  zh: {
    'error.title': '出了点问题',
    'error.body': '这个部分遇到了意外错误，你保存的内容是安全的。',
    'error.retry': '重试',
    'error.reload': '重新加载应用',
  },
}

const translate = (key: TranslationKey, lang: LanguageCode) => {
  const resolved = t(key, lang)
  return resolved === key ? (FALLBACK_COPY[lang][key] ?? key) : resolved
}

type FallbackScope = 'app' | 'route'

interface ErrorBoundaryProps {
  children: ReactNode
  /** 'app' renders a fullscreen fallback; 'route' renders inline within the shell. */
  scope?: FallbackScope
  /** When this value changes (e.g. route pathname), a crashed boundary resets itself. */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Class component because React error boundaries require lifecycle hooks that
 * have no functional equivalent (getDerivedStateFromError / componentDidCatch).
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for telemetry / local debugging. Swap for a real reporter later.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  handleRetry = () => {
    this.setState({ error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const scope = this.props.scope ?? 'route'
    const lang = resolveLanguage()

    return (
      <section className={`error-boundary error-boundary--${scope}`} role="alert">
        <div className="error-boundary__card">
          <Doodle name="clumsy" height={96} className="error-boundary__art" />
          <h2 className="error-boundary__title">{translate('error.title', lang)}</h2>
          <p className="error-boundary__body">{translate('error.body', lang)}</p>
          <div className="error-boundary__actions">
            <button type="button" className="error-boundary__btn error-boundary__btn--primary" onClick={this.handleRetry}>
              <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
              {translate('error.retry', lang)}
            </button>
            <button type="button" className="error-boundary__btn" onClick={this.handleReload}>
              <RefreshCw size={14} strokeWidth={2} aria-hidden="true" />
              {translate('error.reload', lang)}
            </button>
          </div>
        </div>
      </section>
    )
  }
}

export default ErrorBoundary
