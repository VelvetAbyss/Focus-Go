import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, InputHTMLAttributes, ReactNode } from 'react'
import { Icon } from '@iconify/react'
import Dialog from '../../../shared/ui/Dialog'
import { Bell, BellOff, CalendarDays, CheckCheck, ChevronRight, CreditCard, LayoutGrid, Plus, Trash2, X } from 'lucide-react'
import type { LifeSubscription } from '../../../data/models/types'
import type { SubscriptionDraft } from '../cards/SubscriptionsCard'
import { getBillingNotice, type SubscriptionPresentationModel } from '../cards/lifeDesignAdapters'
import { LifeCardLoader, LifePanelLoader } from './lifeDesignPrimitives'
import { useLifeI18n, type LifeTranslate } from '../lifeI18n'

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

const paper = 'var(--bg-elevated)'
const ink = 'var(--text-primary)'
const subtleBorder = 'color-mix(in srgb, var(--text-primary) 9%, transparent)'
const mutedInk = 'color-mix(in srgb, var(--text-primary) 45%, transparent)'
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
const categoryLabel = (id: string, t: LifeTranslate) =>
  ({
    entertainment: t('life.subscriptions.entertainment'),
    music: t('life.subscriptions.music'),
    productivity: t('life.subscriptions.productivity'),
    cloud: t('life.subscriptions.cloud'),
    learning: t('life.subscriptions.learning'),
    health: t('life.subscriptions.health'),
    security: t('life.subscriptions.security'),
    developer: t('life.subscriptions.developer'),
    news: t('life.subscriptions.news'),
    other: t('life.subscriptions.other'),
  })[id] ?? t('life.subscriptions.other')

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
const formatBillingDate = (date: Date) => date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
const isIconifyIcon = (icon?: string) => Boolean(icon && /^[a-z0-9-]+:[a-z0-9_.-]+$/i.test(icon))
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
  background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
  border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)',
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
        event.currentTarget.style.borderColor = 'color-mix(in srgb, var(--text-primary) 22%, transparent)'
        event.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 6%, transparent)'
        props.onFocus?.(event)
      }}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = 'color-mix(in srgb, var(--text-primary) 10%, transparent)'
        event.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary) 4%, transparent)'
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

function SubIcon({ icon, size = 14 }: { icon?: string; size?: number }) {
  if (!isIconifyIcon(icon)) return null
  return <Icon icon={icon as string} width={size} height={size} style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', opacity: 0.75 }} aria-hidden />
}

function ToggleGroup<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: 2, borderRadius: 10, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
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
              border: active ? '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)' : '1px solid transparent',
              background: active ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'transparent',
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
    <button type="button" onClick={() => onChange(!value)} style={{ position: 'relative', width: 36, height: 20, borderRadius: 999, border: 'none', background: value ? 'var(--text-primary)' : 'color-mix(in srgb, var(--text-primary) 15%, transparent)', cursor: 'pointer' }}>
      <div style={{ position: 'absolute', top: 2, left: value ? 'calc(100% - 18px)' : 2, width: 16, height: 16, borderRadius: 999, background: 'var(--bg-elevated)', boxShadow: '0 1px 3px rgba(0,0,0,0.18)', transition: 'all 0.2s ease' }} />
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
  const { t } = useLifeI18n()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {CATEGORIES.map((category) => {
        const active = value === category.id
        return (
          <button key={category.id} type="button" onClick={() => onChange(active ? '' : category.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, cursor: 'pointer', background: active ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: `1px solid ${active ? 'color-mix(in srgb, var(--text-primary) 18%, transparent)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}`, ...inter(11, active ? 500 : 400, active ? ink : mutedInk) }}>
            <span style={{ fontSize: 12 }}>{category.emoji}</span>
            <span>{categoryLabel(category.id, t)}</span>
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
            <div title={value > 0 ? formatAmount(value) : ''} style={{ width: '100%', height: value > 0 ? `${Math.max((value / max) * 90, 6)}px` : '4px', borderRadius: 2, background: index === CURRENT_MONTH ? color : index < CURRENT_MONTH ? (value > 0 ? `${color}88` : 'color-mix(in srgb, var(--text-primary) 6%, transparent)') : (value > 0 ? `${color}38` : 'color-mix(in srgb, var(--text-primary) 4%, transparent)') }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 6 }}>
        {MONTHS.map((month, index) => (
          <div key={month} style={{ flex: 1, textAlign: 'center', ...inter(8, index === CURRENT_MONTH ? 600 : 400, index === CURRENT_MONTH ? ink : 'color-mix(in srgb, var(--text-primary) 28%, transparent)') }}>{month[0]}</div>
        ))}
      </div>
    </div>
  )
})

const AnnualOverviewPanel = memo(function AnnualOverviewPanel({ subs, usdToCny, onUsdToCnyChange }: { subs: LifeSubscription[]; usdToCny: number; onUsdToCnyChange: (value: number) => void }) {
  const { t } = useLifeI18n()
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
        .map((item) => ({ item, notice: getBillingNotice(item) }))
        .filter((entry) => entry.notice !== null)
        .sort((a, b) => (a.notice?.days ?? 0) - (b.notice?.days ?? 0)),
    [subs],
  )

  if (!subs.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 18, marginBottom: 20, background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)', border: `1px solid ${subtleBorder}` }}>
          <LayoutGrid size={20} color="color-mix(in srgb, var(--text-primary) 22%, transparent)" />
        </div>
        <p style={{ ...playfair(17, 500, 'color-mix(in srgb, var(--text-primary) 45%, transparent)'), marginBottom: 6 }}>{t('life.subscriptions.noDataYet')}</p>
        <p style={{ ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 35%, transparent)'), lineHeight: 1.65 }}>{t('life.subscriptions.addToSeeOverview')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ padding: '36px 40px 28px', borderBottom: `1px solid ${subtleBorder}` }}>
        <p style={{ ...inter(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.10em' }}>{t('life.subscriptions.annualOverview', { year: 2026 })}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 48, flexWrap: 'wrap' }}>
          {annuals.USD > 0 ? <div><p style={{ ...inter(28, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>${formatAmount(annuals.USD)}<span style={{ ...inter(13, 400, mutedInk), marginLeft: 4 }}>/yr</span></p><p style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), marginTop: 8 }}>USD · annual</p></div> : null}
          {annuals.CNY > 0 ? <div><p style={{ ...inter(28, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>¥{formatAmount(annuals.CNY)}<span style={{ ...inter(13, 400, mutedInk), marginLeft: 4 }}>/yr</span></p><p style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), marginTop: 8 }}>CNY · annual</p></div> : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', padding: '24px 40px', borderBottom: `1px solid ${subtleBorder}`, background: 'color-mix(in srgb, var(--text-primary) 1.8%, transparent)' }}>
        <div>
          <p style={{ ...inter(10, 500, mutedInk), marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('life.subscriptions.exchangeRate')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={inter(13, 400, ink)}>1 USD =</span>
            <div style={{ width: 140 }}><StyledInput type="number" min="0" step="0.01" value={usdToCny} onChange={(event) => onUsdToCnyChange(parseFloat(event.target.value) || 7.25)} style={{ textAlign: 'center', padding: '8px 10px' }} /></div>
            <span style={inter(13, 400, ink)}>CNY</span>
          </div>
        </div>
        {annuals.USD > 0 && annuals.CNY > 0 ? <div style={{ textAlign: 'right' }}><p style={{ ...inter(10, 500, mutedInk), marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('life.subscriptions.unifiedEstimate')}</p><p style={{ ...inter(18, 600, ink), letterSpacing: '-0.01em' }}>≈ ¥{formatAmount(annuals.USD * usdToCny + annuals.CNY)}<span style={{ ...inter(11, 400, mutedInk), marginLeft: 3 }}>/yr</span></p><p style={{ ...inter(10, 400, 'color-mix(in srgb, var(--text-primary) 32%, transparent)'), marginTop: 4 }}>≈ ¥{formatAmount((annuals.USD * usdToCny + annuals.CNY) / 12)}/mo</p></div> : null}
      </div>
      <div style={{ padding: '28px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
        <p style={{ ...inter(11, 500, mutedInk), marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('life.subscriptions.monthlyBurden')}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {annuals.USD > 0 ? <MonthlyChart data={breakdown.USD} color="var(--text-primary)" label="USD (monthly spend)" /> : null}
          {annuals.CNY > 0 ? <MonthlyChart data={breakdown.CNY} color="#E8A85F" label="CNY (monthly spend)" /> : null}
        </div>
      </div>
      {categoryRows.length ? <div style={{ padding: '28px 40px', borderBottom: `1px solid ${subtleBorder}` }}><p style={{ ...inter(11, 500, mutedInk), marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('life.subscriptions.byCategoryAnnual')}</p><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{categoryRows.map((row) => <div key={row.category.id}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 14 }}>{row.category.emoji}</span><span style={inter(12, 400, ink)}>{categoryLabel(row.category.id, t)}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{row.byCurrency.USD ? <span style={inter(11, 500, 'color-mix(in srgb, var(--text-primary) 60%, transparent)')}>${formatAmount(row.byCurrency.USD)}/yr</span> : null}{row.byCurrency.CNY ? <span style={inter(11, 500, 'color-mix(in srgb, var(--text-primary) 60%, transparent)')}>¥{formatAmount(row.byCurrency.CNY)}/yr</span> : null}</div></div><div style={{ height: 4, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)' }}><div style={{ width: `${(row.unified / maxCategory) * 100}%`, height: '100%', borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 35%, transparent)' }} /></div></div>)}</div></div> : null}
      {upcoming.length ? <div style={{ padding: '28px 40px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Bell size={13} color="#B87830" /><p style={{ ...inter(11, 500, '#B87830'), textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t('life.subscriptions.dueWithinDays', { count: 7 })}</p></div><div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{upcoming.map(({ item, notice }) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, background: 'rgba(232,168,95,0.08)', border: '1px solid rgba(232,168,95,0.20)' }}>{item.emoji ? <SubIcon icon={item.emoji} size={16} /> : null}<div style={{ flex: 1, minWidth: 0 }}><p style={{ ...inter(13, 500, ink), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p><p style={inter(11, 400, 'color-mix(in srgb, var(--text-primary) 50%, transparent)')}>{CURRENCY_SYMBOL[item.currency]}{formatAmount(item.amount)}/{item.cycle === 'monthly' ? 'mo' : 'yr'} · {notice ? formatBillingDate(notice.date) : ''}</p></div><span style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(232,168,95,0.30)', background: 'rgba(232,168,95,0.18)', ...inter(10, 600, '#B87830') }}>{notice?.days === 0 ? t('life.subscriptions.today') : t('life.subscriptions.inDays', { count: notice?.days ?? 0 })}</span></div>)}</div></div> : null}
    </div>
  )
})

const SubListItem = memo(function SubListItem({ sub, selected, onClick }: { sub: LifeSubscription; selected: boolean; onClick: () => void }) {
  const { t } = useLifeI18n()
  const notice = getBillingNotice(sub)
  return (
    <button type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, textAlign: 'left', cursor: 'pointer', border: selected ? '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)' : '1px solid transparent', background: selected ? 'color-mix(in srgb, var(--text-primary) 6%, transparent)' : 'transparent' }}>
      {isIconifyIcon(sub.emoji) ? <SubIcon icon={sub.emoji} size={20} /> : <div style={{ width: 10, height: 10, borderRadius: 999, flexShrink: 0, background: sub.color ?? '#D4A06A', boxShadow: `0 0 0 2px ${(sub.color ?? '#D4A06A')}22` }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <p style={{ ...inter(13, 400, ink), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</p>
          {notice ? <span style={{ padding: '1px 4px', borderRadius: 4, background: 'rgba(232,168,95,0.18)', ...inter(8, 600, '#B87830') }}>{notice.days}d</span> : null}
        </div>
        <p style={{ ...inter(11, 400, mutedInk), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{CURRENCY_SYMBOL[sub.currency]}{formatAmount(sub.amount)}/{sub.cycle === 'monthly' ? 'mo' : 'yr'}{sub.category ? ` · ${CATEGORIES.find((item) => item.id === sub.category)?.emoji ?? ''} ${categoryLabel(sub.category, t)}` : ''}</p>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: sub.paymentStatus === 'paid' ? '#6EAB7A' : 'color-mix(in srgb, var(--text-primary) 18%, transparent)' }} />
        <p style={inter(11, 500, 'color-mix(in srgb, var(--text-primary) 55%, transparent)')}>{CURRENCY_SYMBOL[sub.currency]}{formatAmount(monthlyAmount(sub))}</p>
        <p style={inter(9, 400, 'color-mix(in srgb, var(--text-primary) 28%, transparent)')}>{sub.cycle === 'yearly' ? '/mo est.' : '/mo'}</p>
      </div>
    </button>
  )
})

const SummaryBar = memo(function SummaryBar({ subs, onOverview, showingOverview }: { subs: LifeSubscription[]; onOverview: () => void; showingOverview: boolean }) {
  const { t } = useLifeI18n()
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
        <p style={{ ...inter(10, 500, mutedInk), textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('life.subscriptions.monthlyTotal')}</p>
        <button type="button" onClick={onOverview} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, cursor: 'pointer', background: showingOverview ? 'color-mix(in srgb, var(--text-primary) 10%, transparent)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)', border: `1px solid ${showingOverview ? 'color-mix(in srgb, var(--text-primary) 18%, transparent)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}`, ...inter(9, 500, showingOverview ? ink : mutedInk), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <LayoutGrid size={9} />
          <span>{t('life.subscriptions.overview')}</span>
        </button>
      </div>
      {subs.length ? <><p style={{ ...inter(22, 600, ink), letterSpacing: '-0.02em', lineHeight: 1 }}>{totalLabel}<span style={{ ...inter(12, 400, mutedInk), marginLeft: 4 }}>/mo</span></p><p style={{ ...inter(10, 400, 'color-mix(in srgb, var(--text-primary) 35%, transparent)'), marginTop: 8 }}>{annualLabel} total</p></> : <p style={inter(13, 400, 'color-mix(in srgb, var(--text-primary) 35%, transparent)')}>{t('life.subscriptions.noTrackedYet')}</p>}
    </div>
  )
})

function EmptyList({ onAdd }: { onAdd: () => void }) {
  const { t } = useLifeI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 999, marginBottom: 16, background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }}><CreditCard size={18} color="color-mix(in srgb, var(--text-primary) 22%, transparent)" /></div>
      <p style={{ ...playfair(15, 500, 'color-mix(in srgb, var(--text-primary) 55%, transparent)'), marginBottom: 6 }}>{t('life.subscriptions.emptyListTitle')}</p>
      <p style={{ ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), lineHeight: 1.65, marginBottom: 16 }}>{t('life.subscriptions.emptyListDescription')}</p>
      <button type="button" onClick={onAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 999, cursor: 'pointer', background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)', ...inter(12, 500, ink) }}><Plus size={12} /><span>{t('life.subscriptions.addSubscription')}</span></button>
    </div>
  )
}

function SubForm({ initial, isNew, onSave, onRemove, onCancel }: { initial: FormState; isNew: boolean; onSave: (form: FormState) => void; onRemove?: () => void; onCancel?: () => void }) {
  const { t } = useLifeI18n()
  const [form, setForm] = useState(initial)
  const [iconResults, setIconResults] = useState<string[]>([])
  const [iconSearching, setIconSearching] = useState(false)
  const savedInitialRef = useRef(initial)
  const latestName = useRef(form.name)
  useEffect(() => {
    if (!isNew && form !== savedInitialRef.current) onSave(form)
  }, [form, isNew, onSave])
  useEffect(() => {
    const name = form.name.trim()
    latestName.current = name
    if (!name) { setIconResults([]); setIconSearching(false); return }
    setIconSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(name)}&limit=16`)
        const data = await res.json() as { icons?: string[] }
        if (latestName.current === name) setIconResults(data.icons ?? [])
      } catch { /* ignore */ } finally {
        if (latestName.current === name) setIconSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [form.name])
  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value })), [])
  const parsedAmount = parseFloat(form.amount) || 0
  const monthly = form.cycle === 'yearly' ? parsedAmount / 12 : parsedAmount
  const categoryInfo = CATEGORIES.find((item) => item.id === form.category)
  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '32px 40px', borderBottom: `1px solid ${subtleBorder}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: `${form.color}1A`, border: `1.5px solid ${form.color}44` }}>{isIconifyIcon(form.emoji) ? <SubIcon icon={form.emoji} size={28} /> : <div style={{ width: 20, height: 20, borderRadius: 999, background: form.color }} />}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ ...playfair(19, 500), lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.name || (isNew ? t('life.subscriptions.newSubscription') : '—')}</p>
          {parsedAmount > 0 ? <p style={{ ...inter(13, 400, mutedInk), marginTop: 4 }}>{CURRENCY_SYMBOL[form.currency]}{formatAmount(monthly)}/mo{form.cycle === 'yearly' ? <span style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginLeft: 6 }}>{t('life.subscriptions.estFromYearly', { amount: `${CURRENCY_SYMBOL[form.currency]}${formatAmount(parsedAmount)}` })}</span> : null}</p> : null}
          {categoryInfo ? <p style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), marginTop: 4 }}>{categoryInfo.emoji} {categoryLabel(categoryInfo.id, t)}</p> : null}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '28px 40px' }}>
        <section><p style={{ ...inter(9, 600, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('life.subscriptions.basics')}</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><InputField label={t('life.subscriptions.serviceName')}><StyledInput value={form.name} onChange={(event) => update('name', event.target.value)} placeholder={t('life.subscriptions.serviceNamePlaceholder')} /></InputField><div style={{ display: 'flex', gap: 16 }}><div style={{ flex: 1 }}><InputField label={t('life.subscriptions.amount')}><div style={{ position: 'relative' }}><span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', ...inter(14, 500, 'color-mix(in srgb, var(--text-primary) 45%, transparent)') }}>{CURRENCY_SYMBOL[form.currency]}</span><StyledInput type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} placeholder="0.00" style={{ paddingLeft: 28 }} /></div></InputField></div><div style={{ width: 140 }}><InputField label={t('life.subscriptions.currency')}><ToggleGroup<Currency> options={[{ value: 'USD', label: '$ USD' }, { value: 'CNY', label: '¥ CNY' }]} value={form.currency} onChange={(value) => update('currency', value)} /></InputField></div></div><InputField label={t('life.subscriptions.billingCycle')}><ToggleGroup<BillingCycle> options={[{ value: 'monthly', label: t('life.subscriptions.monthly') }, { value: 'yearly', label: t('life.subscriptions.yearly') }]} value={form.cycle} onChange={(value) => update('cycle', value)} />{form.cycle === 'yearly' && parsedAmount > 0 ? <p style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), marginTop: 8 }}>≈ {CURRENCY_SYMBOL[form.currency]}{formatAmount(monthly)} {t('life.subscriptions.perMonth')}</p> : null}</InputField></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('life.subscriptions.category')}</p><CategoryPicker value={form.category} onChange={(value) => update('category', value)} /></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('life.subscriptions.schedule')}</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div style={{ display: 'flex', gap: 16 }}><div style={{ flex: 1 }}><InputField label={t('life.subscriptions.billingDay')}><div style={{ position: 'relative' }}><CalendarDays size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'color-mix(in srgb, var(--text-primary) 35%, transparent)' }} /><StyledInput type="number" min="1" max="31" value={form.billingDay} onChange={(event) => update('billingDay', event.target.value)} placeholder={t('life.subscriptions.billingDayPlaceholder')} style={{ paddingLeft: 30 }} /></div></InputField></div>{form.cycle === 'yearly' ? <div style={{ flex: 1 }}><InputField label={t('life.subscriptions.billingMonth')}><StyledInput type="number" min="1" max="12" value={form.billingMonth} onChange={(event) => update('billingMonth', event.target.value)} placeholder={t('life.subscriptions.billingMonthPlaceholder')} /></InputField></div> : null}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 16, background: 'color-mix(in srgb, var(--text-primary) 3%, transparent)', border: `1px solid ${subtleBorder}` }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{form.reminder ? <Bell size={14} color={ink} /> : <BellOff size={14} color="color-mix(in srgb, var(--text-primary) 35%, transparent)" />}<span style={inter(13, 400, form.reminder ? ink : 'color-mix(in srgb, var(--text-primary) 50%, transparent)')}>{form.reminder ? t('life.subscriptions.reminderOn') : t('life.subscriptions.noReminder')}</span></div><ToggleSwitch value={form.reminder} onChange={(value) => update('reminder', value)} /></div></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('life.subscriptions.appearance')}</p><div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><InputField label={t('life.subscriptions.icon')}>{!form.name.trim() ? <p style={inter(11, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)')}>{t('life.subscriptions.iconSearchHint')}</p> : iconSearching ? <p style={inter(11, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)')}>{t('life.subscriptions.iconSearching')}</p> : iconResults.length > 0 ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{iconResults.map((icon) => <button key={icon} type="button" title={icon} onClick={() => update('emoji', form.emoji === icon ? '' : icon)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: 'none', cursor: 'pointer', background: form.emoji === icon ? 'color-mix(in srgb, var(--text-primary) 12%, transparent)' : 'color-mix(in srgb, var(--text-primary) 5%, transparent)', boxShadow: form.emoji === icon ? '0 0 0 1.5px color-mix(in srgb, var(--text-primary) 30%, transparent)' : 'none' }}><Icon icon={icon} width={20} height={20} /></button>)}</div> : <p style={inter(11, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)')}>{t('life.subscriptions.noIconsFound')}</p>}</InputField><InputField label={t('life.subscriptions.colour')}><ColorPicker value={form.color} onChange={(value) => update('color', value)} /></InputField></div></section>
        <div style={{ height: 1, background: subtleBorder }} />
        <section><p style={{ ...inter(9, 600, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{t('life.subscriptions.paymentStatus')}</p><ToggleGroup<PaymentStatus> options={[{ value: 'unpaid', label: t('life.subscriptions.unpaid') }, { value: 'paid', label: t('life.subscriptions.paid') }]} value={form.paymentStatus} onChange={(value) => update('paymentStatus', value)} /><p style={{ ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), marginTop: 8 }}>{t('life.subscriptions.paymentStatusHint')}</p></section>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 40px', marginTop: 'auto', borderTop: `1px solid ${subtleBorder}` }}>
        {isNew ? <><button type="button" onClick={onCancel} style={{ padding: '6px 16px', borderRadius: 10, cursor: 'pointer', background: 'transparent', border: '1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)', ...inter(12, 400, mutedInk) }}>{t('life.subscriptions.cancel')}</button><button type="button" onClick={() => { if (form.name.trim() && parsedAmount > 0) onSave(form) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 12, cursor: 'pointer', border: 'none', background: form.name.trim() && parsedAmount > 0 ? 'var(--text-primary)' : 'color-mix(in srgb, var(--text-primary) 18%, transparent)', ...inter(13, 500, 'var(--bg-elevated)') }}><Plus size={14} /><span>{t('life.subscriptions.addSubscription')}</span></button></> : <><button type="button" onClick={onRemove} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 10, cursor: 'pointer', border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)', background: 'transparent', ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 35%, transparent)') }}><Trash2 size={12} /><span>{t('life.subscriptions.remove')}</span></button><div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)') }}><CheckCheck size={12} /><span>{t('life.subscriptions.autoSaved')}</span></div></>}
      </div>
    </div>
  )
}

export const SubscriptionCardSurface = ({ model, subscriptions, open, loading, onOpen, onClose, onCreateSubscription, onPatchSubscription, onRemoveSubscription }: Props) => {
  const { t } = useLifeI18n()
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
  return (
    <>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: model.previewRows.length === 0 ? 280 : 0, overflow: 'hidden', borderRadius: 24, cursor: 'pointer', background: 'var(--bg-elevated)', border: '1px solid transparent', boxShadow: 'var(--shadow-card)' }} onClick={onOpen} aria-label={`${model.stats.activeServices} active subscriptions`}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}><div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CreditCard size={13} color="color-mix(in srgb, var(--text-primary) 38%, transparent)" /><span style={{ ...inter(10, 600, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>{model.stats.reminders > 0 ? <Bell size={10} color="color-mix(in srgb, var(--text-primary) 28%, transparent)" /> : null}</div><h3 style={{ ...playfair(18, 500), lineHeight: 1.2, marginTop: 2 }}>{model.header.title}</h3>{subscriptions.length > 0 ? <p style={{ ...inter(20, 600), letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>{model.monthlyTotalLabel.replace(' /mo', '')}<span style={{ ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 40%, transparent)'), marginLeft: 3 }}>/mo</span></p> : null}</div><div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'color-mix(in srgb, var(--text-primary) 38%, transparent)', marginTop: 2 }}><ChevronRight size={15} /></div></div>
        <div style={{ flex: 1, padding: '0 20px' }}>
          {loading ? <LifeCardLoader compact /> : model.previewRows.length === 0 ? <div style={{ display: 'flex', minHeight: 172, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center' }}><div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={20} color="color-mix(in srgb, var(--text-primary) 30%, transparent)" /></div><p style={{ ...playfair(14, 500), marginBottom: 6 }}>{t('life.subscriptions.trackRecurring')}</p><p style={{ ...inter(12, 400, mutedInk), lineHeight: 1.65, maxWidth: 220, marginBottom: 18 }}>{t('life.subscriptions.emptyDescription')}</p><button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, border: '1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)', background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)', color: 'var(--text-primary)', padding: '6px 12px', cursor: 'pointer', ...inter(11, 500), letterSpacing: '0.03em' }}><Plus size={11} /><span>{t('life.subscriptions.addSubscription')}</span></button></div> : <div>{model.previewRows.map((sub, index) => <div key={sub.id}><div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}><div style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: sub.color, boxShadow: `0 0 0 2px ${sub.color}22` }} /><div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 8 }}>{sub.emoji ? <SubIcon icon={sub.emoji} size={14} /> : null}<p style={{ ...inter(13, 400), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</p>{sub.dueSoonLabel ? <span style={{ flexShrink: 0, borderRadius: 4, border: '1px solid rgba(232,168,95,0.30)', background: 'rgba(232,168,95,0.18)', padding: '1px 5px', ...inter(9, 600, '#B87830'), letterSpacing: '0.04em' }}>{sub.dueSoonLabel}</span> : null}</div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}><div style={{ width: 6, height: 6, borderRadius: 999, background: sub.isPaid ? '#6EAB7A' : 'color-mix(in srgb, var(--text-primary) 18%, transparent)' }} /><p style={{ ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 50%, transparent)'), letterSpacing: '0.02em' }}>{sub.priceLabel}</p></div></div>{index < model.previewRows.length - 1 ? <div style={{ height: 1, background: 'color-mix(in srgb, var(--text-primary) 5%, transparent)' }} /> : null}</div>)}{subscriptions.length > 3 ? <div style={{ padding: '8px 0', borderTop: '1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)', textAlign: 'center', ...inter(11, 400, 'color-mix(in srgb, var(--text-primary) 35%, transparent)') }}>{t('life.subscriptions.moreServices', { count: subscriptions.length - 3 })}</div> : null}</div>}
        </div>
        {model.previewRows.length > 0 ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', marginTop: 'auto', borderTop: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{subscriptions.slice(0, 7).map((item) => <div key={item.id} style={{ width: 7, height: 7, borderRadius: 999, background: item.color ?? '#D4A06A' }} />)}{subscriptions.length > 7 ? <span style={inter(9, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)')}>+{subscriptions.length - 7}</span> : null}</div><span style={inter(11, 400, 'color-mix(in srgb, var(--text-primary) 50%, transparent)')}>{t('life.subscriptions.paidSummary', { paid: paidCount, total: subscriptions.length })}</span></div><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>{model.stats.dueSoon > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, border: '1px solid rgba(232,168,95,0.25)', background: 'rgba(232,168,95,0.15)', padding: '3px 8px', ...inter(10, 500, '#B87830') }}><Bell size={9} />{t('life.subscriptions.dueSoon', { count: model.stats.dueSoon })}</span> : null}<button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', padding: 0, ...inter(11, 400) }}><Plus size={11} /><span>{t('life.subscriptions.manage')}</span></button></div></div> : null}
      </div>

      {open ? <Dialog
        open={open}
        onClose={onClose}
        panelClassName="life-modal__panel"
        contentClassName="life-modal__content"
        panelStyle={{ width: 'min(1320px, 90vw)', height: 'min(800px, 88vh)', background: paper }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 32px', borderBottom: `1px solid ${subtleBorder}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CreditCard size={16} color="color-mix(in srgb, var(--text-primary) 38%, transparent)" />
              <div>
                <p style={{ ...inter(10, 600, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.10em' }}>{t('life.subscriptions.monthly')}</p>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, fontWeight: 500, color: ink }}>{t('life.card.subscriptions')}</h1>
              </div>
              <span style={{ marginLeft: 4, padding: '4px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 7%, transparent)', ...inter(11, 500, mutedInk) }}>{t('life.subscriptions.servicesCount', { count: subscriptions.length })}</span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('life.subscriptions.close')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', color: 'color-mix(in srgb, var(--text-primary) 40%, transparent)', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: 370, borderRight: `1px solid ${subtleBorder}`, background: 'var(--bg-muted)' }}>
              <SummaryBar subs={subscriptions} onOverview={handleOverview} showingOverview={showingOverview && !isAdding} />
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${subtleBorder}` }}>
                <button type="button" onClick={handleStartAdding} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', borderRadius: 18, cursor: 'pointer', border: `1px solid ${isAdding ? 'transparent' : 'color-mix(in srgb, var(--text-primary) 10%, transparent)'}`, background: isAdding ? 'var(--text-primary)' : 'color-mix(in srgb, var(--text-primary) 7%, transparent)', ...inter(12, 500, isAdding ? 'var(--bg-elevated)' : ink) }}><Plus size={13} /><span>{t('life.subscriptions.addSubscription')}</span></button>
              </div>
              {subscriptions.length ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', borderBottom: `1px solid ${subtleBorder}` }}>{([{ key: 'all', label: t('life.subscriptions.allCount', { count: subscriptions.length }) }, { key: 'unpaid', label: t('life.subscriptions.unpaidCount', { count: unpaidCount }) }, { key: 'paid', label: t('life.subscriptions.paidCount', { count: paidCount }) }] as Array<{ key: StatusFilter; label: string }>).map((item) => <button key={item.key} type="button" onClick={() => setStatusFilter(item.key)} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', background: statusFilter === item.key ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent', cursor: 'pointer', ...inter(10, statusFilter === item.key ? 500 : 400, statusFilter === item.key ? ink : mutedInk), letterSpacing: '0.01em' }}>{item.label}</button>)}</div> : null}
              <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {loading ? <LifePanelLoader /> : null}
                {!loading && !subscriptions.length ? <EmptyList onAdd={handleStartAdding} /> : null}
                {!loading && subscriptions.length && !filtered.length ? <p style={{ ...inter(12, 400, 'color-mix(in srgb, var(--text-primary) 38%, transparent)'), textAlign: 'center', padding: '32px 0' }}>{t('life.subscriptions.noFiltered', { status: statusFilter === 'paid' ? t('life.subscriptions.paid') : statusFilter === 'unpaid' ? t('life.subscriptions.unpaid') : t('life.subscriptions.allCount', { count: 0 }) })}</p> : null}
                {!loading && filtered.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{filtered.map((item) => <SubListItem key={item.id} sub={item} selected={!isAdding && selectedId === item.id} onClick={() => handleSelectSubscription(item.id)} />)}</div> : null}
              </div>
              {subscriptions.length ? <div style={{ padding: '12px 20px', borderTop: `1px solid ${subtleBorder}` }}><p style={{ ...inter(10, 400, 'color-mix(in srgb, var(--text-primary) 30%, transparent)'), lineHeight: 1.65 }}>{t('life.subscriptions.yearlyHint')}</p></div> : null}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowX: 'hidden', overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', display: 'flex', flexDirection: 'column' }}>
              {isAdding ? <SubForm key="new" initial={freshForm(subscriptions)} isNew={true} onSave={(form) => void create(form)} onCancel={() => { setIsAdding(false); setShowingOverview(true) }} /> : selected && !showingOverview ? <SubForm key={selected.id} initial={toFormState(selected)} isNew={false} onSave={(form) => update(selected.id, form)} onRemove={() => { onRemoveSubscription(selected.id); setSelectedId(null); setShowingOverview(true) }} /> : <AnnualOverviewPanel subs={subscriptions} usdToCny={usdToCny} onUsdToCnyChange={setUsdToCny} />}
            </div>
          </div>
        </div>
      </Dialog> : null}
    </>
  )
}
