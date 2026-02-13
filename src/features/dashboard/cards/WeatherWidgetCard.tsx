import { useEffect, useMemo, useState } from 'react'
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
  const todayIconMeta = today ? getWeatherIconMeta(today.weatherCode) : null

  return (
    <Card title="Weather" eyebrow="Today" className="weather-widget-card">
      <div className="weather-widget">
        {snapshot.status === 'error' ? (
          <p className="muted">天气暂不可用</p>
        ) : (
          <>
            <section className="weather-widget__main" aria-label="Today's weather">
              <p className="weather-widget__city">{snapshot.data?.location.name ?? 'Loading location...'}</p>
              <div className="weather-widget__temp">
                {today ? `${roundTemp(today.tempMax)}°${unitSymbol}` : `--°${unitSymbol}`}
              </div>
              <p className="weather-widget__range">
                H {today ? roundTemp(today.tempMax) : '--'}° · L {today ? roundTemp(today.tempMin) : '--'}°
              </p>
              <p className="weather-widget__condition">
                {todayIconMeta ? (
                  <>
                    <span className={`weather-icon ${todayIconMeta.className}`} title={todayIconMeta.label}>
                      <todayIconMeta.Icon size={16} strokeWidth={2.1} />
                    </span>
                    <span>{todayIconMeta.label}</span>
                  </>
                ) : (
                  'Loading weather...'
                )}
              </p>
            </section>

            <section className="weather-widget__days" aria-label="Three day forecast">
              {rows.map((row, index) => {
                const rowIcon = getWeatherIconMeta(row.weatherCode)
                const RowIcon = rowIcon.Icon
                return (
                  <div className="weather-widget__row" key={row.date}>
                    <span className="weather-widget__day-label">{dayLabel(index)}</span>
                    <span className={`weather-icon ${rowIcon.className}`} title={row.condition} aria-label={row.condition}>
                      <RowIcon size={15} strokeWidth={2.05} />
                    </span>
                    <span className="weather-widget__day-range">
                      {roundTemp(row.tempMax)}° / {roundTemp(row.tempMin)}°
                    </span>
                  </div>
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
