import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { liveQuery } from 'dexie'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, Archive, Building2, CalendarDays, Check, ChevronDown, ChevronRight, ChevronUp, CircleCheck, Clock3, ContactRound, Download, FileText, History, LayoutGrid, ListFilter, Mail, MessageSquare, Phone, Play, Plus, RotateCcw, Search, TrendingUp, Users, X } from 'lucide-react'
import { getAuth } from '../../store/auth'
import { db } from '../../data/db'
import type { CrmActivity, CrmCustomer, CrmDeal, CrmMode, CrmStage } from '../../data/models/crm'
import type { FocusSession, NoteItem, TaskItem } from '../../data/models/types'
import { useI18n } from '../../shared/i18n/useI18n'
import { useLabs } from '../labs/LabsContext'
import { ROUTES, buildTaskDetailRoute } from '../../app/routes/routes'
import { buildNoteRouteWithReturn, withReturnPath } from '../../shared/navigation/returnPath'
import { setFocusTaskId } from '../focus/focusTask'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
import { ActivityComposer, CustomerForm, DealForm } from './CrmForms'
import { crmRepo, CrmError } from './crmRepo'
import { freshDraft, type ActivityDraft, CSV_HEADERS, STAGES, customerRoute, dayKey, exportCustomers, isOpenDeal, isOpenTask, matchesCustomer, stageLabel, totalsByCurrency } from './crmModel'
import { CustomerAvatar, StageChip } from './CrmVisuals'
import './crm.css'

type Data = { customers: CrmCustomer[]; deals: CrmDeal[]; activities: CrmActivity[]; tasks: TaskItem[]; notes: NoteItem[]; sessions: FocusSession[] }
type View = 'today' | 'customers' | 'pipeline'
type Filter = 'all' | 'due' | 'unplanned' | 'archived'
type Editor = { kind: 'customer'; customer?: CrmCustomer } | { kind: 'deal'; deal?: CrmDeal }
const EMPTY: Data = { customers: [], deals: [], activities: [], tasks: [], notes: [], sessions: [] }
const errorMessages: Record<string, [string, string]> = {
  contactNameRequired: ['请为填写了资料的联系人补充姓名。', 'Enter a name for each contact with details.'],
  nameRequired: ['请填写客户名称。', 'Enter a customer name.'], invalidEmail: ['请检查电子邮箱格式。', 'Check the email address.'], duplicate: ['已存在相同公司、邮箱或电话的客户，请打开已有记录。', 'A matching company, email or phone already exists. Open the existing record.'], notFound: ['记录已归档或不可用，请重新选择。', 'This record is archived or unavailable. Select it again.'], invalidDeal: ['请检查商机名称、金额和币种。', 'Check the opportunity name, amount and currency.'], lossReasonRequired: ['请填写未成交原因，以便以后复盘。', 'Enter a loss reason for future reviews.'], activityRequired: ['请填写沟通记录或下一步。', 'Enter a note or a next step.'], dateRequired: ['请设置跟进日期。', 'Set a follow-up date.'], invalidDate: ['请使用有效日期。', 'Use a valid date.'], futureReminder: ['提醒时间需要晚于现在。', 'The reminder must be in the future.'], doNotContact: ['该客户已暂停联系，请先更新联系偏好。', 'This customer has requested no contact. Update their preference first.'], invalidCsv: ['CSV 格式不完整，请检查引号与分隔符。', 'Invalid CSV. Check quotes and separators.'], csvHeaders: ['请使用模板列名，至少保留 mode、name 两列。', 'Use the template headers, including mode and name.'], importTooLarge: ['单次最多导入 5,000 行、2 MB。', 'Import up to 5,000 rows and 2 MB at a time.'], invalidData: ['请检查输入内容。', 'Check the entered values.'],
}
function download(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export default function CrmPage() {
  const { ready, catalog } = useLabs()
  if (!ready) return <BrandLoader variant="inline" />
  if (!catalog.some(f => f.featureKey === 'crm' && f.state === 'installed')) return <Navigate to={ROUTES.LABS} replace />
  return <CrmWorkspace />
}
export function CrmWorkspace() {
  const { language } = useI18n(); const zh = language === 'zh'; const t = (cn: string, en: string) => zh ? cn : en
  const navigate = useNavigate(); const [params, setParams] = useSearchParams()
  const selectedId = params.get('customer') ?? ''
  const [data, setData] = useState<Data>(EMPTY); const [loading, setLoading] = useState(true); const [retry, setRetry] = useState(0)
  const mode: CrmMode = data.customers.find(c => c.id === selectedId)?.mode ?? (params.get('mode') === 'b2c' ? 'b2c' : 'b2b')
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('focusgo:crm-header-collapsed')
      if (saved !== null) return saved === 'true'
    } catch { /* The header remains usable without browser storage. */ }
    return window.matchMedia('(max-width: 700px), (max-height: 700px)').matches
  })
  const toggleHeader = () => setHeaderCollapsed(collapsed => {
    try { localStorage.setItem('focusgo:crm-header-collapsed', String(!collapsed)) } catch { /* Optional layout preference. */ }
    return !collapsed
  })
  const [rowLimit, setRowLimit] = useState(100)
  const [view, setView] = useState<View>('today'); const [filter, setFilter] = useState<Filter>('all'); const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null); const [busy, setBusy] = useState(false); const lock = useRef(false)
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [duplicateId, setDuplicateId] = useState<string>()
  const [checked, setChecked] = useState<string[]>([]); const [undoIds, setUndoIds] = useState<string[]>([])
  const draftKey = `focusgo:crm-drafts:${getAuth()?.user?.id || 'guest'}`
  const [drafts, setDrafts] = useState<Record<string, ActivityDraft>>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || '{}') as Record<string, ActivityDraft>
      return Object.fromEntries(Object.entries(value).filter(([, d]) => d && typeof d.body === 'string' && typeof d.nextAction === 'string' && typeof d.dueDate === 'string' && typeof d.requestId === 'string' && typeof d.reminderTime === 'string' && ['call', 'email', 'meeting', 'note'].includes(d.kind)))
    } catch { return {} }
  }); const [noteRequests, setNoteRequests] = useState<Record<string, string>>({})
  const [importOpen, setImportOpen] = useState(false); const [importFile, setImportFile] = useState<{ name: string; text: string } | null>(null)
  const [today, setToday] = useState(dayKey())
  useEffect(() => { try { sessionStorage.setItem(draftKey, JSON.stringify(drafts)) } catch { /* The visible draft remains usable if session storage is full. */ } }, [draftKey, drafts])
  const detailRef = useRef<HTMLElement>(null)
  useEffect(() => { const timer = setInterval(() => setToday(dayKey()), 60_000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const [customers, deals, activities, tasks, notes, sessions] = await Promise.all([db.crmCustomers.toArray(), db.crmDeals.toArray(), db.crmActivities.toArray(), db.tasks.toArray(), db.notes.toArray(), db.focusSessions.toArray()])
      return { customers, deals, activities, tasks, notes, sessions }
    }).subscribe({ next: value => { setData(value); setLoading(false) }, error: () => { setError(t('客户数据读取失败，请重试。', 'Could not load customer data. Please retry.')); setLoading(false) } })
    return () => subscription.unsubscribe()
  // The query itself is locale-independent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry])
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setMessage(''); setDuplicateId(undefined)
    try { await action() } catch (cause) {
      const code = cause instanceof CrmError ? cause.code : ''
      setError(code.startsWith('csvRow:') ? t(`CSV 第 ${code.split(':')[1]} 行无效，尚未导入任何客户。`, `Invalid CSV row ${code.split(':')[1]}. No customers were imported.`) : errorMessages[code]?.[zh ? 0 : 1] ?? t('保存未完成，请重试。输入内容仍保留。', 'Could not save. Your input is still here; please retry.'))
      if (cause instanceof CrmError) setDuplicateId(cause.existingId)
    } finally { lock.current = false; setBusy(false) }
  }
  const selectCustomer = (c: CrmCustomer) => {
    setParams({ mode: c.mode, customer: c.id }); setEditor(null); setError(''); setDuplicateId(undefined)
    setDrafts(all => all[c.id] ? all : { ...all, [c.id]: freshDraft() })
    requestAnimationFrame(() => {
      const pane = detailRef.current
      if (!pane) return
      pane.focus({ preventScroll: true })
      if (window.matchMedia('(min-width: 701px)').matches) pane.scrollTop = 0
      else pane.scrollIntoView({ block: 'start' })
    })
  }
  const jumpToSection = (id: string) => {
    const target = document.getElementById(`crm-${id}`)
    const pane = detailRef.current
    if (!target || !pane) return
    target.focus({ preventScroll: true })
    if (window.matchMedia('(min-width: 701px)').matches) {
      // DOM rectangles include the shell zoom; scrollTop uses unscaled CSS pixels.
      const scale = pane.getBoundingClientRect().height / pane.offsetHeight || 1
      const top = pane.scrollTop + (target.getBoundingClientRect().top - pane.getBoundingClientRect().top) / scale - pane.clientTop - 16
      pane.scrollTo({ top, behavior: 'instant' })
    } else target.scrollIntoView({ block: 'start' })
  }
  const current = data.customers.find(c => c.id === selectedId)
  const selected = current?.mode === mode ? current : undefined
  const allCustomers = data.customers.filter(c => c.mode === mode)
  const active = allCustomers.filter(c => !c.archivedAt)
  const taskIndex = useMemo(() => {
    const openTasks = new Map(data.tasks.filter(isOpenTask).map(task => [task.id, task]))
    const grouped = new Map<string, Map<string, TaskItem>>()
    for (const activity of data.activities) {
      const task = activity.taskId ? openTasks.get(activity.taskId) : undefined
      if (!task) continue
      const group = grouped.get(activity.customerId) ?? new Map<string, TaskItem>()
      group.set(task.id, task); grouped.set(activity.customerId, group)
    }
    return new Map([...grouped].map(([id, tasks]) => [id, [...tasks.values()].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.createdAt - b.createdAt)]))
  }, [data.activities, data.tasks])
  const tasksFor = (id: string) => taskIndex.get(id) ?? []
  const due = active.filter(c => tasksFor(c.id).some(task => task.dueDate && task.dueDate <= today))
  const unplanned = active.filter(c => !c.doNotContact && !tasksFor(c.id).length)
  const dueIds = new Set(due.map(c => c.id)); const unplannedIds = new Set(unplanned.map(c => c.id))
  const filtered = allCustomers.filter(c => (filter === 'archived' ? !!c.archivedAt : !c.archivedAt) && matchesCustomer(c, query) && (view !== 'today' || filter !== 'all' || dueIds.has(c.id) || unplannedIds.has(c.id)) && (filter !== 'due' || dueIds.has(c.id)) && (filter !== 'unplanned' || unplannedIds.has(c.id))).sort((a, b) => {
    const aDue = tasksFor(a.id)[0]?.dueDate || '9999'; const bDue = tasksFor(b.id)[0]?.dueDate || '9999'
    return aDue.localeCompare(bDue) || b.updatedAt - a.updatedAt
  })
  const todayComplete = view === 'today' && filter === 'all' && !query && active.length > 0 && !filtered.length
  const visibleIds = new Set(filtered.map(c => c.id))
  const activeIds = new Set(active.map(c => c.id))
  const modeIds = new Set(allCustomers.map(c => c.id))
  const lifetimeWon = data.deals.filter(d => modeIds.has(d.customerId) && d.stage === 'won')
  const deals = data.deals.filter(d => activeIds.has(d.customerId))
  const selectedDeals = data.deals.filter(d => d.customerId === selected?.id).sort((a, b) => b.createdAt - a.createdAt)
  const activities = data.activities.filter(a => a.customerId === selected?.id).sort((a, b) => b.occurredAt - a.occurredAt)
  const selectedTaskIds = new Set(activities.map(a => a.taskId).filter(Boolean))
  const focusMinutes = data.sessions.filter(s => s.taskId && selectedTaskIds.has(s.taskId) && s.status === 'completed').reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
  const draft = selected ? drafts[selected.id] ?? freshDraft() : null
  const money = (amount: number, currency: string) => new Intl.NumberFormat(zh ? 'zh-CN' : 'en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  const totals = (list: CrmDeal[]) => Object.entries(totalsByCurrency(list)).map(([currency, amount]) => money(amount, currency)).join(' · ') || '—'
  const activityLabel = (kind: CrmActivity['kind']) => ({ call: t('电话', 'Call'), email: t('邮件', 'Email'), meeting: t('会议', 'Meeting'), note: t('备注', 'Note'), followup: t('安排跟进', 'Follow-up'), stage: t('阶段变更', 'Stage change') }[kind])
  const saveActivity = (event: FormEvent) => {
    event.preventDefault(); if (!selected || !draft) return
    void run(async () => {
      await crmRepo.logActivity({ customerId: selected.id, ...draft, nextAction: selected.doNotContact ? '' : draft.nextAction, reminderAt: !selected.doNotContact && draft.nextAction.trim() && draft.reminderTime ? new Date(`${draft.dueDate}T${draft.reminderTime}`).getTime() : undefined })
      setDrafts(all => ({ ...all, [selected.id]: freshDraft() })); setMessage(draft.nextAction.trim() && !selected.doNotContact ? t('已记录沟通，并安排下一步跟进。', 'Conversation logged and next step scheduled.') : t('沟通记录已保存。', 'Conversation saved.'))
    })
  }
  const archive = (ids: string[], archived: boolean) => run(async () => {
    await crmRepo.archive(ids, archived); setUndoIds(archived ? ids : []); setChecked([])
    setMessage(archived ? t('已归档。关联任务与笔记仍保留。', 'Archived. Linked tasks and notes are retained.') : t('已恢复客户。', 'Customer restored.'))
  })
  if (loading) return <BrandLoader variant="inline" />
  return <div className={`module-page-shell crm-page ${headerCollapsed ? 'is-header-collapsed' : ''}`}>
    <div className="crm-topbar">
    <header className="crm-header">
      <div className="crm-heading-group"><ContactRound size={21} strokeWidth={1.6} aria-hidden="true" /><h1 className="type-page-title">{t('客户管理', 'Customers')}</h1></div>
      <div className="crm-header-actions"><div className="crm-segmented" aria-label={t('客户模式', 'Customer mode')}>{(['b2b', 'b2c'] as const).map(m => <button key={m} disabled={!!editor || busy} aria-pressed={mode === m} onClick={() => { setParams({ mode: m }); setChecked([]); setFilter('all'); setQuery('') }}>{m === 'b2b' ? <Building2 size={15} /> : <Users size={15} />}{m === 'b2b' ? t('toB 企业', 'B2B · Companies') : t('toC 个人', 'B2C · People')}</button>)}</div><button className="crm-primary" disabled={!!editor || busy} onClick={() => setEditor({ kind: 'customer' })}><Plus size={16} />{t('新建客户', 'New customer')}</button><button className="crm-collapse-header" aria-expanded={!headerCollapsed} aria-controls="crm-overview" onClick={toggleHeader}>{headerCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}{headerCollapsed ? t('展开概览', 'Show overview') : t('收起概览', 'Hide overview')}</button></div>
    </header>
    <div className="crm-summary" id="crm-overview" hidden={headerCollapsed}>
      <div className="crm-agenda-summary"><span className="crm-summary-caption"><CalendarDays size={15} />{t('今日行动', 'TODAY’S AGENDA')}</span><div>
        <button disabled={!!editor} onClick={() => { setFilter('due'); setView('today'); setParams({ mode }) }}><strong>{due.length}</strong><span>{t('到期需跟进', 'Due to follow up')}<ArrowUpRight size={13} /></span></button>
        <button disabled={!!editor} onClick={() => { setFilter('unplanned'); setView('today'); setParams({ mode }) }}><strong>{unplanned.length}</strong><span>{t('待安排下一步', 'No next step')}<ArrowUpRight size={13} /></span></button>
      </div></div>
      <div className="crm-sales-summary"><span className="crm-summary-caption"><TrendingUp size={15} />{mode === 'b2b' ? t('进行中商机', 'OPEN OPPORTUNITIES') : t('进行中购买意向', 'OPEN PURCHASES')}</span><div><strong>{deals.filter(isOpenDeal).length}</strong><span>{totals(deals.filter(isOpenDeal))}</span></div></div>
      <div className="crm-won-summary"><span className="crm-summary-caption"><CircleCheck size={15} />{mode === 'b2b' ? t('已赢单 · 累计', 'WON · ALL TIME') : t('已成交 · 累计', 'PURCHASED · ALL TIME')}</span><div><strong className="crm-summary-money">{totals(lifetimeWon)}</strong></div></div>
    </div>
    <nav className="crm-view-nav" aria-label={t('客户工作台视图', 'CRM views')}>{(['today', 'customers', 'pipeline'] as const).map(v => { const Icon = { today: CalendarDays, customers: Users, pipeline: LayoutGrid }[v]; return <button key={v} disabled={!!editor} aria-current={view === v ? 'page' : undefined} onClick={() => { setView(v); setChecked([]); setFilter('all'); setParams({ mode }) }}><Icon size={16} />{({ today: t('今日跟进', 'Follow-ups'), customers: t('全部客户', 'Customers'), pipeline: t('销售看板', 'Pipeline') })[v]}<span>{v === 'today' ? due.length + unplanned.length : v === 'customers' ? active.length : deals.length}</span></button> })}<div className="crm-nav-end"><button onClick={() => setImportOpen(v => !v)}><Download size={14} />{t('导入 / 导出', 'Import / export')}</button></div></nav>
    <div className="crm-feedback" aria-live="polite">{message && <span role="status"><Check size={15} />{message}{undoIds.length > 0 && <button disabled={busy} onClick={() => void archive(undoIds, false)}>{t('撤销归档', 'Undo archive')}</button>}</span>}{error && <span role="alert" className="crm-error">{error}{duplicateId && <button onClick={() => { const c = data.customers.find(c => c.id === duplicateId); if (c) selectCustomer(c) }}>{t('打开已有客户', 'Open existing customer')}</button>}<button onClick={() => { setRetry(n => n + 1); setError('') }}>{t('重试读取', 'Reload')}</button></span>}</div>
    {importOpen && <section className="crm-import"><div className="crm-section-head"><h2>{t('客户数据', 'Customer data')}</h2><button onClick={() => setImportOpen(false)} aria-label={t('关闭导入导出', 'Close import/export')}><X size={16} /></button></div><p>{t('CSV 导入只新增客户，重复记录会跳过。导出包含当前模式所有客户（含归档），完整备份请使用设置中的数据备份。', 'CSV imports add new customers and skip duplicates. Export includes this mode’s archived customers. Use Settings for a complete backup.')}</p><div className="crm-import-actions"><button onClick={() => download('\uFEFF' + CSV_HEADERS.join(',') + '\r\n', 'crm-template.csv')}>{t('下载 CSV 模板', 'Download CSV template')}</button><button onClick={() => download(exportCustomers(allCustomers), `crm-${mode}-${today}.csv`)}>{t('导出此模式客户', 'Export this mode')}</button><label className="crm-file-button">{t('选择 CSV', 'Choose CSV')}<input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 2_000_000) throw new CrmError('importTooLarge'); setImportFile({ name: file.name, text: await file.text() }) }); e.target.value = '' }} /></label>{importFile && <><span>{importFile.name}</span><button disabled={busy} onClick={() => void run(async () => { const result = await crmRepo.importCustomers(importFile.text); setMessage(t(`已导入 ${result.added} 位客户，跳过 ${result.skipped} 条重复记录。`, `Imported ${result.added}; skipped ${result.skipped} duplicates.`)); setImportFile(null) })}>{t('确认导入', 'Import customers')}</button></>}</div></section>}
    </div>
    <div className={`crm-workspace ${selected || editor ? 'has-detail' : ''} ${view === 'pipeline' ? 'is-pipeline' : ''}`}>
      <section className="crm-list-pane" aria-label={t('客户列表', 'Customer list')}>
        <div className="crm-list-toolbar"><label className="crm-search"><Search size={16} /><input aria-label={t('搜索客户', 'Search customers')} placeholder={t('搜索名称、联系人、需求…', 'Search names, contacts, needs…')} value={query} onChange={e => { setQuery(e.target.value); setChecked([]) }} /></label><label className="crm-filter"><ListFilter size={15} /><select aria-label={t('筛选客户', 'Filter customers')} value={filter} onChange={e => { setFilter(e.target.value as Filter); setChecked([]) }}>{Object.entries({ all: t('全部客户', 'All customers'), due: t('到期跟进', 'Due follow-ups'), unplanned: t('未安排下一步', 'No next step'), archived: t('已归档', 'Archived') }).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label></div>
        {checked.length > 0 && <div className="crm-bulk"><span>{t(`已选 ${checked.length} 位`, `${checked.length} selected`)}</span><button disabled={busy || !!editor} onClick={() => void archive(checked, filter !== 'archived')}>{filter === 'archived' ? t('恢复所选', 'Restore selected') : t('归档所选', 'Archive selected')}</button><button onClick={() => setChecked([])}>{t('取消选择', 'Clear')}</button></div>}
        {view === 'pipeline' ? <div className="crm-pipeline">{STAGES.map(stage => {
          const stageDeals = data.deals.filter(d => d.stage === stage && visibleIds.has(d.customerId))
          return <section className="crm-stage" data-stage={stage} key={stage}><header><h3><StageChip stage={stage}>{stageLabel(stage, mode, zh)}</StageChip></h3><span>{stageDeals.length}</span></header><p>{totals(stageDeals)}</p>{stageDeals.map(deal => { const c = data.customers.find(c => c.id === deal.customerId)!; return <button className="crm-deal-card" key={deal.id} disabled={!!editor} onClick={() => selectCustomer(c)}><span className="crm-deal-customer"><CustomerAvatar name={c.name} />{c.name}</span><strong>{deal.title}</strong><b>{money(deal.amount, deal.currency)}</b><small><CalendarDays size={12} />{deal.expectedCloseDate || t('未设成交日期', 'No close date')}</small></button> })}{stageDeals.length === 0 && <div className="crm-stage-empty">{t('机会会在这里汇集', 'Opportunities land here')}</div>}</section>
        })}</div> : <><div className="crm-list-caption"><span>{view === 'today' ? t('先看需要你推进的关系', 'Start with the relationships that need you') : t('客户及下一步', 'Customers & next steps')}</span><span>{filtered.length}</span></div>{filtered.slice(0, rowLimit).map(c => {
          const next = tasksFor(c.id)[0]; const overdue = next?.dueDate && next.dueDate < today
          const customerDeals = data.deals.filter(d => d.customerId === c.id).sort((a, b) => b.updatedAt - a.updatedAt); const wonCount = customerDeals.filter(d => d.stage === 'won').length
          const currentDeal = customerDeals.find(isOpenDeal) ?? customerDeals[0]
          return <div className={`crm-customer-row ${selected?.id === c.id ? 'is-selected' : ''}`} key={c.id}>
            <input type="checkbox" aria-label={`${t('选择', 'Select')} ${c.name}`} checked={checked.includes(c.id)} onChange={e => setChecked(ids => e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id))} />
            <button className="crm-customer-select" disabled={!!editor} aria-pressed={selected?.id === c.id} onClick={() => selectCustomer(c)}><CustomerAvatar name={c.name} /><span className="crm-row-main"><strong>{c.name}</strong><span>{c.mode === 'b2b' ? c.contacts[0]?.name || c.industry || t('企业客户', 'Company') : wonCount > 1 ? t(`已购买 ${wonCount} 次`, `${wonCount} purchases`) : c.source || t('个人客户', 'Individual')}{c.owner && ` · ${c.owner}`}</span><small className={overdue ? 'crm-overdue' : ''}><Clock3 size={12} />{c.archivedAt ? t('已归档', 'Archived') : c.doNotContact ? t('已暂停联系', 'Do not contact') : next ? `${next.dueDate || t('未排期', 'Unscheduled')} · ${next.title.replace(`${c.name} · `, '')}` : t('待安排下一步', 'Plan the next step')}</small>{currentDeal && <span className="crm-row-stage"><StageChip stage={currentDeal.stage}>{stageLabel(currentDeal.stage, mode, zh)}</StageChip></span>}</span><ChevronRight className="crm-row-chevron" size={16} /></button>
          </div>
        })}{filtered.length > rowLimit && <button className="crm-load-more" onClick={() => setRowLimit(n => n + 100)}>{t(`继续显示 · 还有 ${filtered.length - rowLimit} 位客户`, `Show more · ${filtered.length - rowLimit} remaining`)}</button>}{filtered.length > 0 && <button className="crm-list-add" disabled={!!editor || busy} onClick={() => setEditor({ kind: 'customer' })}><Plus size={15} />{t('添加客户', 'Add customer')}</button>}{filtered.length === 0 && <div className="crm-empty"><Users size={28} strokeWidth={1.3} /><h2>{active.length === 0 && filter === 'all' && !query ? t('从一位客户开始', 'Start with one customer') : todayComplete ? t('今天的跟进已安排妥当', 'You’re all set for today') : t('没有符合条件的客户', 'No matching customers')}</h2><p>{active.length === 0 && filter === 'all' && !query ? t('记录需求、安排跟进，让每段关系都有下一步。', 'Capture their needs and give each relationship a next step.') : todayComplete ? t('查看全部客户，继续经营每一段关系。', 'Visit all customers to keep your relationships moving.') : t('试试其他关键词或筛选条件。', 'Try another search or filter.')}</p><button disabled={!!editor} onClick={() => active.length === 0 && filter === 'all' && !query ? setEditor({ kind: 'customer' }) : (setQuery(''), setFilter('all'), todayComplete && setView('customers'))}>{active.length === 0 && filter === 'all' && !query ? t('添加第一位客户', 'Add your first customer') : todayComplete ? t('查看全部客户', 'View all customers') : t('清除筛选', 'Clear filters')}</button></div>}</>}
      </section>
      <section className="crm-detail" ref={detailRef} tabIndex={-1} aria-label={t('客户工作台', 'Customer workspace')}>
        {editor?.kind === 'customer' ? <CustomerForm key={editor.customer?.id ?? mode} mode={mode} customer={editor.customer} zh={zh} busy={busy} onCancel={() => setEditor(null)} onSave={value => void run(async () => { const c = await crmRepo.saveCustomer(value, editor.customer?.id); selectCustomer(c); setMessage(t('客户已保存。', 'Customer saved.')) })} /> : editor?.kind === 'deal' && selected ? <DealForm key={editor.deal?.id ?? 'new'} deal={editor.deal} customer={selected} zh={zh} busy={busy} onCancel={() => setEditor(null)} onSave={value => void run(async () => { await crmRepo.saveDeal(value, editor.deal?.id); setEditor(null); setMessage(t('商机已保存。', 'Opportunity saved.')) })} /> : selected ? <>
          <header className="crm-detail-header"><button className="crm-back" onClick={() => setParams({ mode })}><ArrowLeft size={15} />{view === 'pipeline' ? t('返回看板', 'Back to pipeline') : t('客户列表', 'Customer list')}</button>
            <div className="crm-detail-title"><CustomerAvatar name={selected.name} large /><div className="crm-detail-name"><span className="crm-eyebrow">{selected.mode === 'b2b' ? t('企业客户', 'COMPANY') : t('个人客户', 'PERSON')}{selected.archivedAt && ` · ${t('已归档', 'ARCHIVED')}`}</span><h2>{selected.name}</h2></div><button disabled={busy} onClick={() => setEditor({ kind: 'customer', customer: selected })}>{t('编辑资料', 'Edit details')}</button><button className="crm-close-detail" aria-label={t('关闭客户详情', 'Close customer details')} onClick={() => setParams({ mode })}><X size={17} /></button></div>
            <div className="crm-contact-links">{selected.email && <a href={`mailto:${selected.email}`}><Mail size={14} />{selected.email}</a>}{selected.phone && <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} />{selected.phone}</a>}</div><div className="crm-tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}{selected.doNotContact && <span className="crm-paused">{t('暂停联系', 'Do not contact')}</span>}</div>
          </header>
          <nav className="crm-detail-jumps" aria-label={t('客户详情导航', 'Customer sections')}>{[{ id: 'followups', icon: MessageSquare, label: t('跟进沟通', 'Activity') }, { id: 'opportunities', icon: TrendingUp, label: mode === 'b2b' ? t('商机', 'Opportunities') : t('购买', 'Purchases') }, { id: 'notes', icon: FileText, label: t('笔记', 'Notes') }, { id: 'profile', icon: ContactRound, label: t('客户资料', 'Profile') }, { id: 'history', icon: History, label: t('时间线', 'History') }].map(({ id, icon: Icon, label }) => <button key={id} onClick={() => jumpToSection(id)}><Icon size={14} />{label}</button>)}</nav>
          <div className="crm-detail-body">
            <section className="crm-followups" id="crm-followups" tabIndex={-1}><div className="crm-section-head"><h3><CalendarDays size={16} />{t('下一步跟进', 'Next steps')}<span className="crm-count">{tasksFor(selected.id).length}</span></h3><Link to={ROUTES.CALENDAR}><CalendarDays size={14} />{t('日历', 'Calendar')}<ArrowUpRight size={12} /></Link></div>{tasksFor(selected.id).map(task => <div className="crm-task-row" key={task.id}><button className="crm-task-check" disabled={busy} aria-label={`${t('完成跟进', 'Complete follow-up')} ${task.title}`} onClick={() => void run(async () => { await crmRepo.completeTask(task.id); setMessage(t('跟进已完成，任务页同步更新。', 'Follow-up completed in Tasks too.')) })}><Check size={14} /></button><Link to={withReturnPath(buildTaskDetailRoute(task.id), customerRoute(selected))}><strong>{task.title.replace(`${selected.name} · `, '')}</strong><small className={task.dueDate && task.dueDate < today ? 'crm-overdue' : ''}>{task.dueDate || t('未排期', 'Unscheduled')}{task.status === 'waiting' ? ` · ${t('等待回复', 'Waiting')}` : ''}</small></Link><button disabled={busy} aria-label={`${t('专注处理', 'Focus on')} ${task.title}`} title={t('开始专注', 'Start focus')} onClick={() => { setFocusTaskId(task.id); navigate(withReturnPath(ROUTES.FOCUS, customerRoute(selected))) }}><Play size={15} /></button></div>)}{!tasksFor(selected.id).length && <p className="crm-muted">{selected.doNotContact ? t('客户已暂停联系。', 'Contact is paused for this customer.') : t('还没有待办跟进。在下方写下下一步即可安排。', 'No open follow-up. Add the next step below.')}</p>}</section>
            {!selected.archivedAt && draft && <ActivityComposer zh={zh} busy={busy} stopped={selected.doNotContact} draft={draft} onChange={next => setDrafts(all => ({ ...all, [selected.id]: next }))} onSave={saveActivity} />}
            <section className="crm-opportunities" id="crm-opportunities" tabIndex={-1}><div className="crm-section-head"><h3><TrendingUp size={16} />{mode === 'b2b' ? t('商机', 'Opportunities') : t('购买与复购', 'Purchases & repeat business')}</h3>{!selected.archivedAt && <button onClick={() => setEditor({ kind: 'deal' })}><Plus size={14} />{mode === 'b2b' ? t('添加商机', 'Add opportunity') : t('添加购买机会', 'Add purchase')}</button>}</div>{selectedDeals.length === 0 && <p className="crm-muted">{t('有明确需求时，创建一笔商机来跟踪进展。', 'Add an opportunity when a concrete need emerges.')}</p>}{selectedDeals.map(deal => <div className="crm-deal-row" key={deal.id} data-stage={deal.stage}><div><button disabled={!!selected.archivedAt} onClick={() => setEditor({ kind: 'deal', deal })}><strong>{deal.title}</strong></button><span>{money(deal.amount, deal.currency)}{deal.expectedCloseDate && ` · ${deal.expectedCloseDate}`}</span>{deal.lossReason && <small>{deal.lossReason}</small>}</div><select data-stage={deal.stage} aria-label={`${deal.title} ${t('阶段', 'stage')}`} value={deal.stage} disabled={busy || !!selected.archivedAt} onChange={e => { const stage = e.target.value as CrmStage; if (stage === 'lost') setEditor({ kind: 'deal', deal: { ...deal, stage } }); else void run(async () => { await crmRepo.saveDeal({ ...deal, stage }, deal.id) }) }}>{STAGES.map(s => <option key={s} value={s}>{stageLabel(s, mode, zh)}</option>)}</select></div>)}</section>
            <section className="crm-notes" id="crm-notes" tabIndex={-1}><div className="crm-section-head"><h3><FileText size={16} />{t('客户笔记', 'Customer notes')}</h3>{!selected.archivedAt && <button disabled={busy} onClick={() => void run(async () => { const requestId = noteRequests[selected.id] ?? crypto.randomUUID(); setNoteRequests(all => ({ ...all, [selected.id]: requestId })); const note = await crmRepo.createNote(selected.id, `${selected.name} · ${t('客户笔记', 'Customer notes')}`, requestId); setNoteRequests(all => { const next = { ...all }; delete next[selected.id]; return next }); navigate(buildNoteRouteWithReturn(note.id, customerRoute(selected))) })}><Plus size={14} />{t('新建笔记', 'New note')}</button>}</div>{activities.filter(a => a.noteId).map(a => { const note = data.notes.find(n => n.id === a.noteId && !n.deletedAt); return note ? <Link className="crm-note-link" key={a.id} to={buildNoteRouteWithReturn(note.id, customerRoute(selected))}><FileText size={15} />{note.title || t('未命名笔记', 'Untitled note')}<ArrowUpRight size={13} /></Link> : <p className="crm-muted" key={a.id}>{t('关联笔记已移除', 'Linked note was removed')}</p> })}{!activities.some(a => a.noteId) && <p className="crm-muted">{t('方案、会议纪要与客户资料，可直接存入笔记。', 'Keep proposals and meeting minutes in Notes.')}</p>}</section>
            <section className="crm-profile" id="crm-profile" tabIndex={-1}><div className="crm-section-head"><h3><ContactRound size={16} />{t('客户资料', 'Customer profile')}</h3><button disabled={busy} onClick={() => setEditor({ kind: 'customer', customer: selected })}>{t('完善资料', 'Update details')}<ArrowUpRight size={13} /></button></div>
            {(selected.needs || selected.source || selected.owner || selected.industry) && <section className="crm-context"><div className="crm-meta-row">{selected.source && <span>{t('来源', 'Source')} · {selected.source}</span>}{selected.owner && <span>{t('负责人', 'Owner')} · {selected.owner}</span>}{selected.industry && <span>{selected.industry}</span>}</div>{selected.needs && <p>{selected.needs}</p>}</section>}
            {selected.mode === 'b2b' && selected.contacts.length > 0 && <section className="crm-contacts"><h3>{t('联系人与决策角色', 'Contacts & buying roles')}</h3>{selected.contacts.map(c => <div key={c.id}><strong>{c.name}</strong><span>{c.role}</span>{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}{c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>}</div>)}</section>}
            {!(selected.needs || selected.source || selected.owner || selected.industry || selected.contacts.length) && <p className="crm-muted">{t('了解需求、记下偏好，下次沟通就从这里接上。', 'Keep needs and preferences here for your next conversation.')}</p>}</section>
            <section className="crm-history" id="crm-history" tabIndex={-1}><div className="crm-section-head"><h3><History size={16} />{t('沟通时间线', 'Activity history')}</h3><span>{focusMinutes > 0 ? t(`已投入 ${focusMinutes} 分钟专注`, `${focusMinutes} focused minutes`) : `${activities.length} ${t('条记录', 'activities')}`}</span></div>{activities.length === 0 && <p className="crm-muted">{t('第一条沟通记录会显示在这里。', 'Your first conversation will appear here.')}</p>}{activities.map(a => {
              const task = data.tasks.find(task => task.id === a.taskId)
              const linkedDeal = a.dealId ? data.deals.find(d => d.id === a.dealId) : undefined
              const stages = a.kind === 'stage' ? a.body.split(':') as CrmStage[] : []
              return <article key={a.id}><span className="crm-history-icon" aria-hidden="true">{a.kind === 'call' ? <Phone size={13} /> : a.kind === 'email' ? <Mail size={13} /> : a.kind === 'stage' ? <TrendingUp size={13} /> : a.kind === 'followup' ? <CalendarDays size={13} /> : <MessageSquare size={13} />}</span><div className="crm-history-meta"><strong>{activityLabel(a.kind)}{linkedDeal ? ` · ${linkedDeal.title}` : ''}</strong><time dateTime={new Date(a.occurredAt).toISOString()}>{new Date(a.occurredAt).toLocaleString(zh ? 'zh-CN' : 'en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', year: 'numeric' })}</time></div><p>{a.kind === 'stage' && stages.every(s => STAGES.includes(s)) ? `${stageLabel(stages[0], mode, zh)} → ${stageLabel(stages[1], mode, zh)}` : a.body}</p>{a.taskId && <small>{task ? `${isOpenTask(task) ? t('待跟进', 'Open follow-up') : task.status === 'done' ? t('已完成', 'Completed') : t('已取消', 'Dropped')} · ${task.title}` : t('关联任务已移除', 'Linked task was removed')}</small>}</article>
            })}</section>
            <footer className="crm-customer-footer"><span>{t('建档于', 'Created')} {new Date(selected.createdAt).toLocaleDateString(zh ? 'zh-CN' : 'en')}</span><button disabled={busy} onClick={() => void archive([selected.id], !selected.archivedAt)}>{selected.archivedAt ? <RotateCcw size={14} /> : <Archive size={14} />}{selected.archivedAt ? t('恢复客户', 'Restore customer') : t('归档客户', 'Archive customer')}</button></footer>
          </div>
        </> : <div className="crm-detail-empty"><div className="crm-empty-illustration" aria-hidden="true"><span className="crm-empty-tab" /><div><ContactRound size={35} strokeWidth={1.3} /><i /><i /></div><span className="crm-empty-note"><Check size={18} />{t('为沟通，留好下一步', 'Make room for the next step')}</span></div><span className="crm-eyebrow">{t('把关系经营好', 'MAKE ROOM FOR RELATIONSHIPS')}</span><h2>{t('好关系，从一次沟通开始', 'Good relationships start with a conversation')}</h2><p>{t('选一位客户，让需求、沟通和机会，在同一页接续。', 'Pick a customer. Keep the context, the conversation and the next opportunity together.')}</p><button className="crm-primary" disabled={busy} onClick={() => { const c = filtered[0]; if (c) selectCustomer(c); else setEditor({ kind: 'customer' }) }}>{filtered.length ? t('开始跟进', 'Start a conversation') : t('添加客户', 'Add a customer')}<ArrowUpRight size={15} /></button><div className="crm-empty-flow"><span><MessageSquare size={15} />{t('沟通有记录', 'Context remembered')}</span><span><CalendarDays size={15} />{t('跟进有安排', 'Next steps planned')}</span><span><TrendingUp size={15} />{t('机会有进展', 'Opportunities moving')}</span></div></div>}

      </section>
    </div>
  </div>
}
