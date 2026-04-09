import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Bell, BellOff, CalendarDays, CheckCheck, ChevronRight, CreditCard, LayoutGrid, Plus, Trash2, X } from 'lucide-react'
import type { LifeSubscription } from '../../../data/models/types'
import type { SubscriptionDraft } from '../cards/SubscriptionsCard'
import type { SubscriptionPresentationModel } from '../cards/lifeDesignAdapters'
import { LifeCardLoader, LifePanelLoader } from './lifeDesignPrimitives'

type Props = {
  model: SubscriptionPresentationModel
  subscriptions: LifeSubscription[]
  open: boolean
  loading: boolean
  onOpen: () => void
  onClose: () => void
  onCreateSubscription: (draft: SubscriptionDraft) => Promise<LifeSubscription>
  onPatchSubscription: (id: string, patch: Partial<LifeSubscription>) => Promise<LifeSubscription | undefined>
  onRemoveSubscription: (id: string) => void
}

type Currency = 'USD' | 'CNY'
type BillingCycle = 'monthly' | 'yearly'
type PaymentStatus = 'paid' | 'unpaid'
type StatusFilter = 'all' | 'paid' | 'unpaid'
type FormState = {
  name: string
  amount: string
  currency: Currency
  cycle: BillingCycle
  color: string
  category: string
  billingDay: string
  billingMonth: string
  emoji: string
  reminder: boolean
  paymentStatus: PaymentStatus
}
type Category = { id: string; label: string; emoji: string }

const paper = '#F5F3F0'
const ink = '#3A3733'
const subtleBorder = 'rgba(58,55,51,0.09)'
const mutedInk = 'rgba(58,55,51,0.45)'
const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', CNY: '¥' }
const COLOR_PALETTE = ['#E87070', '#6EAB7A', '#7AADE5', '#E8A85F', '#C07AC0', '#7ABDE5', '#89C0A0', '#D4A06A']
const CATEGORIES: Category[] = [
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'productivity', label: 'Productivity', emoji: '💼' },
  { id: 'cloud', label: 'Cloud & Storage', emoji: '☁️' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'health', label: 'Health & Fitness', emoji: '🏃' },
  { id: 'security', label: 'Security', emoji: '🛡️' },
  { id: 'developer', label: 'Developer Tools', emoji: '🔧' },
  { id: 'news', label: 'News & Media', emoji: '📰' },
  { id: 'other', label: 'Other', emoji: '📦' },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const TODAY = new Date(2026, 3, 8)
const CURRENT_MONTH = TODAY.getMonth()

const inter = (size = 13, weight = 400, color = ink): CSSProperties => ({ fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: weight, color })
const playfair = (size = 16, weight = 500, color = ink): CSSProperties => ({ fontFamily: 'Playfair Display, serif', fontSize: size, fontWeight: weight, color })
const formatAmount = (amount: number) => (Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.?0+$/, ''))
const monthlyAmount = (item: Pick<LifeSubscription, 'amount' | 'cycle'>) => (item.cycle === 'yearly' ? item.amount / 12 : item.amount)
const nextColor = (colors: string[]) => COLOR_PALETTE.find((color) => !colors.includes(color)) ?? COLOR_PALETTE[colors.length % COLOR_PALETTE.length]
const monthlyTotals = (subs: LifeSubscription[]) =>
  subs.reduce<Record<Currency, number>>((acc, item) => {
    acc[item.currency] += monthlyAmount(item)
    return acc
  }, { USD: 0, CNY: 0 })
const annualTotals = (subs: LifeSubscription[]) =>
  subs.reduce<Record<Currency, number>>((acc, item) => {
    acc[item.currency] += item.cycle === 'yearly' ? item.amount : item.amount * 12
    return acc
  }, { USD: 0, CNY: 0 })
const getMonthlyBreakdown = (subs: LifeSubscription[]) => {
  const result: Record<Currency, number[]> = { USD: Array.from({ length: 12 }, () => 0), CNY: Array.from({ length: 12 }, () => 0) }
  subs.forEach((item) => {
    if (item.cycle === 'monthly') {
      for (let i = 0; i < 12; i += 1) result[item.currency][i] += item.amount
      return
    }
    result[item.currency][(item.billingMonth ?? 1) - 1] += item.amount
  })
  return result
}
const getDaysUntilBilling = (item: LifeSubscription, today = TODAY) => {
  if (!item.billingDay) return null
  if (item.cycle === 'yearly' && item.billingMonth != null && item.billingMonth !== today.getMonth() + 1) return null
  const delta = item.billingDay - today.getDate()
  return delta < 0 ? null : delta
}
const toFormState = (item: LifeSubscription): FormState => ({
  name: item.name,
  amount: String(item.amount),
  currency: item.currency,
  cycle: item.cycle,
  color: item.color ?? '#D4A06A',
  category: item.category ?? '',
  billingDay: item.billingDay?.toString() ?? '',
  billingMonth: item.billingMonth?.toString() ?? '',
  emoji: item.emoji ?? '',
  reminder: item.reminder === true,
  paymentStatus: item.paymentStatus ?? 'unpaid',
})
const toDraft = (form: FormState): SubscriptionDraft => ({
  name: form.name,
  amount: parseFloat(form.amount) || 0,
  currency: form.currency,
  cycle: form.cycle,
  color: form.color,
  category: form.category || undefined,
  billingDay: parseInt(form.billingDay, 10) || undefined,
  billingMonth: parseInt(form.billingMonth, 10) || undefined,
  emoji: form.emoji || undefined,
  reminder: form.reminder,
  paymentStatus: form.paymentStatus,
})
const freshForm = (subs: LifeSubscription[]): FormState => ({
  name: '',
  amount: '',
  currency: 'USD',
  cycle: 'monthly',
  color: nextColor(subs.map((item) => item.color ?? '')),
  category: '',
  billingDay: '',
  billingMonth: '',
  emoji: '',
  reminder: false,
  paymentStatus: 'unpaid',
})

const inputBase: CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  color: ink,
  background: 'rgba(58,55,51,0.04)',
  border: '1px solid rgba(58,55,51,0.10)',
  borderRadius: 10,
  padding: '9px 12px',
  width: '100%',
  outline: 'none',
}

function StyledInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{ ...inputBase, ...props.style }}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = 'rgba(58,55,51,0.22)'
        event.currentTarget.style.background = 'rgba(58,55,51,0.06)'
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = 'rgba(58,55,51,0.10)'
        event.currentTarget.style.background = 'rgba(58,55,51,0.04)'
        props.onBlur?.(event)
      }}
    />
  )
}

function InputField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ ...inter(10, 500, mutedInk), marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
      {children}
    </div>
  )
}

function ToggleGroup<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: 2, borderRadius: 10, background: 'rgba(58,55,51,0.06)', border: '1px solid rgba(58,55,51,0.08)' }}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: 8,
              border: active ? '1px solid rgba(58,55,51,0.12)' : '1px solid transparent',
              background: active ? 'rgba(58,55,51,0.10)' : 'transparent',
              cursor: 'pointer',
              ...inter(12, active ? 500 : 400, active ? ink : mutedInk),
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, border: 'none', background: value ? '#3A3733' : 'rgba(58,55,51,0.15)', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 'calc(100% - 18px)' : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'all 0.2s ease' }} />
    </button>
  )
}

function ColorPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {COLOR_PALETTE.map((color) => (
        <button key={color} type="button" onClick={() => onChange(color)} style={{ width: 20, height: 20, borderRadius: 999, border: 'none', background: color, cursor: 'pointer', boxShadow: value === color ? `0 0 0 2px ${paper}, 0 0 0 3.5px ${color}` : '0 1px 3px rgba(0,0,0,0.12)', transform: value === color ? 'scale(1.15)' : 'scale(1)' }} />
      ))}
    </div>
  )
}

function CategoryPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {CATEGORIES.map((category) => {
        const active = value === category.id
        return (
          <button key={category.id} type="button" onClick={() => onChange(active ? '' : category.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', background: active ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.04)', border: `1px solid ${active ? 'rgba(58,55,51,0.18)' : 'rgba(58,55,51,0.08)'}`, ...inter(11, active ? 500 : 400, active ? ink : mutedInk) }}>
            <span style={{ fontSize: 12 }}>{category.emoji}</span>
            <span>{category.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const MonthlyChart = memo(function MonthlyChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  const max = Math.max(...data, 0.01)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
        <span style={{ ...inter(10, 500, mutedInk), textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 92 }}>
        {data.map((value, index) => (
          <div key={`${label}-${index}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div title={value > 0 ? formatAmount(value) : ''} style={{ width: '100%', height: value > 0 ? `${Math.max((value / max) * 90, 6)}px` : '4px', borderRadius: 2, background: index === CURRENT_MONTH ? color : value > 0 ? `${color}70` : 'rgba(58,55,51,0.06)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
        {MONTHS.map((month, index) => (
          <div key={month} style={{ flex: 1, textAlign: 'center', ...inter(8, index === CURRENT_MONTH ? 600 : 400, index === CURRENT_MONTH ? ink : 'rgba(58,55,51,0.28)') }}>{month[0]}</div>
        ))}
      </div>
    </div>
  )
})

const AnnualOverviewPanel = memo(function AnnualOverviewPanel({ subs, usdToCny, onUsdToCnyChange }: { subs: LifeSubscription[]; usdToCny: number; onUsdToCnyChange: (value: number) => void }) {
  const annuals = useMemo(() => annualTotals(subs), [subs])
  const breakdown = useMemo(() => getMonthlyBreakdown(subs), [subs])
  const categoryRows = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const rows = subs.filter((item) => item.category === category.id)
        if (!rows.length) return null
        const byCurrency = annualTotals(rows)
        return { category, byCurrency, unified: (byCurrency.USD ?? 0) * usdToCny + (byCurrency.CNY ?? 0) }
      }).filter(Boolean) as Array<{ category: Category; byCurrency: Record<Currency, number>; unified: number }>,
    [subs, usdToCny],
  )
  const maxCategory = useMemo(() => Math.max(...categoryRows.map((row) => row.unified), 0.01), [categoryRows])
  const upcoming = useMemo(
    () =>
      subs
        .map((item) => ({ item, days: getDaysUntilBilling(item) }))
        .filter((entry) => entry.days !== null && entry.days >= 0 && entry.days <= 7)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0)),
    [subs],
  )

  if (!subs.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 18, marginBottom: 20, background: 'rgba(58,55,51,0.05)', border: `1px solid ${subtleBorder}` }}>
          <LayoutGrid size={20} color="rgba(58,55,51,0.22)" />
        </div>
        <p style={{ ...playfair(17, 500, 'rgba(58,55,51,0.45)'), marginBottom: 6 }}>No data yet</p>
        <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.35)'), lineHeight: 1.65 }}>Add subscriptions to see your annual overview.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '36px 40px 28px', borderBottom: `1px solid ${subtleBorder}` }}>
        <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Annual overview · 2026</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48, flexWrap: 'wrap' }}>
          {annuals.USD > 0 ? <div><p style={{ ...inter(28, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>${formatAmount(annuals.USD)}<span style={{ ...inter(13, 400, mutedInk), marginLeft: 4 }}>/yr</span></p><p style={{ ...inter(11, 400, 'rgba(58,55,51,0.40)'), marginTop: 8 }}>USD · annual</p></div> : null}
          {annuals.CNY > 0 ? <div><p style={{ ...inter(28, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>¥{formatAmount(annuals.CNY)}<span style={{ ...inter(13, 400, mutedInk), marginLeft: 4 }}>/yr</span></p><p style={{ ...inter(11, 400, 'rgba(58,55,51,0.40)'), marginTop: 8 }}>CNY · annual</p></div> : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', padding: '24px 40px', borderBottom: `1px solid ${subtleBorder}`, background: 'rgba(58,55,51,0.018)' }}>
        <div>
          <p style={{ ...inter(10, 500, mutedInk), marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Exchange rate</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={inter(13, 400, ink)}>1 USD =</span>
            <div style={{ width: 140 }}><StyledInput type="number" min="0" step="0.01" value={usdToCny} onChange={(event) => onUsdToCnyChange(parseFloat(event.target.value) || 7.25)} style={{ textAlign: 'center', padding: '8px 10px' }} /></div>
            <span style={inter(13, 400, ink)}>CNY</span>
          </div>
        </div>
        {annuals.USD > 0 && annuals.CNY > 0 ? <div style={{ textAlign: 'right' }}><p style={{ ...inter(10, 500, mutedInk), marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Unified (est.)</p><p style={{ ...inter(18, 600, ink), letterSpacing: '-0.01em' }}>≈ ¥{formatAmount(annuals.USD * usdToCny + annuals.CNY)}<span style={{ ...inter(11, 400, mutedInk), marginLeft: 3 }}>/yr</span></p><p style={{ ...inter(10, 400, 'rgba(58,55,51,0.32)'), marginTop: 4 }}>≈ ¥{formatAmount((annuals.USD * usdToCny + annuals.CNY) / 12)}/mo</p></div> : null}
      </div>
      <div style={{ padding: '28px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
        <p style={{ ...inter(11, 500, mutedInk), marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Monthly burden</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {annuals.USD > 0 ? <MonthlyChart data={breakdown.USD} color="#3A3733" label="USD (monthly spend)" /> : null}
          {annuals.CNY > 0 ? <MonthlyChart data={breakdown.CNY} color="#E8A85F" label="CNY (monthly spend)" /> : null}
        </div>
      </div>
      {categoryRows.length ? <div style={{ padding: '28px 40px', borderBottom: `1px solid ${subtleBorder}` }}><p style={{ ...inter(11, 500, mutedInk), marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.07em' }}>By category · annual</p><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{categoryRows.map((row) => <div key={row.category.id}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14 }}>{row.category.emoji}</span><span style={inter(12, 400, ink)}>{row.category.label}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{row.byCurrency.USD ? <span style={inter(11, 500, 'rgba(58,55,51,0.60)')}>${formatAmount(row.byCurrency.USD)}/yr</span> : null}{row.byCurrency.CNY ? <span style={inter(11, 500, 'rgba(58,55,51,0.60)')}>¥{formatAmount(row.byCurrency.CNY)}/yr</span> : null}</div></div><div style={{ height: 4, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.07)' }}><div style={{ width: `${(row.unified / maxCategory) * 100}%`, height: '100%', borderRadius: 999, background: 'rgba(58,55,51,0.35)' }} /></div></div>)}</div></div> : null}
      {upcoming.length ? <div style={{ padding: '28px 40px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Bell size={13} color="#B87830" /><p style={{ ...inter(11, 500, '#B87830'), textTransform: 'uppercase', letterSpacing: '0.07em' }}>Due within 7 days</p></div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{upcoming.map(({ item, days }) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'rgba(232,168,95,0.08)', border: '1px solid rgba(232,168,95,0.20)' }}>{item.emoji ? <span style={{ fontSize: 15 }}>{item.emoji}</span> : null}<div style={{ flex: 1, minWidth: 0 }}><p style={{ ...inter(13, 500, ink), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p><p style={inter(11, 400, 'rgba(58,55,51,0.50)')}>{CURRENCY_SYMBOL[item.currency]}{formatAmount(item.amount)}/{item.cycle === 'monthly' ? 'mo' : 'yr'} · Apr {item.billingDay}</p></div><span style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(232,168,95,0.30)', background: 'rgba(232,168,95,0.18)', ...inter(10, 600, '#B87830') }}>{days === 0 ? 'Today' : `In ${days}d`}</span></div>)}</div></div> : null}
    </div>
  )
})

const SubListItem = memo(function SubListItem({ sub, selected, onClick }: { sub: LifeSubscription; selected: boolean; onClick: () => void }) {
  const days = getDaysUntilBilling(sub)
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, textAlign: 'left', cursor: 'pointer', border: selected ? '1px solid rgba(58,55,51,0.10)' : '1px solid transparent', background: selected ? 'rgba(58,55,51,0.06)' : 'transparent' }}>
      <div style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: sub.color ?? '#D4A06A', boxShadow: `0 0 0 2px ${(sub.color ?? '#D4A06A')}22` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          {sub.emoji ? <span style={{ fontSize: 12 }}>{sub.emoji}</span> : null}
          <p style={{ ...inter(13, 400, ink), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</p>
          {days !== null && days <= 7 ? <span style={{ padding: '1px 4px', borderRadius: 4, background: 'rgba(232,168,95,0.18)', ...inter(8, 600, '#B87830') }}>{days}d</span> : null}
        </div>
        <p style={{ ...inter(11, 400, mutedInk), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CURRENCY_SYMBOL[sub.currency]}{formatAmount(sub.amount)}/{sub.cycle === 'monthly' ? 'mo' : 'yr'}{sub.category ? ` · ${CATEGORIES.find((item) => item.id === sub.category)?.emoji ?? ''}` : ''}</p>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: sub.paymentStatus === 'paid' ? '#6EAB7A' : 'rgba(58,55,51,0.18)' }} />
        <p style={inter(11, 500, 'rgba(58,55,51,0.55)')}>{CURRENCY_SYMBOL[sub.currency]}{formatAmount(monthlyAmount(sub))}</p>
        <p style={inter(9, 400, 'rgba(58,55,51,0.28)')}>{sub.cycle === 'yearly' ? '/mo est.' : '/mo'}</p>
      </div>
    </button>
  )
})

const SummaryBar = memo(function SummaryBar({ subs, onOverview, showingOverview }: { subs: LifeSubscription[]; onOverview: () => void; showingOverview: boolean }) {
  const totals = useMemo(() => monthlyTotals(subs), [subs])
  const annuals = useMemo(() => annualTotals(subs), [subs])
  const totalLabel = useMemo(
    () => (['USD', 'CNY'] as const).filter((currency) => totals[currency] > 0).map((currency) => `${CURRENCY_SYMBOL[currency]}${formatAmount(totals[currency])}`).join(' + '),
    [totals],
  )
  const annualLabel = useMemo(
    () => (['USD', 'CNY'] as const).filter((currency) => annuals[currency] > 0).map((currency) => `${CURRENCY_SYMBOL[currency]}${formatAmount(annuals[currency])}/yr`).join(' + '),
    [annuals],
  )
  return (
    <div style={{ padding: '16px 20px', borderBottom: `1px solid ${subtleBorder}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <p style={{ ...inter(10, 500, mutedInk), textTransform: 'uppercase', letterSpacing: '0.08em' }}>Monthly total</p>
        <button type="button" onClick={onOverview} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', background: showingOverview ? 'rgba(58,55,51,0.10)' : 'rgba(58,55,51,0.04)', border: `1px solid ${showingOverview ? 'rgba(58,55,51,0.18)' : 'rgba(58,55,51,0.08)'}`, ...inter(9, 500, showingOverview ? ink : mutedInk), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <LayoutGrid size={9} />
          <span>Overview</span>
        </button>
      </div>
      {subs.length ? <><p style={{ ...inter(22, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>{totalLabel}<span style={{ ...inter(12, 400, mutedInk), marginLeft: 4 }}>/mo</span></p><p style={{ ...inter(10, 400, 'rgba(58,55,51,0.35)'), marginTop: 8 }}>{annualLabel} total</p></> : <p style={inter(13, 400, 'rgba(58,55,51,0.35)')}>No subscriptions tracked yet</p>}
    </div>
  )
})

function EmptyList({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 999, marginBottom: 16, background: 'rgba(58,55,51,0.05)' }}><CreditCard size={18} color="rgba(58,55,51,0.22)" /></div>
      <p style={{ ...playfair(15, 500, 'rgba(58,55,51,0.55)'), marginBottom: 6 }}>No subscriptions yet.</p>
      <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.38)'), lineHeight: 1.65, marginBottom: 16 }}>Create your first one.</p>
      <button type="button" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', background: 'rgba(58,55,51,0.07)', border: '1px solid rgba(58,55,51,0.12)', ...inter(12, 500, ink) }}><Plus size={12} /><span>Add subscription</span></button>
    </div>
  )
}

function SubForm({ initial, isNew, onSave, onRemove, onCancel }: { initial: FormState; isNew: boolean; onSave: (form: FormState) => void; onRemove?: () => void; onCancel?: () => void }) {
  const [form, setForm] = useState(initial)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!isNew) onSave(form)
  }, [form, isNew, onSave])
  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value })), [])
  const parsedAmount = parseFloat(form.amount) || 0
  const monthly = form.cycle === 'yearly' ? parsedAmount / 12 : parsedAmount
  const categoryInfo = CATEGORIES.find((item) => item.id === form.category)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '32px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: `${form.color}1A`, border: `1.5px solid ${form.color}44` }}>{form.emoji ? <span style={{ fontSize: 24, lineHeight: 1 }}>{form.emoji}</span> : <div style={{ width: 20, height: 20, borderRadius: 999, background: form.color }} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...playfair(19, 500), lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || (isNew ? 'New Subscription' : '—')}</p>
          {parsedAmount > 0 ? <p style={{ ...inter(13, 400, mutedInk), marginTop: 4 }}>{CURRENCY_SYMBOL[form.currency]}{formatAmount(monthly)}/mo{form.cycle === 'yearly' ? <span style={{ ...inter(11, 400, 'rgba(58,55,51,0.30)'), marginLeft: 6 }}>(est. from {CURRENCY_SYMBOL[form.currency]}{formatAmount(parsedAmount)}/yr)</span> : null}</p> : null}
          {categoryInfo ? <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.40)'), marginTop: 4 }}>{categoryInfo.emoji} {categoryInfo.label}</p> : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '28px 40px' }}>
        <section><p style={{ ...inter(9, 600, 'rgba(58,55,51,0.30)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Basics</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><InputField label="Service name"><StyledInput value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Netflix, iCloud+" /></InputField><div style={{ display: 'flex', gap: 16 }}><div style={{ flex: 1 }}><InputField label="Amount"><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', ...inter(14, 500, 'rgba(58,55,51,0.45)') }}>{CURRENCY_SYMBOL[form.currency]}</span><StyledInput type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="0.00" style={{ paddingLeft: 28 }} /></div></InputField></div><div style={{ width: 140 }}><InputField label="Currency"><ToggleGroup<Currency> options={[{ value: 'USD', label: '$ USD' }, { value: 'CNY', label: '¥ CNY' }]} value={form.currency} onChange={(value) => update('currency', value)} /></InputField></div></div><InputField label="Billing cycle"><ToggleGroup<BillingCycle> options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} value={form.cycle} onChange={(value) => update('cycle', value)} />{form.cycle === 'yearly' && parsedAmount > 0 ? <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.40)'), marginTop: 8 }}>≈ {CURRENCY_SYMBOL[form.currency]}{formatAmount(monthly)} per month</p> : null}</InputField></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'rgba(58,55,51,0.30)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Category</p><CategoryPicker value={form.category} onChange={(value) => update('category', value)} /></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'rgba(58,55,51,0.30)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Schedule</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ display: 'flex', gap: 16 }}><div style={{ flex: 1 }}><InputField label="Billing day"><div style={{ position: 'relative' }}><CalendarDays size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(58,55,51,0.35)' }} /><StyledInput type="number" min="1" max="31" value={form.billingDay} onChange={(event) => update('billingDay', event.target.value)} placeholder="Day (1–31)" style={{ paddingLeft: 30 }} /></div></InputField></div>{form.cycle === 'yearly' ? <div style={{ flex: 1 }}><InputField label="Billing month"><StyledInput type="number" min="1" max="12" value={form.billingMonth} onChange={(event) => update('billingMonth', event.target.value)} placeholder="Month (1–12)" /></InputField></div> : null}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 16, background: 'rgba(58,55,51,0.03)', border: `1px solid ${subtleBorder}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{form.reminder ? <Bell size={14} color={ink} /> : <BellOff size={14} color="rgba(58,55,51,0.35)" />}<span style={inter(13, 400, form.reminder ? ink : 'rgba(58,55,51,0.50)')}>{form.reminder ? 'Renewal reminder on' : 'No reminder'}</span></div><ToggleSwitch value={form.reminder} onChange={(value) => update('reminder', value)} /></div></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'rgba(58,55,51,0.30)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Appearance</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><InputField label="Emoji icon"><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><StyledInput type="text" value={form.emoji} onChange={(event) => update('emoji', event.target.value.slice(0, 2))} placeholder="e.g. 📺" style={{ width: 80, textAlign: 'center', fontSize: 20 }} /><p style={inter(11, 400, 'rgba(58,55,51,0.38)')}>One emoji to represent this service.</p></div></InputField><InputField label="Colour"><ColorPicker value={form.color} onChange={(value) => update('color', value)} /></InputField></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'rgba(58,55,51,0.30)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Payment status</p><ToggleGroup<PaymentStatus> options={[{ value: 'unpaid', label: 'Unpaid' }, { value: 'paid', label: 'Paid ✓' }]} value={form.paymentStatus} onChange={(value) => update('paymentStatus', value)} /><p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)'), marginTop: 8 }}>Mark whether this period&apos;s payment has been made.</p></section>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 40px', marginTop: 'auto', borderTop: `1px solid ${subtleBorder}` }}>
        {isNew ? <><button type="button" onClick={onCancel} style={{ padding: '6px 16px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(58,55,51,0.10)', ...inter(12, 400, mutedInk) }}>Cancel</button><button type="button" onClick={() => { if (form.name.trim() && parsedAmount > 0) onSave(form) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 12, cursor: 'pointer', border: 'none', background: form.name.trim() && parsedAmount > 0 ? '#3A3733' : 'rgba(58,55,51,0.18)', ...inter(13, 500, '#F5F3F0') }}><Plus size={14} /><span>Add subscription</span></button></> : <><button type="button" onClick={onRemove} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(58,55,51,0.08)', background: 'transparent', ...inter(12, 400, 'rgba(58,55,51,0.35)') }}><Trash2 size={12} /><span>Remove</span></button><div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...inter(11, 400, 'rgba(58,55,51,0.38)') }}><CheckCheck size={12} /><span>Auto-saved</span></div></>}
      </div>
    </div>
  )
}

export const SubscriptionCardSurface = ({ model, subscriptions, open, loading, onOpen, onClose, onCreateSubscription, onPatchSubscription, onRemoveSubscription }: Props) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showingOverview, setShowingOverview] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [usdToCny, setUsdToCny] = useState(7.25)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const selected = useMemo(() => subscriptions.find((item) => item.id === selectedId) ?? null, [selectedId, subscriptions])
  useEffect(() => {
    if (!open) return
    if (!subscriptions.length) {
      setIsAdding(true)
      setShowingOverview(false)
      setSelectedId(null)
      return
    }
    setIsAdding(false)
    setShowingOverview(true)
    setSelectedId(null)
  }, [open, subscriptions.length])
  useEffect(() => {
    if (selectedId && !subscriptions.some((item) => item.id === selectedId)) {
      setSelectedId(null)
      setShowingOverview(true)
    }
  }, [selectedId, subscriptions])
  const filtered = useMemo(
    () => subscriptions.filter((item) => statusFilter === 'paid' ? item.paymentStatus === 'paid' : statusFilter === 'unpaid' ? item.paymentStatus !== 'paid' : true),
    [statusFilter, subscriptions],
  )
  const paidCount = useMemo(() => subscriptions.filter((item) => item.paymentStatus === 'paid').length, [subscriptions])
  const unpaidCount = subscriptions.length - paidCount
  const handleOverview = useCallback(() => {
    setShowingOverview(true)
    setSelectedId(null)
    setIsAdding(false)
  }, [])
  const handleStartAdding = useCallback(() => {
    setIsAdding(true)
    setShowingOverview(false)
    setSelectedId(null)
  }, [])
  const handleSelectSubscription = useCallback((id: string) => {
    setSelectedId(id)
    setIsAdding(false)
    setShowingOverview(false)
  }, [])
  const create = async (form: FormState) => {
    const created = await onCreateSubscription(toDraft(form))
    setSelectedId(created.id)
    setIsAdding(false)
    setShowingOverview(false)
  }
  const update = useCallback((id: string, form: FormState) => { void onPatchSubscription(id, toDraft(form)) }, [onPatchSubscription])
  const modal =
    open && typeof document !== 'undefined' ? (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(58,55,51,0.45)', backdropFilter: 'blur(6px)', zIndex: 9999 }} onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: paper, borderRadius: 20, width: '90vw', maxWidth: 1320, height: '88vh', maxHeight: 800, boxShadow: '0 32px 80px rgba(58,55,51,0.22), 0 8px 24px rgba(58,55,51,0.10)', border: '1px solid rgba(58,55,51,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: `1px solid ${subtleBorder}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><CreditCard size={16} color="rgba(58,55,51,0.38)" /><div><p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.10em' }}>Monthly</p><h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 500, color: ink }}>Subscriptions</h1></div><span style={{ marginLeft: 4, padding: '4px 10px', borderRadius: 999, background: 'rgba(58,55,51,0.07)', ...inter(11, 500, mutedInk) }}>{subscriptions.length} service{subscriptions.length !== 1 ? 's' : ''}</span></div><button type="button" onClick={onClose} aria-label="Close" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', color: 'rgba(58,55,51,0.40)', cursor: 'pointer' }}><X size={16} /></button></div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}><div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: 370, borderRight: `1px solid ${subtleBorder}`, background: '#FAF8F5' }}><SummaryBar subs={subscriptions} onOverview={handleOverview} showingOverview={showingOverview && !isAdding} /><div style={{ padding: '12px 16px', borderBottom: `1px solid ${subtleBorder}` }}><button type="button" onClick={handleStartAdding} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 18, cursor: 'pointer', border: `1px solid ${isAdding ? 'transparent' : 'rgba(58,55,51,0.10)'}`, background: isAdding ? '#3A3733' : 'rgba(58,55,51,0.07)', ...inter(12, 500, isAdding ? '#F5F3F0' : ink) }}><Plus size={13} /><span>Add subscription</span></button></div>{subscriptions.length ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', borderBottom: `1px solid ${subtleBorder}` }}>{([{ key: 'all', label: `All ${subscriptions.length}` }, { key: 'unpaid', label: `Unpaid ${unpaidCount}` }, { key: 'paid', label: `Paid ${paidCount}` }] as Array<{ key: StatusFilter; label: string }>).map((item) => <button key={item.key} type="button" onClick={() => setStatusFilter(item.key)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', background: statusFilter === item.key ? 'rgba(58,55,51,0.08)' : 'transparent', cursor: 'pointer', ...inter(10, statusFilter === item.key ? 500 : 400, statusFilter === item.key ? ink : mutedInk), letterSpacing: '0.01em' }}>{item.label}</button>)}</div> : null}<div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>{loading ? <LifePanelLoader /> : null}{!loading && !subscriptions.length ? <EmptyList onAdd={handleStartAdding} /> : null}{!loading && subscriptions.length && !filtered.length ? <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.38)'), textAlign: 'center', padding: '32px 0' }}>No {statusFilter} subscriptions</p> : null}{!loading && filtered.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{filtered.map((item) => <SubListItem key={item.id} sub={item} selected={!isAdding && selectedId === item.id} onClick={() => handleSelectSubscription(item.id)} />)}</div> : null}</div>{subscriptions.length ? <div style={{ padding: '12px 20px', borderTop: `1px solid ${subtleBorder}` }}><p style={{ ...inter(10, 400, 'rgba(58,55,51,0.30)'), lineHeight: 1.65 }}>Yearly prices shown as estimated monthly. Currencies listed separately.</p></div> : null}</div><div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{isAdding ? <SubForm key="new" initial={freshForm(subscriptions)} isNew={true} onSave={(form) => void create(form)} onCancel={() => { setIsAdding(false); setShowingOverview(true) }} /> : selected && !showingOverview ? <SubForm key={selected.id} initial={toFormState(selected)} isNew={false} onSave={(form) => update(selected.id, form)} onRemove={() => { onRemoveSubscription(selected.id); setSelectedId(null); setShowingOverview(true) }} /> : <AnnualOverviewPanel subs={subscriptions} usdToCny={usdToCny} onUsdToCnyChange={setUsdToCny} />}</div></div>
        </div>
      </div>
    ) : null

  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: model.previewRows.length === 0 ? 280 : 0, overflow: 'hidden', borderRadius: 24, cursor: 'pointer', background: '#ffffff', border: '1px solid transparent', boxShadow: '0 12px 28px rgba(58, 55, 51, 0.08)' }} onClick={onOpen} aria-label={`${model.stats.activeServices} active subscriptions`}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid rgba(58,55,51,0.07)' }}><div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={13} color="rgba(58,55,51,0.38)" /><span style={{ ...inter(10, 600, 'rgba(58,55,51,0.40)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>{model.stats.reminders > 0 ? <Bell size={10} color="rgba(58,55,51,0.28)" /> : null}</div><h3 style={{ ...playfair(18, 500), lineHeight: 1.2, marginTop: 2 }}>{model.header.title}</h3>{subscriptions.length > 0 ? <p style={{ ...inter(20, 600), letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>{model.monthlyTotalLabel.replace(' /mo', '')}<span style={{ ...inter(12, 400, 'rgba(58,55,51,0.40)'), marginLeft: 3 }}>/mo</span></p> : null}</div><div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'rgba(58,55,51,0.38)', marginTop: 2 }}><ChevronRight size={15} /></div></div>
        <div style={{ flex: 1, padding: '0 20px' }}>
          {loading ? <LifeCardLoader compact /> : model.previewRows.length === 0 ? <div style={{ display: 'flex', minHeight: 172, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center' }}><div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={20} color="rgba(58,55,51,0.30)" /></div><p style={{ ...playfair(14, 500), marginBottom: 6 }}>Track recurring services</p><p style={{ ...inter(12, 400, mutedInk), lineHeight: 1.65, maxWidth: 220, marginBottom: 18 }}>Save monthly and yearly subscriptions in one place.</p><button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, border: '1px solid rgba(58,55,51,0.12)', background: 'rgba(58,55,51,0.07)', color: '#3A3733', padding: '6px 12px', cursor: 'pointer', ...inter(11, 500), letterSpacing: '0.03em' }}><Plus size={11} /><span>Add subscription</span></button></div> : <div>{model.previewRows.map((sub, index) => <div key={sub.id}><div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}><div style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: sub.color, boxShadow: `0 0 0 2px ${sub.color}22` }} /><div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>{sub.emoji ? <span style={{ fontSize: 13, lineHeight: 1 }}>{sub.emoji}</span> : null}<p style={{ ...inter(13, 400), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</p>{sub.dueSoonLabel ? <span style={{ flexShrink: 0, borderRadius: 4, border: '1px solid rgba(232,168,95,0.30)', background: 'rgba(232,168,95,0.18)', padding: '1px 5px', ...inter(9, 600, '#B87830'), letterSpacing: '0.04em' }}>{sub.dueSoonLabel}</span> : null}</div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}><div style={{ width: 6, height: 6, borderRadius: 999, background: sub.isPaid ? '#6EAB7A' : 'rgba(58,55,51,0.18)' }} /><p style={{ ...inter(12, 400, 'rgba(58,55,51,0.50)'), letterSpacing: '0.02em' }}>{sub.priceLabel}</p></div></div>{index < model.previewRows.length - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.05)' }} /> : null}</div>)}{subscriptions.length > 3 ? <div style={{ padding: '8px 0', borderTop: '1px solid rgba(58,55,51,0.05)', textAlign: 'center', ...inter(11, 400, 'rgba(58,55,51,0.35)') }}>+{subscriptions.length - 3} more service{subscriptions.length - 3 > 1 ? 's' : ''}</div> : null}</div>}
        </div>
        {model.previewRows.length > 0 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginTop: 'auto', borderTop: '1px solid rgba(58,55,51,0.07)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{subscriptions.slice(0, 7).map((item) => <div key={item.id} style={{ width: 7, height: 7, borderRadius: 999, background: item.color ?? '#D4A06A' }} />)}{subscriptions.length > 7 ? <span style={inter(9, 400, 'rgba(58,55,51,0.38)')}>+{subscriptions.length - 7}</span> : null}</div><span style={inter(11, 400, 'rgba(58,55,51,0.50)')}><span style={inter(11, 600, '#3A3733')}>{paidCount}</span>/{subscriptions.length} paid</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{model.stats.dueSoon > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, border: '1px solid rgba(232,168,95,0.25)', background: 'rgba(232,168,95,0.15)', padding: '3px 8px', ...inter(10, 500, '#B87830') }}><Bell size={9} />{model.stats.dueSoon} due soon</span> : null}<button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: '#3A3733', cursor: 'pointer', padding: 0, ...inter(11, 400) }}><Plus size={11} /><span>Manage</span></button></div></div> : null}
      </div>

      {modal ? createPortal(modal, document.body) : null}
    </>
  )
}
