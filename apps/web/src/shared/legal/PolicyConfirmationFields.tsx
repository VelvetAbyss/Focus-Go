import { useId } from 'react'
import type { LanguageCode } from '../i18n/types'
import { POLICY_VERSION, policyUrl } from './policies'
export const PolicyLinks = ({ language }: { language: LanguageCode }) => <span className="policy-links">
  <a href={policyUrl('terms-of-service', language)} target="_blank" rel="noreferrer">{language === 'zh' ? '服务条款' : 'Terms of Service'}</a>
  <span aria-hidden="true"> · </span>
  <a href={policyUrl('privacy-policy', language)} target="_blank" rel="noreferrer">{language === 'zh' ? '隐私政策' : 'Privacy Policy'}</a>
</span>
export const PolicyConfirmationFields = ({ language, checked, onChange, required = false, disabled = false }: { language: LanguageCode; checked: boolean; onChange: (value: boolean) => void; required?: boolean; disabled?: boolean }) => {
  const id = useId(), zh = language === 'zh'
  return <div className="policy-confirmation">
    <label htmlFor={id}><input id={id} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} required={required} disabled={disabled} />
      <span>{zh ? '我已阅读并同意服务条款，已知悉隐私政策。' : 'I have read and agree to the Terms of Service and acknowledge the Privacy Policy.'}</span>
    </label>
    <p><PolicyLinks language={language} /> <span className="policy-edition">{zh ? '版本' : 'Version'} {POLICY_VERSION}</span></p>
    <p>{zh ? '此确认不授权可选定位、通知或未来新增的数据用途。' : 'This does not authorize optional location, notifications or future data uses.'}</p>
  </div>
}
