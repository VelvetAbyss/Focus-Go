import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Card from '../../../shared/ui/Card'
import { usePreferences } from '../../../shared/prefs/usePreferences'
import { getWeatherIconMeta } from '../../weather/weatherIcons'
import {
  getWeatherSnapshot,
  startWeatherRuntime,
  subscribeWeatherRuntime,
  type WeatherSnapshot,
} from '../../weather/weatherRuntime'

const dayLabel = (index: number) => {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return 'After'
}

const roundTemp = (value: number) => Math.round(value)

const WeatherWidgetCard = () => {
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
  const progressWidth = rows.length > 1 ? `${(selectedIndex / (rows.length - 1)) * 100}%` : '0%'

  useEffect(() => {
    if (selectedIndex >= rows.length) setSelectedIndex(0)
  }, [rows.length, selectedIndex])

  const widgetStyle = {
    '--weather-progress': progressWidth,
  } as CSSProperties

  const selectDay = (index: number) => {
    const update = () => setSelectedIndex(index)
    if ('startViewTransition' in document && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ;(document as Document & { startViewTransition?: (update: () => void) => void }).startViewTransition?.(update)
      return
    }
    update()
  }

  return (
    <Card title="Weather" eyebrow="Today" className="weather-widget-card">
      <div
        className={`weather-widget weather-widget--tone-${selectedMeta?.tone ?? 'cloud'}`}
        style={widgetStyle}
      >
        {snapshot.status === 'error' ? (
          <p className="muted">天气暂不可用</p>
        ) : (
          <>
            <section className="weather-widget__main" aria-label="Today's weather">
              <p className="weather-widget__city">{snapshot.data?.location.name ?? 'Loading location...'}</p>
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
                    <span key={selectedMeta.label}>{selectedMeta.label}</span>
                  </>
                ) : (
                  'Loading weather...'
                )}
              </p>
              <div className="weather-widget__timeline" aria-hidden>
                <span className="weather-widget__timeline-progress" />
              </div>
            </section>

            <section className="weather-widget__days" aria-label="Three day forecast">
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
                    <span className="weather-widget__day-label" title={dayLabel(index)}>{dayLabel(index)}</span>
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
