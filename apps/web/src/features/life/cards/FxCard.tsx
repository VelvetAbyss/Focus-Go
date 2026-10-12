import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import Card from '../../../shared/ui/Card'
import { useI18n } from '../../../shared/i18n/useI18n'
import { EXCHANGE_RATES } from '../../../lib/currency'
import { loadFxRates, readFxSnapshot, type FxSnapshot } from '../../../shared/fx/fxRates'
import './fx-card.css'

const FOREIGN = ['USD', 'CAD', 'EUR'] as const
type Foreign = (typeof FOREIGN)[number]

const round = (value: number, digits: number) => Number(value.toFixed(digits))

/**
 * 汇率: today's rate for the currencies you quote in, and a two-way converter, so
 * "$12.50 FOB" is in yuan without another tab. Off by default (Manage widgets).
 */
const FxCard = () => {
  const { t, language } = useI18n()
  const [snapshot, setSnapshot] = useState<FxSnapshot | null>(() => readFxSnapshot())
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [foreign, setForeign] = useState<Foreign>('USD')
  const [foreignAmount, setForeignAmount] = useState('1')
  const [cnyAmount, setCnyAmount] = useState('')

  const refresh = (force: boolean) => {
    setLoading(true)
    void loadFxRates(force).then((next) => {
      setLoading(false)
      setFailed(!next)
      if (next) setSnapshot(next)
    })
  }

  useEffect(() => {
    refresh(false)
  }, [])

  // CNY for one unit: live when known, the app's fixed estimate otherwise (only USD has one).
  const cnyPer = (currency: Foreign) =>
    snapshot?.rates[currency] ? snapshot.rates.CNY / snapshot.rates[currency] : currency === 'USD' ? EXCHANGE_RATES.USD : null
  const rate = cnyPer(foreign)

  // The yuan side follows the foreign side unless you typed in it.
  const [lastEdited, setLastEdited] = useState<'foreign' | 'cny'>('foreign')
  const shownCny = lastEdited === 'foreign' && rate ? (Number(foreignAmount) > 0 ? String(round(Number(foreignAmount) * rate, 2)) : '') : cnyAmount
  const shownForeign = lastEdited === 'cny' && rate ? (Number(cnyAmount) > 0 ? String(round(Number(cnyAmount) / rate, 2)) : '') : foreignAmount

  const updated = snapshot
    ? new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(snapshot.updatedAt)
    : null

  return (
    <Card
      className="dashboard-widget-card fx-card"
      eyebrow={t('fx.eyebrow')}
      actions={
        <button
          type="button"
          className={`fx-card__refresh${loading ? ' is-loading' : ''}`}
          onClick={() => refresh(true)}
          aria-label={t('fx.refresh')}
          title={t('fx.refresh')}
          aria-busy={loading}
        >
          <RotateCcw size={13} strokeWidth={1.8} aria-hidden />
        </button>
      }
    >
      <div className="fx-card__body">
        <p className="fx-card__rate">
          {rate ? (
            <>
              <span className="fx-card__unit">1 {foreign}</span>
              <span className="fx-card__eq">=</span>
              <span className="fx-card__value">{rate.toFixed(4)}</span>
              <span className="fx-card__unit">CNY</span>
            </>
          ) : (
            <span className="fx-card__unit">{t('fx.unavailable')}</span>
          )}
        </p>

        <div className="fx-card__convert">
          <label className="fx-card__field">
            <select value={foreign} onChange={(event) => setForeign(event.target.value as Foreign)} aria-label={t('fx.currency')}>
              {FOREIGN.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <input
              value={shownForeign}
              onChange={(event) => {
                setLastEdited('foreign')
                setForeignAmount(event.target.value.replace(/[^0-9.]/g, ''))
              }}
              inputMode="decimal"
              aria-label={t('fx.amountIn', { code: foreign })}
            />
          </label>
          <span className="fx-card__arrow" aria-hidden>⇄</span>
          <label className="fx-card__field">
            <span className="fx-card__code">CNY</span>
            <input
              value={shownCny}
              onChange={(event) => {
                setLastEdited('cny')
                setCnyAmount(event.target.value.replace(/[^0-9.]/g, ''))
              }}
              inputMode="decimal"
              aria-label={t('fx.amountIn', { code: 'CNY' })}
            />
          </label>
        </div>

        <p className="fx-card__meta">
          {snapshot ? t('fx.updated', { time: updated! }) : failed ? t('fx.estimate') : t('fx.loading')}
          {snapshot && failed ? ` · ${t('fx.stale')}` : ''}
        </p>
      </div>
    </Card>
  )
}

export default FxCard
