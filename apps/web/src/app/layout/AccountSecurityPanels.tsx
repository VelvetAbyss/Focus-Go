import { useEffect, useState } from 'react'
import { requestAccount } from '../../store/userProfile'
import { useAccountCopy, accountError } from './accountCopy'

type Details = { providers: string[]; hasPassword: boolean; emailVerified: boolean; sessions: { id: string; current: boolean; userAgent: string | null; ipAddress: string | null; updatedAt: string }[] }
const useAccountDetails = () => {
  const [details, setDetails] = useState<Details | null>(null), [error, setError] = useState(false)
  const load = async () => { setError(false); try { setDetails(await requestAccount<Details>('/account')) } catch { setError(true) } }
  useEffect(() => { let active = true; void requestAccount<Details>('/account').then(data => { if (active) setDetails(data) }).catch(() => { if (active) setError(true) }); return () => { active = false } }, [])
  return { details, error, load }
}
export const EmailLoginPanel = ({ email }: { email: string }) => {
  const copy = useAccountCopy(), { details, error, load } = useAccountDetails()
  return <div className="acct-subpanel-body">
    <p>{email}</p>
    {error ? <p role="alert">{copy('failed')} <button type="button" onClick={load}>{copy('retry')}</button></p> : !details ? <p role="status">{copy('loading')}</p> : <>
      <p>{details.emailVerified ? copy('verified') : copy('unverified')}</p>
      <h3>{copy('loginMethods')}</h3><ul>{details.providers.map(provider => <li key={provider}>{provider === 'credential' ? copy('credential') : provider}</li>)}</ul>
      <p className="acct-subpanel-hint">{copy('emailHint')}</p>
    </>}
  </div>
}
export const SecurityPanel = () => {
  const copy = useAccountCopy(), { details, error, load } = useAccountDetails()
  const [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [failed, setFailed] = useState('')
  const run = async (action: () => Promise<unknown>, success = '') => {
    if (busy) return; setBusy(true); setFailed(''); setNotice('')
    try { await action(); setNotice(success); await load() } catch (error) { setFailed(accountError(error, copy)) } finally { setBusy(false) }
  }
  if (error) return <div className="acct-subpanel-body"><p role="alert">{copy('failed')}</p><button type="button" onClick={load}>{copy('retry')}</button></div>
  if (!details) return <p className="acct-subpanel-body" role="status">{copy('loading')}</p>
  return <div className="acct-subpanel-body">
    <h3>{copy('password')}</h3>
    {details.hasPassword ? <form className="acct-security-form" onSubmit={event => { event.preventDefault(); void run(async () => { await requestAccount('/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); setCurrentPassword(''); setNewPassword('') }, copy('passwordChanged')) }}>
      <label>{copy('currentPassword')}<input className="acct-field-input" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} maxLength={128} required /></label>
      <label>{copy('newPassword')}<input className="acct-field-input" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
      <button className="acct-save-btn" disabled={busy} type="submit">{copy('changePassword')}</button>
    </form> : <p>{copy('oauthPassword')}</p>}
    {failed && <p role="alert">{failed}</p>}{notice && <p role="status">{notice}</p>}
    <h3>{copy('sessions')}</h3>
    <ul className="acct-device-list">{details.sessions.map(session => <li key={session.id}>
      <div><strong>{session.current ? copy('currentSession') : copy('unknownDevice')}</strong><p className="acct-device-agent">{session.userAgent || '—'}</p><span>{copy('lastActive')}: {new Date(session.updatedAt).toLocaleString()}</span>{session.ipAddress && <span> · {session.ipAddress}</span>}</div>
      {!session.current && <button disabled={busy} type="button" onClick={() => { if (window.confirm(copy('revokeConfirm'))) void run(() => requestAccount(`/sessions/${encodeURIComponent(session.id)}/revoke`, { method: 'POST', body: '{}' })) }}>{copy('revoke')}</button>}
    </li>)}</ul>
    <button className="acct-footer-btn" disabled={busy || !details.sessions.some(session => !session.current)} type="button" onClick={() => { if (window.confirm(copy('revokeOthersConfirm'))) void run(() => requestAccount('/sessions/revoke-others', { method: 'POST', body: '{}' })) }}>{copy('revokeOthers')}</button>
  </div>
}
export const DeleteAccountPanel = ({ email, onDeleted }: { email: string; onDeleted: () => Promise<void> }) => {
  const copy = useAccountCopy(), { details, error, load } = useAccountDetails()
  const [confirmEmail, setConfirmEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [failure, setFailure] = useState('')
  return <form className="acct-subpanel-body acct-security-form" onSubmit={async event => {
    event.preventDefault(); if (busy || !details) return; setBusy(true); setFailure('')
    try { await requestAccount('/account/deletion', { method: 'POST', body: JSON.stringify({ confirmEmail, password }) }) } catch (error) { setFailure(accountError(error, copy)); setBusy(false); return }
    await onDeleted()
  }}>
    <p className="acct-delete-warning">{copy('deleteWarning')}</p>
    {error ? <p role="alert">{copy('failed')} <button type="button" onClick={load}>{copy('retry')}</button></p> : !details ? <p role="status">{copy('loading')}</p> : <>
      <label>{copy('deleteConfirm')}<input className="acct-field-input" type="email" value={confirmEmail} onChange={event => setConfirmEmail(event.target.value)} autoComplete="off" required /></label>
      {details.hasPassword && <label>{copy('currentPassword')}<input className="acct-field-input" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={128} required /></label>}
      <button type="submit" className="acct-delete-btn" disabled={busy || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}>{copy('deleteSubmit')}</button>
    </>}
    {failure && <p role="alert">{failure}</p>}<p className="acct-subpanel-hint">{copy('deleteNote')}</p>
  </form>
}
