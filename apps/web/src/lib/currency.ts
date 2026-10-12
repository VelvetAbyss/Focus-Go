import { liveCnyPer } from '../shared/fx/fxRates'

export const EXCHANGE_RATES: Record<string, number> = {
  USD: 7.2,
  CNY: 1,
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
}

export const currencyToSymbol = (currency: string): string => CURRENCY_SYMBOLS[currency] ?? currency

export const convertToBase = (amount: number, fromCurrency: string, baseCurrency: string = 'CNY'): number => {
  if (fromCurrency === baseCurrency) return amount

  // Rates are defined as: 1 Unit of Currency = X CNY
  // USD: 7.2 means 1 USD = 7.2 CNY
  // CNY: 1 means 1 CNY = 1 CNY
  
  // Live rates when the rate card (or anything else) has fetched them; the fixed ones until then.
  const fromRate = liveCnyPer(fromCurrency) ?? EXCHANGE_RATES[fromCurrency]
  const baseRate = liveCnyPer(baseCurrency) ?? EXCHANGE_RATES[baseCurrency]

  if (fromRate === undefined || baseRate === undefined) {
    console.warn(`Missing exchange rate for ${fromCurrency} or ${baseCurrency}`)
    return amount
  }

  // Convert to Ref (CNY)
  const amountInRef = amount * fromRate
  
  // Convert from Ref to Target
  const amountInTarget = amountInRef / baseRate
  
  return Number(amountInTarget.toFixed(2))
}
