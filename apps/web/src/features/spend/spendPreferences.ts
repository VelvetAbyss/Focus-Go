import type { CurrencyCode } from '../../shared/prefs/preferences'
import { currencyToSymbol } from '../../lib/currency'
import { getAuth } from '../../store/auth'

export type FixedExpense = { id: string; name: string; amount: number; currency: CurrencyCode }

export function spendPreferenceScope() {
  const id: unknown = getAuth()?.user?.id
  return typeof id === 'string' ? `account:${encodeURIComponent(id)}` : 'guest'
}

export function currencyLabel(code: string, zh: boolean) {
  if (code === 'CNY') return zh ? '人民币 CNY' : 'Chinese yuan CNY'
  if (code === 'USD') return zh ? '美元 USD' : 'US dollars USD'
  return code
}

export function formatSpendMoney(amount: number, currency: string, locale: string) {
  const value = amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const symbol = currencyToSymbol(currency)
  return `${symbol}${symbol.length === 1 ? '' : ' '}${value}`
}

export function readSpendSummaryCurrency(scope: string): CurrencyCode | null {
  try {
    const value = localStorage.getItem(`focusgo.spend.summaryCurrency.${scope}`)
    return value === 'CNY' || value === 'USD' ? value : null
  } catch {
    return null
  }
}

export function writeSpendSummaryCurrency(scope: string, currency: CurrencyCode) {
  try { localStorage.setItem(`focusgo.spend.summaryCurrency.${scope}`, currency) } catch { /* Keep the selection for this session. */ }
}

export function readFixedExpenses(scope: string): FixedExpense[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`focusgo.spend.dailyFixed.${scope}`) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter((entry): entry is FixedExpense =>
      entry != null && typeof entry.id === 'string' && typeof entry.name === 'string' &&
      Number.isFinite(entry.amount) && entry.amount > 0 && (entry.currency === 'CNY' || entry.currency === 'USD'))
  } catch {
    return []
  }
}

export function writeFixedExpenses(scope: string, items: FixedExpense[]) {
  localStorage.setItem(`focusgo.spend.dailyFixed.${scope}`, JSON.stringify(items))
}
