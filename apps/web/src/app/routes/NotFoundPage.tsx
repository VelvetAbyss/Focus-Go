import { Link, useNavigate } from 'react-router-dom'
import { ROUTES } from './routes'
import { useI18n } from '../../shared/i18n/useI18n'

/**
 * Catch-all 404. Renders inside the AppShell, so the sidebar/nav stays available
 * and the user is never at a true dead end.
 */
const NotFoundPage = () => {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <main className="module-page-shell module-placeholder-shell">
      <section className="flex w-full max-w-md flex-col items-center px-6 text-center">
        <p
          className="text-[5.5rem] leading-none"
          style={{ fontFamily: 'var(--font-display)', color: 'color-mix(in srgb, var(--text-primary) 16%, transparent)' }}
          aria-hidden="true"
        >
          404
        </p>

        <h1 className="mt-2 text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {t('notFound.title')}
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {t('notFound.body')}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={ROUTES.DASHBOARD}
            className="inline-flex h-9 items-center rounded-full px-5 text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
          >
            {t('notFound.home')}
          </Link>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('notFound.back')}
          </button>
        </div>
      </section>
    </main>
  )
}

export default NotFoundPage
