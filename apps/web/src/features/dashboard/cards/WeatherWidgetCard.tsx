import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react'
import Card from '../../../shared/ui/Card'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { useThemeMode } from '../../../shared/theme/useThemeMode'
import { getWeatherIconMeta } from '../../weather/weatherIcons'
import {
  getWeatherSnapshot,
  refreshWeatherRuntime,
  startWeatherRuntime,
  subscribeWeatherRuntime,
  type WeatherSnapshot,
} from '../../weather/weatherRuntime'
import { buildSkyParams } from '../../weather/sky/skyModel'
import WeatherSky from '../../weather/sky/WeatherSky'
import { useI18n } from '../../../shared/i18n/useI18n'
import '../../weather/weather-card.css'

const dayLabel = (index: number) => {
  if (index === 0) return 'weather.today'
  if (index === 1) return 'weather.tomorrow'
  return 'weather.after'
}

const roundTemp = (value: number) => Math.round(value)

/** "2026-09-28T18:02" → "18:02" */
const clockOf = (value?: string) => (value ? /T(\d{2}:\d{2})/.exec(value)?.[1] ?? null : null)

/** "Hangzhou, China" → "Hangzhou" — the country repeats on every glance. */
const cityOf = (name?: string) => (name ? name.split(',')[0].trim() : '')

/**
 * Weather as a small window onto the sky: a live three.js sky painted for the
 * condition and the time of day at the location (dawn, day, dusk, night — with
 * the real moon phase), the temperature set in the numeral face, one meta line,
 * and a three-day strip that repaints the sky when you pick a day.
 */
const WeatherWidgetCard = () => {
  const { t, language } = useI18n()
  const theme = useThemeMode()
  const { weatherAutoLocationEnabled, weatherManualCity, weatherTemperatureUnit } = usePreferences()
  const [snapshot, setSnapshot] = useState<WeatherSnapshot>(() => getWeatherSnapshot())
  const [selectedIndex, setSelectedIndex] = useState(0)

  const unitSymbol = weatherTemperatureUnit === 'fahrenheit' ? 'F' : 'C'
  const windUnit = weatherTemperatureUnit === 'fahrenheit' ? 'mph' : 'km/h'

  useEffect(() => subscribeWeatherRuntime(setSnapshot), [])

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

  const rows = useMemo(() => snapshot.data?.days.slice(0, 3) ?? [], [snapshot.data?.days])
  const current = snapshot.data?.current ?? null
  const today = rows[0]
  const isToday = selectedIndex === 0
  const selectedDay = rows[selectedIndex] ?? today
  const code = isToday && current ? current.weatherCode : selectedDay?.weatherCode
  const temperature = isToday && current ? current.temperature : selectedDay?.tempMax
  const meta = typeof code === 'number' ? getWeatherIconMeta(code) : null

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(0)
  }, [rows.length, selectedIndex])

  // Today is drawn at the location's actual hour; other days at midday.
  const sky = useMemo(
    () =>
      buildSkyParams({
        code: code ?? null,
        theme,
        localTime: isToday ? current?.time ?? null : null,
        sunrise: isToday ? today?.sunrise : null,
        sunset: isToday ? today?.sunset : null,
        isDay: isToday ? current?.isDay ?? null : true,
      }),
    [code, theme, isToday, current?.time, current?.isDay, today?.sunrise, today?.sunset],
  )

  // Sunrise or sunset — whichever comes next — rides along the condition.
  const sunEvent = useMemo(() => {
    if (!isToday || !today) return null
    const now = clockOf(current?.time)
    const rise = clockOf(today.sunrise)
    const set = clockOf(today.sunset)
    if (!now || !rise || !set) return null
    if (now < rise) return t('weather.sunrise', { time: rise })
    if (now < set) return t('weather.sunset', { time: set })
    // After dark the useful fact is when the light comes back.
    const tomorrowRise = clockOf(rows[1]?.sunrise)
    return tomorrowRise ? t('weather.sunrise', { time: tomorrowRise }) : null
  }, [current?.time, isToday, rows, t, today])

  const metaItems: string[] = []
  if (isToday && current) {
    if (typeof current.apparentTemperature === 'number') metaItems.push(t('weather.feelsLike', { t: roundTemp(current.apparentTemperature) }))
    if (typeof current.humidity === 'number') metaItems.push(t('weather.humidity', { n: Math.round(current.humidity) }))
    if (typeof current.windSpeed === 'number') metaItems.push(t('weather.wind', { n: Math.round(current.windSpeed), unit: windUnit }))
  } else if (typeof selectedDay?.precipitationProbability === 'number') {
    metaItems.push(t('weather.precipitation', { n: selectedDay.precipitationProbability }))
  }

  const selectDay = (index: number) => {
    const update = () => setSelectedIndex(index)
    if ('startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ;(document as Document & { startViewTransition?: (update: () => void) => void }).startViewTransition?.(update)
      return
    }
    update()
  }

  const loadingLabel = language === 'zh' ? '正在获取天气…' : 'Loading weather…'
  const hasData = Boolean(snapshot.data)

  return (
    <Card
      className="weather-card dashboard-widget-card--weather"
      data-sky={sky.darkSky ? 'dark' : 'light'}
      data-family={sky.family}
      data-phase={sky.phase}
    >
      <WeatherSky params={sky} />

      <div className="weather-card__content">
        <header className="weather-card__head">
          <div className="weather-card__place">
            <p className="weather-card__city" title={snapshot.data?.location.name}>
              {cityOf(snapshot.data?.location.name) || t('weather.loading')}
            </p>
            <p className="weather-card__condition">
              {meta ? (
                <>
                  <meta.Icon size={13} strokeWidth={1.8} aria-hidden />
                  <span>{language === 'zh' ? meta.labelZh : meta.label}</span>
                  {sunEvent ? (
                    <>
                      <span className="weather-card__sep" aria-hidden>·</span>
                      <span>{sunEvent}</span>
                    </>
                  ) : null}
                </>
              ) : snapshot.status === 'error' && !hasData ? (
                t('weather.error')
              ) : (
                loadingLabel
              )}
            </p>
          </div>
          <button
            type="button"
            className={`weather-card__refresh${snapshot.status === 'loading' ? ' is-loading' : ''}`}
            onClick={() => refreshWeatherRuntime()}
            onPointerUp={(event) => event.currentTarget.blur()}
            aria-label={t('weather.refresh')}
            title={t('weather.refresh')}
            aria-busy={snapshot.status === 'loading'}
          >
            <RotateCcw size={13} strokeWidth={1.8} />
          </button>
        </header>

        <section className="weather-card__hero" aria-label={t(dayLabel(selectedIndex))}>
          <p
            className="weather-card__temp"
            key={selectedDay ? `${selectedDay.date}-${typeof temperature === 'number' ? roundTemp(temperature) : ''}` : 'temp-empty'}
          >
            <span className="weather-card__temp-value">{typeof temperature === 'number' ? roundTemp(temperature) : '--'}</span>
            <span className="weather-card__temp-unit">°{unitSymbol}</span>
          </p>
          {selectedDay ? (
          <p className="weather-card__meta">
            <span className="weather-card__range" aria-label={t('weather.rangeAria', { hi: selectedDay ? roundTemp(selectedDay.tempMax) : '--', lo: selectedDay ? roundTemp(selectedDay.tempMin) : '--' })}>
              <ArrowUp size={11} strokeWidth={2} aria-hidden />
              {selectedDay ? roundTemp(selectedDay.tempMax) : '--'}°
              <ArrowDown size={11} strokeWidth={2} aria-hidden />
              {selectedDay ? roundTemp(selectedDay.tempMin) : '--'}°
            </span>
            {metaItems.map((item) => (
              <span key={item} className="weather-card__meta-item">
                <span className="weather-card__sep" aria-hidden>·</span>
                {item}
              </span>
            ))}
          </p>
          ) : null}
        </section>

        {rows.length > 0 ? (
          <div className="weather-card__days" role="tablist" aria-label={t('weather.threeDayForecast')}>
            {rows.map((row, index) => {
              const rowCode = index === 0 && current ? current.weatherCode : row.weatherCode
              const rowCondition = index === 0 && current ? current.condition : row.condition
              const RowIcon = getWeatherIconMeta(rowCode).Icon
              const active = selectedIndex === index
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className="weather-card__day"
                  data-active={active ? 'true' : 'false'}
                  style={{ '--day-index': index } as CSSProperties}
                  key={row.date}
                  onClick={() => selectDay(index)}
                >
                  <span className="weather-card__day-label">{t(dayLabel(index))}</span>
                  <RowIcon size={14} strokeWidth={1.8} aria-label={rowCondition} />
                  <span className="weather-card__day-range">
                    <span className="weather-card__day-hi">{roundTemp(row.tempMax)}°</span>
                    <span className="weather-card__day-lo">{roundTemp(row.tempMin)}°</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export default WeatherWidgetCard
