import { Navigate, Link } from 'react-router-dom'
import { useLabs } from '../labs/LabsContext'
import { useI18n } from '../../shared/i18n/useI18n'
import { ROUTES } from '../../app/routes/routes'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
import TranslationCard from './TranslationCard'

export default function TranslationPage() {
  const { ready, catalog } = useLabs()
  const { language } = useI18n()
  const zh = language === 'zh'
  if (!ready) return <BrandLoader variant="inline" />
  if (!catalog.some(item => item.featureKey === 'translation' && item.state === 'installed')) {
    return <Navigate to={ROUTES.LABS} replace />
  }
  return <div className="module-page-shell translation-page">
    <header className="translation-page__header">
      <div className="type-heading-stack">
        <span className="translation-meta">{zh ? '实验室 · 免费工具' : 'Labs · Free tool'}</span>
        <h1 className="type-page-title">{zh ? '翻译' : 'Translate'}</h1>
        <p>{zh ? '随手译一段，或留出空间处理长文。' : 'Translate a quick note or make room for a longer text.'}</p>
      </div>
      <Link className="translation-link" to={ROUTES.LABS}>{zh ? '管理功能' : 'Manage feature'}</Link>
    </header>
    <div className="translation-page__workspace"><TranslationCard fullPage /></div>
    <p className="translation-notice translation-page__hint">{zh ? '也可在 Dashboard 的「管理组件」中自行添加翻译卡片。' : 'You can also add the translation card from Manage widgets on your Dashboard.'}</p>
  </div>
}
