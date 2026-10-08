import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import Card from '../../../shared/ui/Card'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import { currencyToSymbol } from '../../../lib/currency'
import { earnedBetween, paidMinutesPerDay, priceInWorkTime } from '../salaryModel'
import { formatMoney, formatWorkDuration, localeOf } from '../salaryFormat'
import { MAX_WISHES } from '../salaryStorage'
import { newSalaryId, updateSalaryState, useSalaryState } from '../useSalaryState'
import { useSettingsDialog } from '../useSettingsDialog'
import { DurationFigure, SalarySettingsButton, SalarySetup } from '../SalaryParts'
import { priceGrid } from '../timeGrid'
import GridCanvas from '../GridCanvas'
import { useGridColors } from '../useGridColors'
import type { TimeGridParams } from '../three/gridTypes'
import '../salary.css'

const parsePrice = (value: string) => {
  const price = Number(value.replace(/[,，\s]/g, ''))
  return Number.isFinite(price) && price > 0 ? price : null
}

const createWish = (name: string, price: number) => ({ id: newSalaryId(), name, price, addedAt: Date.now() })

const ROW_HEIGHT = 23
/** Let the typing settle before the hours turn over. */
const SETTLE_MS = 350

/** A price as hour cells in working-day blocks, turned over once the number settles. */
const PriceGrid = ({ hours, hoursPerDay }: { hours: number | null; hoursPerDay: number }) => {
  const { t } = useI18n()
  const colors = useGridColors()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [shown, setShown] = useState<{ hours: number | null; runId: number }>({ hours: null, runId: 0 })

  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setWidth(node.clientWidth)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setShown((current) => (current.hours === hours ? current : { hours, runId: current.runId + 1 })),
      hours === null ? 0 : SETTLE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [hours])

  const params = useMemo<TimeGridParams>(
    () => ({ kind: 'price', hours: shown.hours, hoursPerDay, runId: shown.runId, colors }),
    [colors, hoursPerDay, shown],
  )
  const extra = width > 0 ? priceGrid(width, ROW_HEIGHT, shown.hours, hoursPerDay) : null

  return (
    <div className="salary-price__row" ref={wrapRef} aria-hidden="true">
      <GridCanvas params={params} className="salary-grid--price" />
      {extra && extra.extraDays > 0 ? (
        <span className="salary-price__more" style={{ left: extra.labelLeft }}>
          {t('salary.price.moreDays', { count: extra.extraDays })}
        </span>
      ) : null}
    </div>
  )
}

/**
 * 工时换算: a price read as the working time it costs, and a wishlist whose
 * bars fill with the paid time worked since each wish was added.
 */
const WorkTimePriceCard = () => {
  const { t, language } = useI18n()
  const { defaultCurrency } = usePreferences()
  const symbol = currencyToSymbol(defaultCurrency)
  const { settings, wishlist } = useSalaryState()
  const { openSettings, settingsDialog } = useSettingsDialog()
  const [name, setName] = useState('')
  const [priceText, setPriceText] = useState('')
  const [now, setNow] = useState(() => Date.now())

  // Wish bars move with paid time; a minute is fine-grained enough.
  useVisibleInterval(() => setNow(Date.now()), 60_000, { enabled: Boolean(settings) && wishlist.length > 0, runOnVisible: true })

  const price = parsePrice(priceText)
  const cost = settings && price ? priceInWorkTime(settings, price, now) : null
  const priceDigits = (amount: number) => (Number.isInteger(amount) ? 0 : 2)

  const addWish = (event: FormEvent) => {
    event.preventDefault()
    if (!price) return
    const wish = createWish(name.trim() || t('salary.price.untitled'), price)
    updateSalaryState((current) => ({ ...current, wishlist: [wish, ...current.wishlist].slice(0, MAX_WISHES) }))
    setName('')
    setPriceText('')
    setNow(wish.addedAt)
  }

  const removeWish = (id: string) =>
    updateSalaryState((current) => ({ ...current, wishlist: current.wishlist.filter((item) => item.id !== id) }))

  return (
    <Card
      className="dashboard-widget-card salary-card salary-card--price"
      eyebrow={t('salary.price.eyebrow')}
      actions={settings ? <SalarySettingsButton onClick={openSettings} /> : undefined}
    >
      {settings ? (
        <div className="salary-price">
          <form className="salary-price__form" onSubmit={addWish}>
            <input
              className="salary-input salary-price__name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('salary.price.name')}
              aria-label={t('salary.price.name')}
              maxLength={40}
              autoComplete="off"
            />
            <span className="salary-input salary-input--money salary-price__amount">
              <span className="salary-input__affix" aria-hidden="true">{symbol}</span>
              <input
                value={priceText}
                onChange={(event) => setPriceText(event.target.value)}
                placeholder={t('salary.price.price')}
                aria-label={t('salary.price.price')}
                inputMode="decimal"
                autoComplete="off"
              />
            </span>
            <button
              type="submit"
              className="salary-icon-btn salary-icon-btn--solid"
              disabled={!cost}
              aria-label={t('salary.price.add')}
              title={t('salary.price.add')}
            >
              <Plus size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </form>

          <div className="salary-price__result" data-empty={!cost}>
            <div className="salary-price__text" aria-live="polite">
              {cost ? (
                <>
                  <DurationFigure seconds={cost.seconds} className="salary-price__time" />
                  <p className="salary-meta">
                    {t('salary.price.days', { days: cost.days.toLocaleString(localeOf(language), { maximumFractionDigits: 2 }) })}
                  </p>
                </>
              ) : (
                <p className="salary-price__hint">{t('salary.price.hint')}</p>
              )}
            </div>
            <PriceGrid hours={cost ? cost.seconds / 3600 : null} hoursPerDay={paidMinutesPerDay(settings) / 60} />
          </div>

          <div className="salary-price__wishes">
            <p className="salary-label">{t('salary.price.wishlist')}</p>
            {wishlist.length === 0 ? (
              <p className="salary-price__hint">{t('salary.price.wishEmpty')}</p>
            ) : (
              <ul className="salary-wishes">
                {wishlist.map((wish) => {
                  const total = priceInWorkTime(settings, wish.price, now)
                  const fraction = Math.min(1, earnedBetween(settings, wish.addedAt, now) / wish.price)
                  const covered = fraction >= 1
                  return (
                    <li key={wish.id} className="salary-wish" data-covered={covered}>
                      <div className="salary-wish__head">
                        <span className="salary-wish__name">{wish.name}</span>
                        <span className="salary-row-end">
                          <span className="salary-wish__price">{formatMoney(wish.price, symbol, language, priceDigits(wish.price))}</span>
                          <button
                            type="button"
                            className="salary-row-remove"
                            onClick={() => removeWish(wish.id)}
                            aria-label={t('salary.price.remove', { name: wish.name })}
                          >
                            <X size={12} strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                      <span className="salary-wish__bar" aria-hidden="true">
                        <span style={{ width: `${(fraction * 100).toFixed(2)}%` }} />
                      </span>
                      <p className="salary-meta">
                        {covered ? (
                          <span className="salary-wish__covered">{t('salary.price.covered')}</span>
                        ) : total ? (
                          t('salary.price.progress', {
                            worked: formatWorkDuration(fraction * total.seconds, t),
                            total: formatWorkDuration(total.seconds, t),
                          })
                        ) : null}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <SalarySetup body={t('salary.setup.price')} onSetup={openSettings} />
      )}
      {settingsDialog}
    </Card>
  )
}

export default WorkTimePriceCard
