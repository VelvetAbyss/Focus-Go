import { X, Check, Sparkles, LogIn } from 'lucide-react'
import type { CSSProperties } from 'react'
import { prepareAuthSession } from '../../config/auth'
import { useI18n } from '../../shared/i18n/useI18n'

type LoginModalProps = {
  onClose: () => void
}

const LoginModal = ({ onClose }: LoginModalProps) => {
  const { t } = useI18n()

  const handleLogin = async () => {
    window.location.href = await prepareAuthSession()
  }

  return (
    <div className="login-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>

        {/* Hero band */}
        <div className="login-modal__hero" aria-hidden="true">
          <div className="login-modal__hero-ring login-modal__hero-ring--1" />
          <div className="login-modal__hero-ring login-modal__hero-ring--2" />
          <div className="login-modal__hero-dots" />
        </div>

        {/* Close button sits over the hero */}
        <button
          type="button"
          className="login-modal__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          <X size={13} strokeWidth={2.5} />
        </button>

        {/* Content */}
        <div className="login-modal__content">
          <div className="login-modal__header">
            <p className="login-modal__eyebrow">{t('auth.modal.eyebrow')}</p>
            <h2 className="login-modal__title">{t('auth.modal.title')}</h2>
            <p className="login-modal__subtitle">{t('auth.modal.subtitle')}</p>
          </div>

          <div className="login-modal__features">
            {/* Free: core features */}
            <div
              className="login-modal__feature"
              style={{ '--lm-delay': '40ms' } as CSSProperties}
            >
              <div className="login-modal__feature-check">
                <Check size={11} strokeWidth={3} />
              </div>
              <div className="login-modal__feature-body">
                <div className="login-modal__feature-name">{t('auth.modal.core.title')}</div>
                <div className="login-modal__feature-desc">{t('auth.modal.core.desc')}</div>
              </div>
            </div>

            {/* Free: import & export */}
            <div
              className="login-modal__feature"
              style={{ '--lm-delay': '90ms' } as CSSProperties}
            >
              <div className="login-modal__feature-check">
                <Check size={11} strokeWidth={3} />
              </div>
              <div className="login-modal__feature-body">
                <div className="login-modal__feature-name">{t('auth.modal.transfer.title')}</div>
                <div className="login-modal__feature-desc">{t('auth.modal.transfer.desc')}</div>
              </div>
            </div>

            {/* Premium upsell */}
            <div
              className="login-modal__feature login-modal__feature--premium"
              style={{ '--lm-delay': '140ms' } as CSSProperties}
            >
              <div className="login-modal__feature-spark">
                <Sparkles size={13} strokeWidth={2} />
              </div>
              <div className="login-modal__feature-body">
                <div className="login-modal__feature-name">
                  {t('auth.modal.premium.title')}
                  <span className="login-modal__premium-badge">{t('auth.modal.premium.badge')}</span>
                </div>
                <div className="login-modal__feature-desc">{t('auth.modal.premium.desc')}</div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="login-modal__cta"
            style={{ '--lm-delay': '200ms' } as CSSProperties}
            onClick={() => void handleLogin()}
          >
            <LogIn size={14} strokeWidth={2.2} />
            {t('auth.modal.cta')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
