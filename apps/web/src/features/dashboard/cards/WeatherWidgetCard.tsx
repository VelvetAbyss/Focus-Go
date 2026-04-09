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
    startWeatherRuntime({
      weatherAutoLocationEnabled,
      weatherManualCity,
      weatherTemperatureUnit,
    })
  }, [weatherAutoLocationEnabled, weatherManualCity, weatherTemperatureUnit])

  const today = snapshot.data?.days[0]
  const rows = useMemo(() => snapshot.data?.days.slice(0, 3) ?? [], [snapshot.data?.days])
  const selectedDay = rows[selectedIndex] ?? today
  const selectedMeta = selectedDay ? getWeatherIconMeta(selectedDay.weatherCode) : null
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

  return (
    <Card
      title={t('weather.cardTitle')}
      eyebrow={t('weather.today')}
      actions={refreshAction}
      className="weather-widget-card dashboard-widget-card--weather"
    >
      <div className={`weather-widget weather-widget--tone-${selectedMeta?.tone ?? 'cloud'}`}>
        {snapshot.status === 'error' && !snapshot.data ? (
          <p className="muted">{t('weather.error')}</p>
        ) : (
          <>
            <section className="weather-widget__main" aria-label={t('weather.today')}>
              <p className="weather-widget__city">{snapshot.data?.location.name ?? t('weather.loading')}</p>
              <div
                className="weather-widget__temp"
                key={
                  selectedDay
                    ? `${selectedDay.date}-${roundTemp(selectedDay.tempMax)}-${roundTemp(selectedDay.tempMin)}`
                    : 'temp-empty'
                }
              >
                {selectedDay ? `${roundTemp(selectedDay.tempMax)}°${unitSymbol}` : `--°${unitSymbol}`}
              </div>
              <p className="weather-widget__range">
                H {selectedDay ? roundTemp(selectedDay.tempMax) : '--'}° · L {selectedDay ? roundTemp(selectedDay.tempMin) : '--'}°
              </p>
              <p className="weather-widget__condition">
                {selectedMeta ? (
                  <>
                    <span className={`weather-icon ${selectedMeta.className}`} title={selectedMeta.label}>
                      <selectedMeta.Icon size={16} strokeWidth={2.1} />
                    </span>
                    <span key={selectedMeta.label}>{language === 'zh' ? selectedMeta.labelZh : selectedMeta.label}</span>
                  </>
                ) : (
                  'Loading weather...'
                )}
              </p>
            </section>

            <section className="weather-widget__days" aria-label={t('weather.threeDayForecast')}>
              {rows.map((row, index) => {
                const rowIcon = getWeatherIconMeta(row.weatherCode)
                const RowIcon = rowIcon.Icon
                return (
                  <button
                    type="button"
                    className="weather-widget__row"
                    data-active={selectedIndex === index ? 'true' : 'false'}
                    style={{ '--row-index': index } as CSSProperties}
                    key={row.date}
                    onClick={() => selectDay(index)}
                  >
                    <span className="weather-widget__day-label" title={t(dayLabel(index))}>{t(dayLabel(index))}</span>
                    <span className={`weather-icon ${rowIcon.className}`} title={row.condition} aria-label={row.condition}>
                      <RowIcon size={15} strokeWidth={2.05} />
                    </span>
                    <span className="weather-widget__day-range">
                      {roundTemp(row.tempMax)}° / {roundTemp(row.tempMin)}°
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
