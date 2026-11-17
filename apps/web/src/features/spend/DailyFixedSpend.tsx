import { useState, type FormEvent } from 'react'
import { Pencil, Plus, Repeat2 } from 'lucide-react'
import type { CurrencyCode } from '../../shared/prefs/preferences'
import { useI18n } from '../../shared/i18n/useI18n'
import { currencyLabel, formatSpendMoney, readFixedExpenses, writeFixedExpenses, type FixedExpense } from './spendPreferences'

type Props = {
  scope: string
  baseCurrency: CurrencyCode
  fillDisabled: boolean
  onFill: (expense: FixedExpense) => void
}

export default function DailyFixedSpend({ scope, baseCurrency, fillDisabled, onFill }: Props) {
  const { language, t } = useI18n()
  const zh = language === 'zh'
  const locale = zh ? 'zh-CN' : 'en-US'
  const [items, setItems] = useState(() => readFixedExpenses(scope))
  const [editing, setEditing] = useState<{ id?: string; name: string; amount: string; currency: CurrencyCode }>()
  const [error, setError] = useState(false)
  const totals = (['CNY', 'USD'] as const).flatMap(currency => {
    const amount = items.filter(item => item.currency === currency).reduce((sum, item) => sum + item.amount, 0)
    return amount > 0 ? [formatSpendMoney(amount, currency, locale)] : []
  })
  const heading = zh ? '每日固定开销' : 'Daily fixed expenses'

  const persist = (next: FixedExpense[]) => {
    try {
      writeFixedExpenses(scope, next)
      setItems(next)
      setEditing(undefined)
      setError(false)
    } catch {
      setError(true)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing) return
    const name = editing.name.trim()
    const amount = Number(editing.amount)
    if (!name || !Number.isFinite(amount) || amount <= 0) return
    const item = { id: editing.id ?? crypto.randomUUID(), name, amount, currency: editing.currency }
    persist(editing.id ? items.map(existing => existing.id === item.id ? item : existing) : [...items, item])
  }

  const edit = (item?: FixedExpense) => {
    setEditing(item ? { ...item, amount: item.amount.toFixed(2) } : { name: '', amount: '', currency: baseCurrency })
    setError(false)
  }

  return (
    <section className="spend-detail__fixed" aria-label={heading}>
      <div className="spend-detail__heading">
        <h3><Repeat2 size={16} aria-hidden="true" />{heading}</h3>
        {!editing && <button type="button" onClick={() => edit()}><Plus size={15} aria-hidden="true" />{zh ? '添加项目' : 'Add item'}</button>}
      </div>
      {totals.length > 0 && <p className="spend-detail__fixed-total">
        {totals.join(' + ')} <span>{zh ? '/ 天' : '/ day'}</span>
      </p>}
      <p className="spend-detail__fixed-help">
        {items.length ? (zh ? '填入记账框，确认后计入所选日期的实支。' : 'Fill an item to record it on the selected date.')
          : (zh ? '把每天重复的交通、餐费等存成常用项目。' : 'Save expenses you repeat daily, such as a commute.')}
      </p>
      {items.length > 0 && <ul className="spend-detail__fixed-list">
        {items.map(item => <li key={item.id}>
          <strong>{item.name}</strong>
          <span>{formatSpendMoney(item.amount, item.currency, locale)}</span>
          <button type="button" onClick={() => onFill(item)} disabled={fillDisabled} aria-label={zh ? `填入 ${item.name}` : `Fill ${item.name}`}>
            {zh ? '填入' : 'Fill'}
          </button>
          <button type="button" className="spend-detail__fixed-edit" onClick={() => edit(item)} aria-label={zh ? `编辑固定开销 ${item.name}` : `Edit fixed expense ${item.name}`}><Pencil size={15} /></button>
        </li>)}
      </ul>}
      {editing && <form className="spend-detail__editor spend-detail__fixed-editor" onSubmit={submit}>
        <label>{zh ? '项目名称' : 'Expense name'}
          <input required maxLength={60} value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} />
        </label>
        <div className="spend-detail__editor-grid">
          <label>{t('spend.amount')}
            <input required type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" value={editing.amount}
              onChange={event => setEditing({ ...editing, amount: event.target.value })} />
          </label>
          <label>{zh ? '币种' : 'Currency'}
            <select value={editing.currency} onChange={event => setEditing({ ...editing, currency: event.target.value === 'USD' ? 'USD' : 'CNY' })}>
              <option value="CNY">{currencyLabel('CNY', zh)}</option>
              <option value="USD">{currencyLabel('USD', zh)}</option>
            </select>
          </label>
        </div>
        <div className="spend-detail__actions">
          {editing.id && <button type="button" className="spend-detail__danger" onClick={() => persist(items.filter(item => item.id !== editing.id))}>{zh ? '移除项目' : 'Remove item'}</button>}
          <button type="button" onClick={() => { setEditing(undefined); setError(false) }}>{zh ? '取消' : 'Cancel'}</button>
          <button type="submit" className="spend-detail__primary" disabled={!editing.name.trim()}>{zh ? '保存项目' : 'Save item'}</button>
        </div>
        {error && <p role="alert">{zh ? '无法保存固定开销，请重试。' : 'Could not save the fixed expenses. Try again.'}</p>}
      </form>}
    </section>
  )
}
