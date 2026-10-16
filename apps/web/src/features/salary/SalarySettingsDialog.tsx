import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import Dialog from '../../shared/ui/Dialog'
import { useI18n } from '../../shared/i18n/useI18n'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { currencyToSymbol } from '../../lib/currency'
import type { TranslationKey } from '../../shared/i18n/types'
import type { CurrencyCode } from '../../shared/prefs/preferences'
import { dailyPay, DEFAULT_WORK_HOURS, paidMinutesPerDay, workdaysInMonth, type SalarySettings } from './salaryModel'
import { formatClock, formatMoney, localeOf, parseClock } from './salaryFormat'
import { normalizeSalarySettings } from './salaryStorage'
import { updateSalaryState, useSalaryState } from './useSalaryState'

type Draft = {
  salary: string
  currency: CurrencyCode
  workStart: string
  workEnd: string
  lunchOn: boolean
  lunchStart: string
  lunchEnd: string
  workdays: number[]
  payday: string
  followCnHolidays: boolean
}

// Monday first, as a work week is read.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const CURRENCIES: CurrencyCode[] = ['CNY', 'USD']

const toDraft = (settings: SalarySettings | null, defaultCurrency: CurrencyCode): Draft => {
  const base = settings ?? { monthlySalary: 0, ...DEFAULT_WORK_HOURS }
  const lunch = base.lunch ?? DEFAULT_WORK_HOURS.lunch!
  return {
    salary: settings ? String(settings.monthlySalary) : '',
    currency: settings?.currency ?? defaultCurrency,
    workStart: formatClock(base.workStart),
    workEnd: formatClock(base.workEnd),
    lunchOn: settings ? Boolean(settings.lunch) : true,
    lunchStart: formatClock(lunch.start),
    lunchEnd: formatClock(lunch.end),
    workdays: base.workdays,
    payday: settings?.payday ? String(settings.payday) : '',
    followCnHolidays: settings?.followCnHolidays !== false,
  }
}

const readDraft = (draft: Draft): { settings: SalarySettings } | { error: TranslationKey } => {
  const monthlySalary = Number(draft.salary.replace(/[,，\s]/g, ''))
  if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) return { error: 'salary.settings.errorSalary' }
  const workStart = parseClock(draft.workStart)
  const workEnd = parseClock(draft.workEnd)
  if (workStart === null || workEnd === null || workEnd <= workStart) return { error: 'salary.settings.errorHours' }
  let lunch: SalarySettings['lunch'] = null
  if (draft.lunchOn) {
    const start = parseClock(draft.lunchStart)
    const end = parseClock(draft.lunchEnd)
    if (start === null || end === null || end <= start) return { error: 'salary.settings.errorLunch' }
    lunch = { start, end }
  }
  if (draft.workdays.length === 0) return { error: 'salary.settings.errorDays' }
  const payday = draft.payday.trim() ? Number(draft.payday) : undefined
  if (payday !== undefined && (!Number.isInteger(payday) || payday < 1 || payday > 31)) return { error: 'salary.settings.errorPayday' }
  const settings = normalizeSalarySettings({
    monthlySalary, currency: draft.currency, workStart, workEnd, lunch, workdays: draft.workdays, payday, followCnHolidays: draft.followCnHolidays,
  })
  return settings ? { settings } : { error: 'salary.settings.errorHours' }
}

type SalarySettingsDialogProps = {
  open: boolean
  onClose: () => void
}

/**
 * Pay and hours for the three pay widgets. Mount with a fresh `key` per
 * opening so the draft starts from the saved settings.
 */
const SalarySettingsDialog = ({ open, onClose }: SalarySettingsDialogProps) => {
  const { t, language } = useI18n()
  const { defaultCurrency } = usePreferences()
  const { settings } = useSalaryState()
  const [draft, setDraft] = useState(() => toDraft(settings, defaultCurrency))
  const symbol = currencyToSymbol(draft.currency)
  const [error, setError] = useState<TranslationKey | null>(null)
  const [openedAt] = useState(() => Date.now())

  const parsed = useMemo(() => readDraft(draft), [draft])
  const summary = useMemo(() => {
    if (!('settings' in parsed)) return null
    const perDay = dailyPay(parsed.settings, openedAt)
    const minutes = paidMinutesPerDay(parsed.settings)
    return t('salary.settings.summary', {
      days: workdaysInMonth(parsed.settings, openedAt),
      daily: formatMoney(perDay, symbol, language),
      hourly: formatMoney(minutes > 0 ? perDay / (minutes / 60) : 0, symbol, language),
    })
  }, [language, openedAt, parsed, symbol, t])

  const weekdayLabels = useMemo(() => {
    const format = new Intl.DateTimeFormat(localeOf(language), { weekday: language === 'zh' ? 'narrow' : 'short' })
    // 5 January 2026 is a Monday.
    return new Map(WEEK_ORDER.map((day, index) => [day, format.format(new Date(2026, 0, 5 + index))]))
  }, [language])

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
  }

  const toggleDay = (day: number) =>
    update({
      workdays: draft.workdays.includes(day) ? draft.workdays.filter((item) => item !== day) : [...draft.workdays, day],
    })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!('settings' in parsed)) {
      setError(parsed.error)
      return
    }
    const next = parsed.settings
    updateSalaryState((current) => ({ ...current, settings: next }))
    onClose()
  }

  return (
    <Dialog open={open} title={t('salary.settings.title')} onClose={onClose} panelClassName="salary-settings-dialog">
      <form className="salary-settings" onSubmit={submit} noValidate>
        <div className="salary-field">
          <div className="salary-switch-row">
            <label className="salary-field__label" htmlFor="salary-settings-pay">
              {t('salary.settings.salary')}
            </label>
            <div className="salary-currency" role="radiogroup" aria-label={t('salary.settings.currency')}>
              {CURRENCIES.map((currency) => (
                <button
                  key={currency}
                  type="button"
                  role="radio"
                  className="salary-currency__option"
                  aria-checked={draft.currency === currency}
                  onClick={() => update({ currency })}
                >
                  {currencyToSymbol(currency)} {currency}
                </button>
              ))}
            </div>
          </div>
          <span className="salary-input salary-input--money">
            <span className="salary-input__affix" aria-hidden="true">{symbol}</span>
            <input
              id="salary-settings-pay"
              value={draft.salary}
              onChange={(event) => update({ salary: event.target.value })}
              inputMode="decimal"
              autoComplete="off"
              placeholder="12000"
              aria-invalid={error === 'salary.settings.errorSalary'}
              autoFocus
            />
          </span>
        </div>

        <div className="salary-field-row">
          <label className="salary-field">
            <span className="salary-field__label">{t('salary.settings.workStart')}</span>
            <input className="salary-input" type="time" value={draft.workStart} onChange={(event) => update({ workStart: event.target.value })} />
          </label>
          <label className="salary-field">
            <span className="salary-field__label">{t('salary.settings.workEnd')}</span>
            <input className="salary-input" type="time" value={draft.workEnd} onChange={(event) => update({ workEnd: event.target.value })} />
          </label>
        </div>

        <div className="salary-field">
          <label className="salary-switch-row">
            <span className="salary-field__label">{t('salary.settings.lunch')}</span>
            <Switch checked={draft.lunchOn} onCheckedChange={(checked) => update({ lunchOn: checked })} />
          </label>
          {draft.lunchOn ? (
            <div className="salary-field-row">
              <input
                className="salary-input"
                type="time"
                value={draft.lunchStart}
                onChange={(event) => update({ lunchStart: event.target.value })}
                aria-label={t('salary.settings.lunchStart')}
              />
              <input
                className="salary-input"
                type="time"
                value={draft.lunchEnd}
                onChange={(event) => update({ lunchEnd: event.target.value })}
                aria-label={t('salary.settings.lunchEnd')}
              />
            </div>
          ) : null}
        </div>

        <fieldset className="salary-field">
          <legend className="salary-field__label">{t('salary.settings.workdays')}</legend>
          <div className="salary-days">
            {WEEK_ORDER.map((day) => (
              <button
                key={day}
                type="button"
                className="salary-day"
                aria-pressed={draft.workdays.includes(day)}
                onClick={() => toggleDay(day)}
              >
                {weekdayLabels.get(day)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="salary-field-row">
          <label className="salary-field">
            <span className="salary-field__label">{t('salary.settings.payday')}</span>
            <input
              className="salary-input"
              value={draft.payday}
              onChange={(event) => update({ payday: event.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
              inputMode="numeric"
              placeholder={t('salary.settings.paydayPlaceholder')}
              aria-invalid={error === 'salary.settings.errorPayday'}
            />
          </label>
          <label className="salary-field salary-switch-row salary-switch-row--stacked">
            <span className="salary-field__label">{t('salary.settings.cnHolidays')}</span>
            <Switch checked={draft.followCnHolidays} onCheckedChange={(checked) => update({ followCnHolidays: checked })} />
          </label>
        </div>

        <div className="salary-settings__notes">
          {summary ? <p className="salary-settings__summary">{summary}</p> : null}
          <p>{t('salary.settings.privacy')}</p>
          {error ? (
            <p className="salary-settings__error" role="alert">
              {t(error)}
            </p>
          ) : null}
        </div>

        <div className="dialog__actions">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('salary.settings.cancel')}
          </Button>
          <Button type="submit">{t('salary.settings.save')}</Button>
        </div>
      </form>
    </Dialog>
  )
}

export default SalarySettingsDialog
