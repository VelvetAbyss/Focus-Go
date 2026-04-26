import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'
import Card from '../../../shared/ui/Card'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { getWeatherIconMeta } from '../../weather/weatherIcons'
import {
  getWeatherSnapshot,
  refreshWeatherRuntime,
  startWeatherRuntime,
  subscribeWeatherRuntime,
  type WeatherSnapshot,
} from '../../weather/weatherRuntime'
import { useI18n } from '../../../shared/i18n/useI18n'

const dayLabel = (index: number) => {
  if (index === 0) return 'weather.today'
  if (index === 1) return 'weather.tomorrow'
  return 'weather.after'
}

const roundTemp = (value: number) => Math.round(value)

const ATMOS_PARTICLE_COUNT: Record<string, number> = {
  rain: 14,
  drizzle: 10,
  snow: 12,
  storm: 14,
}

const WeatherWidgetCard = () => {
  const { t, language } = useI18n()
  const { weatherAutoLocationEnabled, weatherManualCity, weatherTemperatureUnit } = usePreferences()
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(() => getWeatherSnapshot())
  const [selectedIndex, setSelectedIndex] = useState(0)

  const unitSymbol = weatherTemperatureUnit === 'fahrenheit' ? 'F' : 'C'

  useEffect(() => {
    return subscribeWeatherRuntime(setSnapshot)
  }, [])

  useEffect(() => {
    const start = () => {
      startWeatherRuntime({
        weatherAutoLocationEnabled,
        weatherManualCity,
        weatherTemperatureUnit,
      })
    }
    const idleId = window.requestIdleCallback?.(start, { timeout: 2500 })
    const timeoutId = idleId === undefined ? window.setTimeout(start, 1200) : null

    return () => {
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [weatherAutoLocationEnabled, weatherManualCity, weatherTemperatureUnit])

  const today = snapshot.data?.days[0]
  const rows = useMemo(() => snapshot.data?.days.slice(0, 3) ?? [], [snapshot.data?.days])
  const selectedDay = rows[selectedIndex] ?? today
  const selectedMeta = selectedDay ? getWeatherIconMeta(selectedDay.weatherCode) : null

  const effectiveTone = selectedMeta?.tone ?? 'cloud'

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(0)
  }, [rows.length, selectedIndex])

  const refreshAction = (
    <button
      type="button"
      className={`weather-widget__refresh${snapshot.status === 'loading' ? ' is-loading' : ''}`}
      onClick={() => refreshWeatherRuntime()}
      onPointerUp={(event) => event.currentTarget.blur()}
      aria-label={t('weather.refresh')}
      title={t('weather.refresh')}
      aria-busy={snapshot.status === 'loading'}
    >
      <RotateCcw size={14} strokeWidth={2} />
    </button>
  )

  const selectDay = (index: number) => {
    const update = () => setSelectedIndex(index)
    if ('startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ;(document as Document & { startViewTransition?: (update: () => void) => void }).startViewTransition?.(update)
      return
    }
    update()
  }

  const particleCount = ATMOS_PARTICLE_COUNT[effectiveTone] ?? 0
  const particles = useMemo(
    () => Array.from({ length: particleCount }, (_, i) => i),
    [particleCount],
  )

  return (
    <Card
      title={t('weather.cardTitle')}
      eyebrow={t('weather.today')}
      actions={refreshAction}
      className="weather-widget-card dashboard-widget-card--weather"
    >
      <div
        className="weather-widget"
        data-tone={effectiveTone}
      >
        {snapshot.status === 'error' && !snapshot.data ? (
          <p className="muted">{t('weather.error')}</p>
        ) : (
          <>
            <div className="weather-widget__atmos" aria-hidden="true">
              <span className="weather-widget__atmos-glow" />
              <span className="weather-widget__atmos-blob weather-widget__atmos-blob--a" />
              <span className="weather-widget__atmos-blob weather-widget__atmos-blob--b" />
              {particles.map((i) => (
                <span
                  key={i}
                  className="weather-widget__atmos-particle"
                  style={
                    {
                      '--p-i': i,
                      '--p-x': `${(i * 53) % 100}%`,
                      '--p-delay': `${(i * 137) % 1800}ms`,
                      '--p-duration': `${1200 + ((i * 213) % 1400)}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </div>

            <section className="weather-widget__hero" aria-label={t('weather.today')}>
              <div className="weather-widget__hero-top">
                <p className="weather-widget__city">
                  {snapshot.data?.location.name ?? t('weather.loading')}
                </p>
                <p className="weather-widget__condition">
                  {selectedMeta ? (
                    <>
                      <span className={`weather-icon ${selectedMeta.className}`} title={selectedMeta.label}>
                        <selectedMeta.Icon size={14} strokeWidth={2.1} />
                      </span>
                      <span key={selectedMeta.label}>
                        {language === 'zh' ? selectedMeta.labelZh : selectedMeta.label}
                      </span>
                    </>
                  ) : (
                    'Loading weather...'
                  )}
                </p>
              </div>
              <div
                className="weather-widget__temp"
                key={
                  selectedDay
                    ? `${selectedDay.date}-${roundTemp(selectedDay.tempMax)}-${roundTemp(selectedDay.tempMin)}`
                    : 'temp-empty'
                }
              >
                <span className="weather-widget__temp-value">
                  {selectedDay ? roundTemp(selectedDay.tempMax) : '--'}
                </span>
                <span className="weather-widget__temp-unit">°{unitSymbol}</span>
              </div>
              <p className="weather-widget__range">
                <span className="weather-widget__range-pair">
                  <span className="weather-widget__range-key">H</span>
                  {selectedDay ? roundTemp(selectedDay.tempMax) : '--'}°
                </span>
                <span className="weather-widget__range-sep" aria-hidden="true" />
                <span className="weather-widget__range-pair">
                  <span className="weather-widget__range-key">L</span>
                  {selectedDay ? roundTemp(selectedDay.tempMin) : '--'}°
                </span>
              </p>
            </section>

            <section
              className="weather-widget__segments"
              role="tablist"
              aria-label={t('weather.threeDayForecast')}
            >
              {rows.map((row, index) => {
                const rowIcon = getWeatherIconMeta(row.weatherCode)
                const RowIcon = rowIcon.Icon
                const active = selectedIndex === index
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="weather-widget__segment"
                    data-active={active ? 'true' : 'false'}
                    style={{ '--seg-index': index } as CSSProperties}
                    key={row.date}
                    onClick={() => selectDay(index)}
                  >
                    <span className="weather-widget__segment-label" title={t(dayLabel(index))}>
                      {t(dayLabel(index))}
                    </span>
                    <span
                      className={`weather-icon ${rowIcon.className}`}
                      title={row.condition}
                      aria-label={row.condition}
                    >
                      <RowIcon size={15} strokeWidth={2.05} />
                    </span>
                    <span className="weather-widget__segment-range">
                      <span className="weather-widget__segment-hi">{roundTemp(row.tempMax)}°</span>
                      <span className="weather-widget__segment-lo">{roundTemp(row.tempMin)}°</span>
                    </span>
                  </button>
                )
              })}
            </section>
          </>
        )}
      </div>
    </Card>
  )
}

export default WeatherWidgetCard
