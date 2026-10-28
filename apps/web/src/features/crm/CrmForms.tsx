import { useState, type FormEvent, type ReactNode } from 'react'
import { ArrowRight, CalendarDays, Mail, MessageSquare, Phone, Plus, Users, X } from 'lucide-react'
import type { CrmCustomer, CrmDeal, CrmMode } from '../../data/models/crm'
import type { CustomerInput, DealInput } from './crmRepo'
import type { ActivityDraft } from './crmModel'
import { CURRENCIES, STAGES, stageLabel } from './crmModel'

export function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`crm-field ${wide ? 'crm-field--wide' : ''}`}><span>{label}</span>{children}</label>
}
export function CustomerForm({ customer, mode, zh, busy, onSave, onCancel }: { customer?: CrmCustomer; mode: CrmMode; zh: boolean; busy: boolean; onSave: (data: CustomerInput) => void; onCancel: () => void }) {
  const t = (cn: string, en: string) => zh ? cn : en
  const [value, setValue] = useState<CustomerInput>(customer ?? { mode, name: '', email: '', phone: '', source: '', industry: '', needs: '', owner: '', tags: [], contacts: [], doNotContact: false })
  const set = <K extends keyof CustomerInput>(key: K, next: CustomerInput[K]) => setValue(v => ({ ...v, [key]: next }))
  return <form className="crm-editor" onSubmit={e => { e.preventDefault(); onSave(value) }}>
    <div className="crm-section-head"><h2>{customer ? t('编辑客户', 'Edit customer') : t('新建客户', 'New customer')}</h2><button type="button" onClick={onCancel} disabled={busy}>{t('取消', 'Cancel')}</button></div>
    <p className="crm-muted">{t('只填名称就能开始，其他资料可以稍后补充。', 'A name is enough to start. Add the details whenever you need them.')}</p>
    <div className="crm-form-grid">
      <Field label={mode === 'b2b' ? t('公司名称 *', 'Company name *') : t('客户姓名 *', 'Customer name *')} wide><input autoFocus required maxLength={160} value={value.name} onChange={e => set('name', e.target.value)} /></Field>
      <Field label={t('电子邮箱', 'Email')}><input type="email" value={value.email} onChange={e => set('email', e.target.value)} /></Field>
      <Field label={t('联系电话', 'Phone')}><input type="tel" value={value.phone} onChange={e => set('phone', e.target.value)} /></Field>
      <Field label={t('客户来源', 'Source')}><input placeholder={t('转介绍、官网、展会…', 'Referral, website, event…')} value={value.source} onChange={e => set('source', e.target.value)} /></Field>
      <Field label={t('负责人', 'Owner')}><input placeholder={t('负责人姓名', 'Owner name')} value={value.owner} onChange={e => set('owner', e.target.value)} /></Field>
      {mode === 'b2b' && <Field label={t('行业', 'Industry')}><input value={value.industry} onChange={e => set('industry', e.target.value)} /></Field>}
      <Field label={t('标签（用逗号分隔）', 'Tags (comma separated)')}><input value={value.tags.join(',')} onChange={e => set('tags', e.target.value.split(/[,，]/))} /></Field>
      <Field label={mode === 'b2b' ? t('业务需求与决策背景', 'Business needs & decision context') : t('需求与偏好', 'Needs & preferences')} wide><textarea rows={3} maxLength={10000} value={value.needs} onChange={e => set('needs', e.target.value)} /></Field>
    </div>
    {mode === 'b2b' && <section className="crm-form-section"><div className="crm-section-head"><h3>{t('联系人', 'Contacts')}</h3><button type="button" onClick={() => set('contacts', [...value.contacts, { id: crypto.randomUUID(), name: '', role: '', email: '', phone: '' }])}><Plus size={14} />{t('添加联系人', 'Add contact')}</button></div>
      {value.contacts.map((contact, index) => <div className="crm-contact-editor" key={contact.id}><div className="crm-form-grid">{(['name', 'role', 'email', 'phone'] as const).map(key => <Field key={key} label={{ name: t('联系人姓名', 'Contact name'), role: t('职位 / 决策角色', 'Title / buying role'), email: t('联系人邮箱', 'Contact email'), phone: t('联系人电话', 'Contact phone') }[key]}><input required={key === 'name' && Object.entries(contact).some(([k, v]) => k !== 'id' && v.trim())} type={key === 'email' ? 'email' : 'text'} value={contact[key]} onChange={e => set('contacts', value.contacts.map((c, i) => i === index ? { ...c, [key]: e.target.value } : c))} /></Field>)}</div><button type="button" aria-label={t('移除此联系人', 'Remove this contact')} onClick={() => set('contacts', value.contacts.filter(c => c.id !== contact.id))}><X size={16} /></button></div>)}
    </section>}
    <label className="crm-check"><input type="checkbox" checked={value.doNotContact} onChange={e => set('doNotContact', e.target.checked)} />{t('客户要求停止联系（保留历史，暂停新跟进）', 'Do not contact (keep history; pause new follow-ups)')}</label>
    <div className="crm-form-actions"><button className="crm-primary" disabled={busy} type="submit">{busy ? t('正在保存…', 'Saving…') : t('保存客户', 'Save customer')}</button></div>
  </form>
}

export function DealForm({ deal, customer, zh, busy, onSave, onCancel }: { deal?: CrmDeal; customer: CrmCustomer; zh: boolean; busy: boolean; onSave: (data: DealInput) => void; onCancel: () => void }) {
  const t = (cn: string, en: string) => zh ? cn : en
  const [value, setValue] = useState<DealInput>(deal ?? { customerId: customer.id, title: '', stage: 'new', amount: 0, currency: zh ? 'CNY' : 'USD', expectedCloseDate: '', lossReason: '' })
  return <form className="crm-editor" onSubmit={e => { e.preventDefault(); onSave(value) }}><div className="crm-section-head"><h2>{deal ? t('编辑商机', 'Edit opportunity') : customer.mode === 'b2b' ? t('新建商机', 'New opportunity') : t('新建购买机会', 'New purchase opportunity')}</h2><button type="button" onClick={onCancel} disabled={busy}>{t('取消', 'Cancel')}</button></div>
    <p className="crm-muted">{customer.name}</p><div className="crm-form-grid">
      <Field label={t('名称 *', 'Name *')} wide><input required autoFocus maxLength={200} value={value.title} onChange={e => setValue({ ...value, title: e.target.value })} /></Field>
      <Field label={t('金额', 'Amount')}><input required type="number" min="0" step="0.01" value={value.amount} onChange={e => setValue({ ...value, amount: Number(e.target.value) })} /></Field>
      <Field label={t('币种', 'Currency')}><select value={value.currency} onChange={e => setValue({ ...value, currency: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label={t('阶段', 'Stage')}><select value={value.stage} onChange={e => setValue({ ...value, stage: e.target.value as CrmDeal['stage'] })}>{STAGES.map(stage => <option key={stage} value={stage}>{stageLabel(stage, customer.mode, zh)}</option>)}</select></Field>
      <Field label={t('预计成交日期', 'Expected close date')}><input type="date" value={value.expectedCloseDate} onChange={e => setValue({ ...value, expectedCloseDate: e.target.value })} /></Field>
      {value.stage === 'lost' && <Field label={t('未成交原因 *', 'Loss reason *')} wide><textarea required rows={3} value={value.lossReason} onChange={e => setValue({ ...value, lossReason: e.target.value })} /></Field>}
    </div><div className="crm-form-actions"><button className="crm-primary" disabled={busy}>{busy ? t('正在保存…', 'Saving…') : t('保存商机', 'Save opportunity')}</button></div>
  </form>
}



export function ActivityComposer({ zh, busy, stopped, draft, onChange, onSave }: { zh: boolean; busy: boolean; stopped: boolean; draft: ActivityDraft; onChange: (value: ActivityDraft) => void; onSave: (event: FormEvent) => void }) {
  const t = (cn: string, en: string) => zh ? cn : en
  return <form className="crm-composer" onSubmit={onSave}>
    <div className="crm-section-head"><h3><MessageSquare size={16} />{t('记录这次沟通', 'Log a conversation')}</h3></div>
    <div className="crm-activity-types" role="group" aria-label={t('沟通方式', 'Activity type')}>{(['call', 'email', 'meeting', 'note'] as const).map(kind => { const Icon = { call: Phone, email: Mail, meeting: Users, note: MessageSquare }[kind]; return <button type="button" key={kind} aria-pressed={draft.kind === kind} onClick={() => onChange({ ...draft, kind })}><Icon size={14} />{{ call: t('电话', 'Call'), email: t('邮件', 'Email'), meeting: t('会议', 'Meeting'), note: t('备注', 'Note') }[kind]}</button> })}</div>
    <textarea aria-label={t('沟通记录', 'Conversation notes')} placeholder={t('谈了什么？客户有什么反馈？', 'What did you discuss? What did the customer say?')} rows={3} maxLength={10000} value={draft.body} onChange={e => onChange({ ...draft, body: e.target.value })} />
    {!stopped && <><label className="crm-next-input"><span><ArrowRight size={14} />{t('下一步', 'Next step')}</span><input aria-label={t('下一步跟进', 'Next follow-up')} placeholder={t('例如：发送报价方案', 'e.g. Send a proposal')} maxLength={200} value={draft.nextAction} onChange={e => onChange({ ...draft, nextAction: e.target.value })} /></label>
      {draft.nextAction.trim() && <div className="crm-form-grid"><Field label={t('跟进日期 *', 'Follow-up date *')}><input type="date" required value={draft.dueDate} onChange={e => onChange({ ...draft, dueDate: e.target.value })} /></Field><Field label={t('提醒时间（可选）', 'Reminder time (optional)')}><input type="time" value={draft.reminderTime} onChange={e => onChange({ ...draft, reminderTime: e.target.value })} /></Field></div>}</>}
    <div className="crm-composer-footer"><span><CalendarDays size={13} />{draft.nextAction.trim() && !stopped ? t('保存后进入任务与日历', 'Also appears in Tasks & Calendar') : t('保留在客户沟通时间线', 'Saved to this customer’s history')}</span><button className="crm-primary" disabled={busy || (!draft.body.trim() && (!draft.nextAction.trim() || stopped))}>{busy ? t('正在保存…', 'Saving…') : draft.nextAction.trim() && !stopped ? t('记录并安排跟进', 'Log & schedule') : t('保存记录', 'Save activity')}</button></div>
  </form>
}
