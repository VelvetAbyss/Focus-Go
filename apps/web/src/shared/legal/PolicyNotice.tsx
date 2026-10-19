import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { requestAccount } from '../../store/userProfile'
import { getAuth } from '../../store/auth'
import { useI18n } from '../i18n/useI18n'
import { POLICY_VERSION, policyConfirmation } from './policies'
import { PolicyConfirmationFields } from './PolicyConfirmationFields'
export const PolicyNotice = ({ userId }: { userId: string }) => {
  const { language } = useI18n(), zh = language === 'zh'
  const [needed, setNeeded] = useState(false), [checked, setChecked] = useState(false), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [dismissed, setDismissed] = useState(false)
  useEffect(() => { let active = true; void requestAccount<{ acceptance: unknown }>('/policy').then(result => { if (active) setNeeded(!result.acceptance) }).catch(() => { /* Do not manufacture agreement when offline or on an older API. */ }); return () => { active = false } }, [userId])
  if (!needed || dismissed) return null
  return createPortal(<aside className="policy-update" aria-label={zh ? '政策更新' : 'Policy update'}>
    <button className="policy-update-dismiss" type="button" onClick={() => setDismissed(true)}>{zh ? '稍后处理' : 'Later'}</button>
    <details><summary>{zh ? '政策已更新，查看并确认' : 'Policies updated — review and confirm'} · <span className="policy-edition">{POLICY_VERSION}</span></summary>
      <p>{zh ? '新版明确了免费与登录规则、内容归属和数据处理。我们没有把此前的登录记为你已同意。' : 'The new edition clarifies free access, sign-in, content ownership and data handling. Your earlier sign-in has not been recorded as agreement.'}</p>
      <PolicyConfirmationFields language={language} checked={checked} onChange={setChecked} disabled={busy} />
      <button type="button" disabled={!checked || busy} onClick={async () => {
        setBusy(true); setFailed(false)
        try { await requestAccount('/policy', { method: 'POST', body: JSON.stringify(policyConfirmation(language)) }); if (getAuth()?.user?.id === userId) setNeeded(false) } catch { setFailed(true) } finally { setBusy(false) }
      }}>{busy ? '…' : zh ? '确认当前版本' : 'Confirm this edition'}</button>
      {failed && <p role="alert">{zh ? '确认未保存，请联网后重试。' : 'Confirmation was not saved. Reconnect and retry.'}</p>}
    </details>
  </aside>, document.body)
}
