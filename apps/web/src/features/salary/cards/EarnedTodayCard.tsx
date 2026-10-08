import { useMemo, useState } from 'react'
import Card from '../../../shared/ui/Card'
import { AppNumber } from '../../../shared/ui/AppNumber'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import { currencyToSymbol } from '../../../lib/currency'
import { dayStatus, nextWorkStart } from '../salaryModel'
import { formatMoney, formatRate, formatTimeOfDay, formatWorkDuration, localeOf } from '../salaryFormat'
import { useSalaryState } from '../useSalaryState'
import { useSettingsDialog } from '../useSettingsDialog'
import { SalarySettingsButton, SalarySetup } from '../SalaryParts'
import { dayGrid } from '../timeGrid'
import GridCanvas from '../GridCanvas'
import { useGridColors } from '../useGridColors'
import type { TimeGridParams } from '../three/gridTypes'
import '../salary.css'

const MONEY_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const

/** 今日计薪: today's pay so far, rising a second at a time while you work. */
const EarnedTodayCard = () => {
  const { t, language } = useI18n()
  const { defaultCurrency } = usePreferences()
  const symbol = currencyToSymbol(defaultCurrency)
  const { settings } = useSalaryState()
  const { openSettings, settingsDialog } = useSettingsDialog()
  const [now, setNow] = useState(() => Date.now())
  const status = settings ? dayStatus(settings, now) : null

  // A tick a second while the number moves; otherwise just often enough to
  // catch the next phase (start of work, end of lunch).
  useVisibleInterval(() => setNow(Date.now()), status?.phase === 'working' ? 1000 : 20_000, {
    enabled: Boolean(settings),
    runOnVisible: true,
  })

  // Today as five-minute cells: worked in ink, now in the pen, lunch crossed out.
  const colors = useGridColors()
  const gridParams = useMemo<TimeGridParams | null>(() => {
    const grid = settings ? dayGrid(settings, now) : null
    return grid ? { kind: 'day', grid, colors } : null
  }, [colors, now, settings])

  const money = (amount: number) => formatMoney(amount, symbol, language)

  let body
  if (!settings || !status) {
    body = <SalarySetup body={t('salary.setup.earned')} onSetup={openSettings} />
  } else if (status.phase === 'off') {
    const next = nextWorkStart(settings, now)
    const when = next
      ? `${new Intl.DateTimeFormat(localeOf(language), { weekday: 'short' }).format(next)} ${formatTimeOfDay(next)}`
      : null
    body = (
      <div className="salary-earned salary-earned--off">
        <p className="salary-earned__rest">{t('salary.earned.off')}</p>
        {when ? <p className="salary-meta">{t('salary.earned.nextStart', { when })}</p> : null}
      </div>
    )
  } else {
    const worked = t('salary.earned.worked', { duration: formatWorkDuration(status.paidMs / 1000, t) })
    const meta =
      status.phase === 'working'
        ? [t('salary.earned.perSecond', { amount: formatRate(status.rate, symbol, language) }), worked]
        : status.phase === 'before'
          ? [t('salary.earned.startsAt', { time: formatTimeOfDay(status.start) })]
          : status.phase === 'lunch'
            ? [t('salary.earned.lunch', { time: formatTimeOfDay(status.segments[1]?.[0] ?? status.end) }), worked]
            : [t('salary.earned.done'), worked]
    body = (
      <div className="salary-earned" data-phase={status.phase}>
        <div className="salary-earned__top">
          <div className="salary-earned__figures">
            <p className="salary-earned__amount" aria-label={t('salary.earned.aria', { amount: money(status.earned) })}>
              <span className="salary-earned__currency" aria-hidden="true">
                {symbol}
              </span>
              <AppNumber value={status.earned} format={MONEY_FORMAT} trend={1} aria-hidden />
            </p>
            {meta.map((line) => (
              <p key={line} className="salary-meta">
                {line}
              </p>
            ))}
          </div>
          {gridParams ? <GridCanvas params={gridParams} className="salary-grid--day" /> : null}
        </div>
        <p className="salary-meta salary-meta--split salary-earned__foot">
          <span>{t('salary.earned.progress', { percent: Math.floor(status.progress * 100) })}</span>
          <span>{t('salary.earned.expected', { amount: money(status.expected) })}</span>
        </p>
      </div>
    )
  }

  return (
    <Card
      className="dashboard-widget-card salary-card salary-card--earned"
      eyebrow={t('salary.earned.eyebrow')}
      actions={settings ? <SalarySettingsButton onClick={openSettings} /> : undefined}
    >
      {body}
      {settingsDialog}
    </Card>
  )
}

export default EarnedTodayCard
