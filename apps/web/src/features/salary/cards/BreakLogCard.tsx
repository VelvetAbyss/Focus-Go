import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Card from '../../../shared/ui/Card'
import { useI18n } from '../../../shared/i18n/useI18n'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { useVisibleInterval } from '../../../shared/hooks/usePageActivity'
import { currencyToSymbol } from '../../../lib/currency'
import { earnedBetween, startOfLocalDay, startOfLocalWeek, type SalarySettings } from '../salaryModel'
import { formatMoney, formatTimeOfDay, formatWorkDuration } from '../salaryFormat'
import type { BreakSession } from '../salaryStorage'
import { newSalaryId, updateSalaryState, useSalaryState } from '../useSalaryState'
import { useSettingsDialog } from '../useSettingsDialog'
import { DurationFigure, SalarySettingsButton } from '../SalaryParts'
import { dayGrid } from '../timeGrid'
import GridCanvas from '../GridCanvas'
import { useGridColors } from '../useGridColors'
import type { TimeGridParams } from '../three/gridTypes'
import '../salary.css'

/** A tap shorter than this is a slip, not a break. */
const MIN_BREAK_MS = 5_000

const pad = (value: number) => String(value).padStart(2, '0')

/** A running break as 12:34, or 1:02:03 past the hour. */
const formatStopwatch = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Break time inside [from, now), counting a running break up to now. */
const breakTimeSince = (breaks: BreakSession[], active: number | null, from: number, now: number) => {
  const spans: Array<[number, number]> = breaks.map((item) => [item.startAt, item.endAt])
  if (active) spans.push([active, now])
  return spans.reduce<{ ms: number; spans: Array<[number, number]> }>(
    (sum, [start, end]) => {
      const clipped: [number, number] = [Math.max(start, from), Math.min(end, now)]
      if (clipped[1] <= clipped[0]) return sum
      return {
        ms: sum.ms + clipped[1] - clipped[0],
        spans: [...sum.spans, clipped],
      }
    },
    { ms: 0, spans: [] },
  )
}

const paidDuring = (settings: SalarySettings | null, spans: Array<[number, number]>) =>
  settings ? spans.reduce((sum, [from, to]) => sum + earnedBetween(settings, from, to), 0) : null

/**
 * 摸鱼: start a break, end it, and see what the minutes were paid. Only a
 * different way to look at your time; nothing extra is earned.
 */
const BreakLogCard = () => {
  const { t, language } = useI18n()
  const { defaultCurrency } = usePreferences()
  const symbol = currencyToSymbol(defaultCurrency)
  const { settings, breaks, activeBreakStartAt } = useSalaryState()
  const { openSettings, settingsDialog } = useSettingsDialog()
  const [now, setNow] = useState(() => Date.now())

  useVisibleInterval(() => setNow(Date.now()), activeBreakStartAt ? 1000 : 60_000, { runOnVisible: true })

  const money = (amount: number) => formatMoney(amount, symbol, language)
  const today = breakTimeSince(breaks, activeBreakStartAt, startOfLocalDay(now), now)
  const week = breakTimeSince(breaks, activeBreakStartAt, startOfLocalWeek(now), now)
  const todayPay = paidDuring(settings, today.spans)
  const todaysBreaks = breaks.filter((item) => item.endAt > startOfLocalDay(now)).reverse()

  const start = () => {
    const startedAt = Date.now()
    setNow(startedAt)
    updateSalaryState((current) => (current.activeBreakStartAt ? current : { ...current, activeBreakStartAt: startedAt }))
  }

  const stop = () => {
    const endedAt = Date.now()
    setNow(endedAt)
    updateSalaryState((current) => {
      const startAt = current.activeBreakStartAt
      if (!startAt) return current
      const kept = endedAt - startAt >= MIN_BREAK_MS
      return {
        ...current,
        activeBreakStartAt: null,
        breaks: kept ? [...current.breaks, { id: newSalaryId(), startAt, endAt: endedAt }] : current.breaks,
      }
    })
  }

  const remove = (id: string) =>
    updateSalaryState((current) => ({
      ...current,
      breaks: current.breaks.filter((item) => item.id !== id),
    }))

  const running = activeBreakStartAt !== null
  const runningPay = running ? paidDuring(settings, [[activeBreakStartAt, now]]) : null

  // Today's grid: breaks taken struck through, the one running in the pen.
  const colors = useGridColors()
  const gridParams = useMemo<TimeGridParams | null>(() => {
    if (!settings) return null
    const taken = breaks.filter((item) => item.endAt > startOfLocalDay(now)).map((item): [number, number] => [item.startAt, item.endAt])
    const grid = dayGrid(settings, now, taken, activeBreakStartAt ? [activeBreakStartAt, now] : null)
    return grid ? { kind: 'day', grid, colors } : null
  }, [activeBreakStartAt, breaks, colors, now, settings])

  return (
    <Card
      className="dashboard-widget-card salary-card salary-card--breaks"
      eyebrow={t('salary.breaks.eyebrow')}
      actions={<SalarySettingsButton onClick={openSettings} />}
    >
      <div className="salary-breaks">
        <div className="salary-breaks__now" data-running={running}>
          <div className="salary-breaks__figures">
            {running ? (
              <>
                <p className="salary-label salary-label--pen">{t('salary.breaks.running')}</p>
                <p className="salary-breaks__clock" role="timer">
                  {formatStopwatch(now - activeBreakStartAt)}
                </p>
                <p className="salary-meta">
                  {runningPay !== null
                    ? t('salary.breaks.runningPay', {
                        amount: money(runningPay),
                      })
                    : ' '}
                </p>
              </>
            ) : (
              <>
                <p className="salary-label">{t('salary.breaks.todayTotal')}</p>
                <DurationFigure seconds={today.ms / 1000} className="salary-breaks__total" />
                <p className="salary-meta">
                  {[
                    todayPay !== null ? t('salary.breaks.todayPay', { amount: money(todayPay) }) : null,
                    t('salary.breaks.week', {
                      duration: formatWorkDuration(week.ms / 1000, t),
                    }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </>
            )}
            <button type="button" className={`salary-btn ${running ? 'salary-btn--ink' : 'salary-btn--pen'}`} onClick={running ? stop : start}>
              {running ? t('salary.breaks.stop') : t('salary.breaks.start')}
            </button>
          </div>
          {gridParams ? <GridCanvas params={gridParams} className="salary-grid--day" /> : null}
        </div>

        {todaysBreaks.length > 0 ? (
          <ul className="salary-break-list">
            {todaysBreaks.map((item) => {
              const pay = settings ? earnedBetween(settings, item.startAt, item.endAt) : null
              return (
                <li key={item.id} className="salary-break-row">
                  <span className="salary-break-row__time">
                    {formatTimeOfDay(item.startAt)}–{formatTimeOfDay(item.endAt)}
                  </span>
                  <span className="salary-break-row__length">{formatWorkDuration((item.endAt - item.startAt) / 1000, t)}</span>
                  <span className="salary-row-end">
                    <span className="salary-break-row__pay">{pay === null ? '' : pay > 0 ? money(pay) : t('salary.breaks.unpaid')}</span>
                    <button type="button" className="salary-row-remove" onClick={() => remove(item.id)} aria-label={t('salary.breaks.remove')}>
                      <X size={12} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : running ? null : (
          <div className="salary-breaks__empty">
            <p>{t('salary.breaks.empty')}</p>
            <p>{t('salary.breaks.note')}</p>
          </div>
        )}
      </div>
      {settingsDialog}
    </Card>
  )
}

export default BreakLogCard
