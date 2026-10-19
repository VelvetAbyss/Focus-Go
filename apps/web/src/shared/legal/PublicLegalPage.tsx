import { useSearchParams, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/useI18n'
import { LEGAL_DOCUMENTS, POLICY_VERSION, POLICY_PREVIOUS_VERSION, policyUrl, type LegalDocumentKey } from './policies'
import { LEGACY_LEGAL_DOCUMENTS } from './legacyPolicies'
const PublicLegalPage = () => {
  const [params, setParams] = useSearchParams(), { language: preferred } = useI18n()
  const language = params.get('lang') === 'en' ? 'en' : params.get('lang') === 'zh' ? 'zh' : preferred
  const zh = language === 'zh'
  const { pathname } = useLocation()
  const name = pathname.slice('/legal/'.length)
  const validKey = name === 'terms-of-service' || name === 'privacy-policy'
  const key: LegalDocumentKey = name === 'privacy-policy' ? name : 'terms-of-service'
  const version = params.get('version') ?? POLICY_VERSION
  const archive = version === POLICY_PREVIOUS_VERSION
  const validVersion = version === POLICY_VERSION || archive
  const document = (archive ? LEGACY_LEGAL_DOCUMENTS : LEGAL_DOCUMENTS)[language][key]
  return <main className="public-policy" data-auth-preview-allowed="true">
    <header><a href="/">Focus&Go</a><nav aria-label={zh ? '政策语言' : 'Policy language'}>{(['zh', 'en'] as const).map(lang => <button key={lang} type="button" aria-pressed={language === lang} onClick={() => { const next = new URLSearchParams(params); next.set('lang', lang); setParams(next) }}>{lang === 'zh' ? '中文' : 'English'}</button>)}</nav></header>
    {!validKey || !validVersion ? <section><h1>{zh ? '找不到这个政策版本' : 'Policy edition not found'}</h1><a href={policyUrl('terms-of-service', language)}>{zh ? '查看当前版本' : 'View current edition'}</a></section> : <>
      <h1>{document.title}</h1><p>{document.summary}</p><p className="policy-version">{zh ? '版本' : 'Version'} {version}</p>
      {archive && <aside role="note">{zh ? '历史文本，已停用；不代表当前功能或规则。' : 'Archived text, no longer current. It does not describe current features or rules.'} <a href={policyUrl(key, language)}>{zh ? '查看当前版本' : 'View current edition'}</a></aside>}
      <nav className="policy-document-nav" aria-label={zh ? '政策文档' : 'Policy documents'}><a href={policyUrl('terms-of-service', language, version)}>{zh ? '服务条款' : 'Terms of Service'}</a><a href={policyUrl('privacy-policy', language, version)}>{zh ? '隐私政策' : 'Privacy Policy'}</a></nav>
      {document.sections.map((section, index) => <section key={section.heading}><h2>{index + 1}. {section.heading}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</section>)}
      <footer><h2>{zh ? '版本记录' : 'Edition history'}</h2><a href={policyUrl(key, language)}>{POLICY_VERSION} · {zh ? '当前：统一中英文、内容归属与注册确认' : 'Current: unified languages, content rights and registration confirmation'}</a><a href={policyUrl(key, language, POLICY_PREVIOUS_VERSION)}>{POLICY_PREVIOUS_VERSION} · {zh ? '历史版本' : 'Archived edition'}</a></footer>
    </>}
  </main>
}
export default PublicLegalPage
