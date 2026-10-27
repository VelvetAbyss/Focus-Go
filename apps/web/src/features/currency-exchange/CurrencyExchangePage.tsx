import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeftRight, Plus, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLabs } from '../labs/LabsContext'
import { useI18n } from '../../shared/i18n/useI18n'
import { ROUTES } from '../../app/routes/routes'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
import './currency-exchange.css'

type RateResponse = { date: string; rates: Record<string, number> }
type Period = '1w' | '1m' | '3m' | '1y' | '5y'
type HistoryResponse = { rates: Record<string, Record<string, number>> }
const API = 'https://api.frankfurter.dev/v1'
const periods: Period[] = ['1w', '1m', '3m', '1y', '5y']
const defaultTargets = ['CNY', 'EUR', 'GBP', 'JPY', 'CAD']
const dateString = (d: Date) => d.toISOString().slice(0, 10)
const startDate = (period: Period) => {
  const d = new Date()
  if (period === '1w') d.setUTCDate(d.getUTCDate() - 7)
  else if (period === '1m') d.setUTCMonth(d.getUTCMonth() - 1)
  else if (period === '3m') d.setUTCMonth(d.getUTCMonth() - 3)
  else d.setUTCFullYear(d.getUTCFullYear() - (period === '1y' ? 1 : 5))
  return dateString(d)
}
const readJson = async <T,>(url: string, signal: AbortSignal): Promise<T> => {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Exchange rate request failed: ${response.status}`)
  return response.json() as Promise<T>
}
const format = (number: number, digits = 4) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(number)

export default function CurrencyExchangePage() {
  const { ready, catalog } = useLabs()
  const { language } = useI18n()
  const zh = language === 'zh'
  const currencyNames = useMemo(() => new Intl.DisplayNames([zh ? 'zh-CN' : 'en'], { type: 'currency' }), [zh])
  const [currencies, setCurrencies] = useState<Record<string, string>>({})
  const [base, setBase] = useState('USD')
  const [amount, setAmount] = useState('100')
  const [targets, setTargets] = useState(defaultTargets)
  const [selected, setSelected] = useState('CNY')
  const [add, setAdd] = useState('')
  const [period, setPeriod] = useState<Period>('1m')
  const [rates, setRates] = useState<RateResponse | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const installed = catalog.some(item => item.featureKey === 'currency-exchange' && item.state === 'installed')

  useEffect(() => {
    if (!installed) return
    const controller = new AbortController()
    setStatus('loading'); setRates(null)
    Promise.all([
      readJson<Record<string, string>>(`${API}/currencies`, controller.signal),
      readJson<RateResponse>(`${API}/latest?base=${encodeURIComponent(base)}`, controller.signal),
    ]).then(([list, latest]) => { setCurrencies(list); setRates(latest); setStatus('ready') }).catch(() => { if (!controller.signal.aborted) setStatus('error') })
    return () => controller.abort()
  }, [base, installed, retry])
  useEffect(() => {
    if (!installed || !selected || selected === base) return
    const controller = new AbortController()
    setHistoryStatus('loading'); setHistory(null)
    readJson<HistoryResponse>(`${API}/${startDate(period)}..${dateString(new Date())}?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(selected)}`, controller.signal)
      .then(data => { setHistory(data); setHistoryStatus('ready') }).catch(() => { if (!controller.signal.aborted) setHistoryStatus('error') })
    return () => controller.abort()
  }, [base, selected, period, installed, retry])
  const chart = useMemo(() => Object.entries(history?.rates ?? {}).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, values]) => typeof values[selected] === 'number' ? [{ date, rate: values[selected] }] : []), [history, selected])
  const currencyName = (code: string) => currencyNames.of(code) ?? currencies[code] ?? code
  const available = Object.keys(currencies).filter(code => code !== base && !targets.includes(code)).sort()
  const current = rates?.rates[selected]
  const labels: Record<Period, string> = zh ? { '1w': '1周', '1m': '1个月', '3m': '3个月', '1y': '1年', '5y': '5年' } : { '1w': '1W', '1m': '1M', '3m': '3M', '1y': '1Y', '5y': '5Y' }
  const changeBase = (next: string) => {
    if (next === base) return
    const nextTargets = [...new Set([base, ...targets.filter(code => code !== next)])]
    setBase(next); setTargets(nextTargets); if (selected === next) setSelected(base)
  }
  if (!ready) return <BrandLoader variant="inline" />
  if (!installed) return <Navigate to={ROUTES.LABS} replace />
  return <div className="module-page-shell currency-page">
    <header className="currency-header"><h1 className="type-page-title">{zh ? '汇率转换' : 'Currency exchange'}</h1><p>{zh ? '换算多种货币，查看历史走势。' : 'Convert currencies and explore historical trends.'}</p></header>
    <div className="currency-layout"><section className="currency-panel"><h2>{zh ? '货币换算' : 'Convert currencies'}</h2>
      <label className="currency-label" htmlFor="currency-amount">{zh ? '基准金额与货币' : 'Amount and base currency'}</label>
      <div className="currency-input"><input id="currency-amount" type="number" min="0" step="any" value={amount} onChange={e => setAmount(e.target.value)} /><select aria-label={zh ? '基准货币' : 'Base currency'} value={base} onChange={e => changeBase(e.target.value)}>{Object.entries(currencies).sort(([a], [b]) => a.localeCompare(b)).map(([code]) => <option key={code} value={code}>{code} · {currencyName(code)}</option>)}{!currencies[base] && <option value={base}>{base}</option>}</select></div>
      <h3>{zh ? '换算结果' : 'Converted amounts'}</h3>
      <div className="currency-rows">{targets.map(code => <div className={`currency-row ${selected === code ? 'is-selected' : ''}`} key={code}><button className="currency-row-select" onClick={() => setSelected(code)} aria-pressed={selected === code}><strong>{code}</strong><span>{currencyName(code)}</span><b>{rates?.rates[code] && amount !== '' && Number(amount) >= 0 ? format(Number(amount) * rates.rates[code], 2) : '—'}</b></button><button className="currency-remove" disabled={targets.length === 1} aria-label={`${zh ? '移除' : 'Remove'} ${code}`} onClick={() => { const next = targets.filter(item => item !== code); setTargets(next); if (selected === code) setSelected(next[0]) }}><X size={16} /></button></div>)}</div>
      <div className="currency-add"><select aria-label={zh ? '选择货币' : 'Choose currency'} value={add} onChange={e => setAdd(e.target.value)}><option value="">{zh ? '选择货币' : 'Choose currency'}</option>{available.map(code => <option key={code} value={code}>{code} · {currencyName(code)}</option>)}</select><button disabled={!available.includes(add)} onClick={() => { setTargets([...targets, add]); setAdd('') }}><Plus size={16} /> {zh ? '添加' : 'Add'}</button></div>
      <p className="currency-note">{status === 'loading' ? (zh ? '正在获取汇率…' : 'Loading rates…') : status === 'error' ? (zh ? '汇率获取失败，请检查网络后重试。' : 'Could not load rates. Check your connection and retry.') : `${zh ? '数据日期' : 'Rate date'}: ${rates?.date}`} {status === 'error' && <button onClick={() => setRetry(value => value + 1)}>{zh ? '重试' : 'Retry'}</button>}</p>
    </section><section className="currency-panel currency-trend"><div className="currency-trend-head"><h2>{base} / {selected} {zh ? '汇率走势' : 'exchange rate'}</h2><button onClick={() => changeBase(selected)}><ArrowLeftRight size={16} /> {zh ? '切换货币' : 'Swap'}</button></div>
      <p className="currency-rate">1 {base} = <strong>{current ? format(current) : '—'}</strong> {selected}</p>
      <div className="currency-periods" aria-label={zh ? '时间范围' : 'Time range'}>{periods.map(p => <button key={p} className={period === p ? 'is-selected' : ''} aria-pressed={period === p} onClick={() => setPeriod(p)}>{labels[p]}</button>)}</div>
      {historyStatus === 'loading' ? <div className="currency-placeholder">{zh ? '正在获取历史数据…' : 'Loading historical data…'}</div> : historyStatus === 'error' ? <div className="currency-placeholder">{zh ? '历史数据获取失败。' : 'Could not load historical data.'} <button onClick={() => setRetry(value => value + 1)}>{zh ? '重试' : 'Retry'}</button></div> : chart.length === 0 ? <div className="currency-placeholder">{zh ? '该时间范围暂无数据。' : 'No data for this period.'}</div> : <div className="currency-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 10, right: 16, bottom: 5, left: 10 }}><CartesianGrid stroke="var(--rule)" vertical={false} /><XAxis dataKey="date" minTickGap={40} tick={{ fontSize: 11 }} /><YAxis domain={['auto', 'auto']} width={58} tick={{ fontSize: 11 }} /><Tooltip formatter={(v) => typeof v === 'number' ? format(v, 6) : String(v)} /><Line type="monotone" dataKey="rate" name={`${base}/${selected}`} stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>}
      <p className="currency-note">{zh ? '每日参考汇率，可能与银行或支付平台实际成交汇率不同。数据来源：' : 'Daily reference rates may differ from your bank or payment provider. Source: '}<a href="https://www.frankfurter.dev/" target="_blank" rel="noreferrer">Frankfurter</a></p>
    </section></div>
  </div>
}
