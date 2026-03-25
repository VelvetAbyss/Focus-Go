import { X, Cloud, FolderInput, Sparkles, LogIn } from 'lucide-react'
import { getAuthUrl } from '../../config/auth'
import { useI18n } from '../../shared/i18n/useI18n'

type LoginModalProps = {
  onClose: () => void
}

const LoginModal = ({ onClose }: LoginModalProps) => {
  const { t } = useI18n()

  const handleLogin = () => {
    window.location.href = getAuthUrl()
  }

  return (
    <div className="login-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="login-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-modal__close" onClick={onClose} aria-label={t('common.close')}>
          <X size={15} />
        </button>

        <div className="login-modal__header">
          <p className="login-modal__eyebrow">{t('auth.modal.eyebrow')}</p>
          <h2 className="login-modal__title">{t('auth.modal.title')}</h2>
          <p className="login-modal__subtitle">{t('auth.modal.subtitle')}</p>
        </div>

        <div className="login-modal__features">
          <div className="login-modal__feature">
            <div className="login-modal__feature-icon">
              <Cloud size={18} />
            </div>
            <div className="login-modal__feature-body">
              <div className="login-modal__feature-name">{t('auth.modal.sync.title')}</div>
              <div className="login-modal__feature-desc">{t('auth.modal.sync.desc')}</div>
            </div>
          </div>

          <div className="login-modal__feature">
            <div className="login-modal__feature-icon">
              <FolderInput size={18} />
            </div>
            <div className="login-modal__feature-body">
              <div className="login-modal__feature-name">{t('auth.modal.transfer.title')}</div>
              <div className="login-modal__feature-desc">{t('auth.modal.transfer.desc')}</div>
            </div>
          </div>

          <div className="login-modal__feature login-modal__feature--premium">
            <div className="login-modal__feature-icon login-modal__feature-icon--premium">
              <Sparkles size={18} />
            </div>
            <div className="login-modal__feature-body">
              <div className="login-modal__feature-name">{t('auth.modal.premium.title')}</div>
              <div className="login-modal__feature-desc">{t('auth.modal.premium.desc')}</div>
            </div>
          </div>
        </div>

        <button type="button" className="login-modal__cta" onClick={handleLogin}>
          <LogIn size={15} />
          {t('auth.modal.cta')}
        </button>
      </div>
    </div>
  )
}

export default LoginModal
