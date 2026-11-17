import { useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { ArrowDownRight, ChevronLeft, ChevronRight, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { format, parseISO, addDays } from 'date-fns'
import type { SpendEntry } from '../../data/models/types'
import { convertToBase } from '../../lib/currency'
import { useI18n } from '../../shared/i18n/useI18n'
import { toDateKey } from '../../shared/utils/time'
import type { SpendCategoryOption } from './spendCategories'
import { renderSpendIcon } from './spendIcons'
import type { CurrencyCode } from '../../shared/prefs/preferences'
import DailyFixedSpend from './DailyFixedSpend'
import { currencyLabel, formatSpendMoney as money, type FixedExpense } from './spendPreferences'
import './spend-detail.css'

type Props = {
  today: string
  date: string
  onDate: (date: string) => void
  entries: SpendEntry[]
  categories: SpendCategoryOption[]
  baseCurrency: CurrencyCode
  onBaseCurrency: (currency: CurrencyCode) => void
  preferenceScope: string
  onFillFixed: (item: FixedExpense) => void
  draft: string
  onDraft: (value: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  currency: string
  onCurrency: (value: string) => void
  categoryId: string
  onCategory: (value: string) => void
  loadState: 'loading' | 'ready' | 'error'
  saving: boolean
  error: 'amount' | 'save' | null
  announcement: string | null
  onAdd: (date: string) => Promise<void>
  onUpdate: (entry: SpendEntry) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function CurrencyOptions({ current }: { current: string }) {
  const { language } = useI18n()
  return [...new Set(['CNY', 'USD', current])].map(code => (
    <option key={code} value={code}>{currencyLabel(code, language === 'zh')}</option>
  ))
}

function CategoryOptions({ options, current, unnamed }: { options: SpendCategoryOption[]; current: string; unnamed: string }) {
  return <>
    {!options.some(category => category.id === current) && <option value={current}>{unnamed}</option>}
    {options.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
  </>
}

function EntryEditor({ entry, categories, today, onSave, onCancel }: {
  entry: SpendEntry
  categories: SpendCategoryOption[]
  today: string
  onSave: Props['onUpdate']
  onCancel: () => void
}) {
  const { language, t } = useI18n()
  const zh = language === 'zh'
  const [fields, setFields] = useState(entry)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !Number.isFinite(fields.amount) || fields.amount <= 0) return
    setPending(true)
    setFailed(false)
    try {
      await onSave({ ...fields, note: fields.note?.trim() || undefined })
    } catch {
      setFailed(true)
      setPending(false)
    }
  }

  return (
    <form className="spend-detail__editor" onSubmit={submit}>
      <label>{zh ? '备注' : 'Note'}
        <input maxLength={60} value={fields.note ?? ''} onChange={event => setFields({ ...fields, note: event.target.value })} disabled={pending} />
      </label>
      <div className="spend-detail__editor-grid">
        <label>{t('spend.amount')}
          <input type="number" inputMode="decimal" min="0.01" step="0.01" required value={Number.isNaN(fields.amount) ? '' : fields.amount}
            onChange={event => setFields({ ...fields, amount: event.target.valueAsNumber })} disabled={pending} />
        </label>
        <label>{zh ? '币种' : 'Currency'}
          <select value={fields.currency} onChange={event => setFields({ ...fields, currency: event.target.value })} disabled={pending}>
            <CurrencyOptions current={fields.currency} />
          </select>
        </label>
        <label>{t('spend.category')}
          <select value={fields.categoryId} onChange={event => setFields({ ...fields, categoryId: event.target.value })} disabled={pending}>
            <CategoryOptions options={categories} current={fields.categoryId} unnamed={zh ? '未分类' : 'Uncategorized'} />
          </select>
        </label>
        <label>{zh ? '日期' : 'Date'}
          <input type="date" max={today} required value={fields.dateKey} onChange={event => setFields({ ...fields, dateKey: event.target.value })} disabled={pending} />
        </label>
      </div>
      <div className="spend-detail__actions">
        {failed && <small role="alert">{zh ? '没能保存，请重试。' : 'Could not save. Try again.'}</small>}
        <button type="button" disabled={pending} onClick={onCancel}>{zh ? '取消' : 'Cancel'}</button>
        <button type="submit" className="spend-detail__primary" disabled={pending}>{zh ? '保存修改' : 'Save changes'}</button>
      </div>
    </form>
  )
}

function SpendingInsights({ entries, today, categories, baseCurrency, loadState, onDate }: Pick<Props, 'entries' | 'today' | 'categories' | 'baseCurrency' | 'loadState' | 'onDate'>) {
  const { language, t } = useI18n()
  const zh = language === 'zh'
  const locale = zh ? 'zh-CN' : 'en-US'
  const [days, setDays] = useState<7 | 30>(7)
  const { dates, daily, categoryTotals, total, max, count, converted } = useMemo(() => {
    const dates = Array.from({ length: days }, (_, index) => toDateKey(addDays(parseISO(today), index + 1 - days)))
    const daily = new Map(dates.map(date => [date, 0]))
    const groups = new Map<string, number>()
    let total = 0
    let count = 0
    let converted = false
    for (const entry of entries) {
      const subtotal = daily.get(entry.dateKey)
      if (subtotal === undefined) continue
      const value = convertToBase(entry.amount, entry.currency, baseCurrency)
      converted ||= entry.currency !== baseCurrency
      daily.set(entry.dateKey, subtotal + value)
      groups.set(entry.categoryId, (groups.get(entry.categoryId) ?? 0) + value)
      total += value
      count += 1
    }
    const categoryTotals = [...groups.entries()].sort((a, b) => b[1] - a[1])
    return { dates, daily, categoryTotals, total, max: Math.max(0, ...daily.values()), count, converted }
  }, [days, today, entries, baseCurrency])

  return (
    <section className="spend-detail__insights" aria-label={t('spend.trend')}>
      <div className="spend-detail__insight-heading">
        <h3><ArrowDownRight size={17} aria-hidden="true" />{t('spend.trend')}</h3>
        <div className="spend-detail__range" role="group" aria-label={zh ? '统计范围' : 'Date range'}>
          {([7, 30] as const).map(value => (
            <button type="button" key={value} aria-pressed={days === value} onClick={() => setDays(value)}>{value}{zh ? ' 天' : 'd'}</button>
          ))}
        </div>
      </div>
      <div className="spend-detail__period">
        <span>{zh ? '期间合计' : 'Period total'} · {baseCurrency}{converted ? (zh ? '（折算）' : ' (est.)') : ''}</span>
        <strong>{loadState === 'ready' ? money(total, baseCurrency, locale) : '—'}</strong>
      </div>
      {loadState === 'ready' && count > 0 ? (
        <>
          <div className="spend-detail__bars" data-range={days} role={days === 7 ? 'group' : 'img'} aria-label={days === 7 ? (zh ? '每日支出，选择有记录的一天查看明细' : 'Daily spending. Select a day with expenses to see its entries.') : dates.map(date => `${format(parseISO(date), 'M/d')} ${money(daily.get(date) ?? 0, baseCurrency, locale)}`).join('; ')}>
            {dates.map(date => {
              const amount = daily.get(date) ?? 0
              const bar = <span style={{ height: amount > 0 && max > 0 ? `max(4px, ${amount / max * 100}%)` : '2px' }} />
              const label = `${format(parseISO(date), 'M/d')} · ${money(amount, baseCurrency, locale)}`
              if (days === 30 || amount <= 0) return <div key={date} title={label} data-empty={amount <= 0} aria-hidden="true">{bar}</div>
              return <button type="button" key={date} onClick={() => onDate(date)} title={label} aria-label={label}>{bar}</button>
            })}
          </div>
          <div className="spend-detail__axis" aria-hidden="true"><span>{format(parseISO(dates[0]), 'M/d')}</span><span>{format(parseISO(today), 'M/d')}</span></div>
          <h4>{zh ? '按分类' : 'By category'}</h4>
          <ul className="spend-detail__breakdown">
            {categoryTotals.map(([id, amount]) => {
              const category = categories.find(item => item.id === id)
              const share = total > 0 ? Math.round(amount / total * 100) : 0
              return (
                <li key={id}>
                  <div><span>{renderSpendIcon(category?.icon, { size: 14 })}{category?.name ?? (zh ? '未分类' : 'Uncategorized')}</span><strong>{money(amount, baseCurrency, locale)}</strong></div>
                  <div className="spend-detail__meter"><span style={{ width: `${share}%` }} /><small>{share}%</small></div>
                </li>
              )
            })}
          </ul>
        </>
      ) : loadState === 'ready' && <p className="spend-detail__trend-empty">{zh ? '这段时间没有支出记录。记下几笔后，就能看出钱主要花在哪。' : 'No expenses in this period. Add a few to see where your money goes.'}</p>}
    </section>
  )
}

export default function SpendDetail(props: Props) {
  const { today, date, onDate, entries, categories, baseCurrency, onBaseCurrency, preferenceScope, onFillFixed, draft, onDraft, inputRef, currency, onCurrency, categoryId, onCategory, loadState, saving, error, announcement, onAdd, onUpdate, onDelete } = props
  const { language, t } = useI18n()
  const zh = language === 'zh'
  const locale = zh ? 'zh-CN' : 'en-US'
  const ledgerRef = useRef<HTMLElement>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [deleteState, setDeleteState] = useState<'pending' | 'error' | null>(null)
  const dayEntries = useMemo(() => entries.filter(entry => entry.dateKey === date), [date, entries])
  const total = dayEntries.reduce((sum, entry) => sum + convertToBase(entry.amount, entry.currency, baseCurrency), 0)
  const converted = dayEntries.some(entry => entry.currency !== baseCurrency)
  const dateLabel = (key: string, options: Intl.DateTimeFormatOptions) => parseISO(key).toLocaleDateString(locale, options)
  const shortDate = dateLabel(date, { month: 'short', day: 'numeric' })

  const selectDate = (key: string) => {
    if (!key || key > today || key === date) return
    onDate(key)
    setEditing(null)
    setRemoving(null)
  }

  const openChartDay = (key: string) => {
    selectDate(key)
    ledgerRef.current?.focus({ preventScroll: true })
    ledgerRef.current?.scrollIntoView({ block: 'nearest' })
  }

  const remove = async (id: string) => {
    if (deleteState === 'pending') return
    setDeleteState('pending')
    try {
      await onDelete(id)
      setRemoving(null)
      setDeleteState(null)
    } catch {
      setDeleteState('error')
    }
  }

  return (
    <div className="spend-detail">
      <div className="spend-detail__masthead">
        <div>
          <div className="spend-detail__kicker"><ReceiptText size={15} aria-hidden="true" />{date === today ? (zh ? '今日支出' : 'SPENT TODAY') : (zh ? '当日支出' : 'DAILY SPENDING')}</div>
          <p className="spend-detail__total" aria-live="polite">{loadState === 'ready' ? money(total, baseCurrency, locale) : '—'}</p>
          <div className="spend-detail__currency-picker">
            <label htmlFor="spend-summary-currency">{zh ? '汇总币种' : 'Summary currency'}</label>
            <select id="spend-summary-currency" value={baseCurrency} onChange={event => onBaseCurrency(event.target.value === 'USD' ? 'USD' : 'CNY')}>
              <CurrencyOptions current={baseCurrency} />
            </select>
          </div>
          <span className="spend-detail__meta">{loadState === 'ready' ? (zh ? `${dayEntries.length} 笔记录` : `${dayEntries.length} ${dayEntries.length === 1 ? 'entry' : 'entries'}`) : '—'}{converted ? (zh ? ` · 折合 ${baseCurrency}，供参考` : ` · Estimated in ${baseCurrency}`) : ''}</span>
        </div>
        <div className="spend-detail__date">
          <span>{dateLabel(date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
          <div className="spend-detail__date-controls">
            <button type="button" aria-label={zh ? '前一天' : 'Previous day'} onClick={() => selectDate(toDateKey(addDays(parseISO(date), -1)))}><ChevronLeft size={18} /></button>
            <input type="date" value={date} max={today} aria-label={zh ? '账目日期' : 'Ledger date'} onChange={event => selectDate(event.target.value)} />
            <button type="button" aria-label={zh ? '后一天' : 'Next day'} disabled={date >= today} onClick={() => selectDate(toDateKey(addDays(parseISO(date), 1)))}><ChevronRight size={18} /></button>
            {date !== today && <button type="button" className="spend-detail__today" onClick={() => selectDate(today)}>{t('spend.today')}</button>}
          </div>
        </div>
      </div>

      <div className="spend-detail__columns">
        <div className="spend-detail__main">
          <form className="spend-detail__composer" onSubmit={event => { event.preventDefault(); void onAdd(date) }}>
            <div className="spend-detail__heading"><h3><label htmlFor="spend-quick-entry">{zh ? '记一笔' : 'Log an expense'}</label></h3>{date !== today && <span>{zh ? `补记 · ${shortDate}` : `For ${shortDate}`}</span>}</div>
            <input ref={inputRef} id="spend-quick-entry" className="spend-detail__entry" placeholder={zh ? '例如：午饭 28' : 'e.g. coffee 4.50'} value={draft} onChange={event => onDraft(event.target.value)}
              readOnly={saving} autoComplete="off" maxLength={120} aria-invalid={error === 'amount' || undefined}
              onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }} />
            <div className="spend-detail__compose-actions">
              <label>{zh ? '币种' : 'Currency'}<select value={currency} onChange={event => onCurrency(event.target.value)} disabled={saving}><CurrencyOptions current={currency} /></select></label>
              <label>{t('spend.category')}<select value={categoryId} onChange={event => onCategory(event.target.value)} disabled={saving}><CategoryOptions options={categories} current={categoryId} unnamed={zh ? '未分类' : 'Uncategorized'} /></select></label>
              <button type="submit" className="spend-detail__primary" disabled={saving || loadState !== 'ready'}><Plus size={17} aria-hidden="true" />{zh ? '记下' : 'Add'}</button>
            </div>
            <p className="spend-detail__hint" role={error ? 'alert' : 'status'}>
              {error === 'amount' ? (zh ? '请输入大于 0 的金额，例如「午饭 28」。' : 'Enter an amount greater than 0, e.g. “coffee 4.50”.')
                : error === 'save' ? (zh ? '没能记下，请重试。' : 'Could not record the expense. Try again.')
                : announcement ?? (zh ? '金额即可记账，也可以写上用途。' : 'An amount is enough. Add a note if you like.')}
            </p>
          </form>

          <section ref={ledgerRef} tabIndex={-1} className="spend-detail__ledger" aria-label={zh ? '账目明细' : 'Expense entries'}>
            <div className="spend-detail__heading"><h3>{zh ? '账目明细' : 'Entries'}</h3><span>{date === today ? t('spend.today') : shortDate}</span></div>
            {loadState !== 'ready' || dayEntries.length === 0 ? (
              <div className="spend-detail__empty">
                <ReceiptText size={22} strokeWidth={1.6} aria-hidden="true" />
                <div><strong>{loadState === 'loading' ? (zh ? '正在读取账目…' : 'Loading entries…') : loadState === 'error' ? (zh ? '账目暂时无法读取' : 'Could not load entries') : (zh ? '这一天还没有记录' : 'No expenses for this day')}</strong>
                  {loadState === 'ready' && <p>{zh ? '上面记下第一笔，金额和分类会列在这里。' : 'Add an expense above to see its amount and category here.'}</p>}
                </div>
              </div>
            ) : (
              <ul className="spend-detail__entries">
                {dayEntries.map(entry => {
                  const category = categories.find(option => option.id === entry.categoryId)
                  const categoryName = category?.name ?? (zh ? '未分类' : 'Uncategorized')
                  const title = entry.note || categoryName
                  const editLabel = zh ? `编辑：${title}` : `Edit: ${title}`
                  const deleteLabel = zh ? `删除：${title}` : `Delete: ${title}`
                  return (
                    <li key={entry.id}>
                      <div className="spend-detail__row">
                        <span className="spend-detail__entry-icon">{renderSpendIcon(category?.icon, { size: 17 })}</span>
                        <div className="spend-detail__entry-text"><strong>{title}</strong>{entry.note && <span>{categoryName}</span>}</div>
                        <strong className="spend-detail__row-amount">{money(entry.amount, entry.currency, locale)}</strong>
                        <div className="spend-detail__row-actions">
                          <button type="button" aria-label={editLabel} title={editLabel} aria-expanded={editing === entry.id} onClick={() => { setRemoving(null); setEditing(editing === entry.id ? null : entry.id) }}><Pencil size={15} /></button>
                          <button type="button" aria-label={deleteLabel} title={deleteLabel} aria-expanded={removing === entry.id} disabled={deleteState === 'pending'} onClick={() => { setEditing(null); setRemoving(removing === entry.id ? null : entry.id); setDeleteState(null) }}><Trash2 size={15} /></button>
                        </div>
                      </div>
                      {editing === entry.id && <EntryEditor entry={entry} categories={categories} today={today} onCancel={() => setEditing(null)}
                        onSave={async updated => { await onUpdate(updated); setEditing(null); if (updated.dateKey !== date) selectDate(updated.dateKey) }} />}
                      {removing === entry.id && (
                        <div className="spend-detail__actions">
                          <small role={deleteState === 'error' ? 'alert' : undefined}>{deleteState === 'error' ? (zh ? '删除失败，请重试。' : 'Could not delete. Try again.') : (zh ? '删除这一笔开销？' : 'Delete this expense?')}</small>
                          <button type="button" disabled={deleteState === 'pending'} onClick={() => setRemoving(null)}>{zh ? '取消' : 'Cancel'}</button>
                          <button type="button" className="spend-detail__danger" disabled={deleteState === 'pending'} onClick={() => void remove(entry.id)}>{zh ? '删除' : 'Delete'}</button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
        <div className="spend-detail__side">
          <DailyFixedSpend key={preferenceScope} scope={preferenceScope} baseCurrency={baseCurrency}
            fillDisabled={saving || Boolean(draft.trim())} onFill={onFillFixed} />
          <SpendingInsights entries={entries} today={today} categories={categories} baseCurrency={baseCurrency} loadState={loadState} onDate={openChartDay} />
        </div>
      </div>
    </div>
  )
}
