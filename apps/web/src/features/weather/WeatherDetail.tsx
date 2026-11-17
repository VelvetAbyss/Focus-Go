import { useEffect, useRef, useState, type RefObject } from 'react'
import { ChevronLeft, ChevronRight, Droplets, Eye, Gauge, Moon, RotateCcw, Sun, Sunrise, Sunset, Thermometer, Wind, type LucideIcon } from 'lucide-react'
import { getWeatherIconMeta } from './weatherIcons'
import { refreshWeatherRuntime, type WeatherSnapshot } from './weatherRuntime'
import type { TemperatureUnit } from '../../shared/prefs/preferences'
import { useI18n } from '../../shared/i18n/useI18n'
import { fetchWeatherAirQuality, fetchWeatherDetails, type DetailedWeather, type WeatherDetailDay, type WeatherHour } from './weatherDetailApi'
import './weather-detail.css'

type Props = { snapshot: WeatherSnapshot; unit: TemperatureUnit }

const number = (value: number | undefined, suffix = '', digits = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? `${Number(value.toFixed(digits))}${suffix}` : '—'
)
const clock = (value?: string) => value?.match(/T(\d{2}:\d{2})/)?.[1]
const direction = (degrees: number | undefined, zh: boolean) => {
  if (degrees === undefined) return null
  const labels = zh ? ['北', '东北', '东', '东南', '南', '西南', '西', '西北'] : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return labels[((Math.round(degrees / 45) % 8) + 8) % 8]
}

function WeatherCondition({ code, daylight, size }: { code?: number; daylight?: boolean; size: number }) {
  const { language } = useI18n()
  if (code === undefined) return <span className="weather-detail__unknown">—</span>
  const meta = getWeatherIconMeta(code)
  const Icon = code === 0 && daylight === false ? Moon : meta.Icon
  const label = language === 'zh' ? meta.labelZh : meta.label
  return <Icon size={size} className={meta.className} role="img" aria-label={label} />
}

function HourlyForecast({ hours, selected, selectedLabel, currentTime, isToday, sectionRef }: {
  hours: WeatherHour[]
  selected: string | undefined
  selectedLabel: string
  currentTime?: string
  isToday: boolean
  sectionRef: RefObject<HTMLElement | null>
}) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const scroll = useRef<HTMLUListElement>(null)
  const hour = currentTime?.slice(0, 13)
  const forDay = isToday && hour
    ? hours.filter(item => item.time.slice(0, 13) >= hour).slice(0, 24)
    : hours.filter(item => item.time.startsWith(selected ?? '_')).slice(0, 24)
  const heading = isToday ? (zh ? '未来 24 小时' : 'Next 24 hours') : (zh ? `${selectedLabel}逐小时` : `Hourly · ${selectedLabel}`)
  const move = (step: number) => {
    const element = scroll.current
    if (element) element.scrollBy({ left: step * Math.max(64, element.clientWidth - 64), behavior: 'auto' })
  }

  return (
    <section ref={sectionRef} tabIndex={-1} className="weather-detail__section" aria-label={heading}>
      <div className="weather-detail__heading">
        <h3>{heading}</h3>
        {forDay.length > 0 && <div className="weather-detail__arrows">
          <button type="button" onClick={() => move(-1)} aria-label={zh ? '向前看几小时' : 'Show earlier hours'}><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => move(1)} aria-label={zh ? '向后看几小时' : 'Show later hours'}><ChevronRight size={18} /></button>
        </div>}
      </div>
      {forDay.length > 0
        ? <ul ref={scroll} className="weather-detail__hours">
          {forDay.map((item, index) => (
            <li key={item.time}>
              <time dateTime={item.time}>{isToday && hour && index === 0 && item.time.startsWith(hour) ? (zh ? '现在' : 'Now') : clock(item.time)}</time>
              <WeatherCondition code={item.code} daylight={item.daylight} size={21} />
              <strong>{number(item.temperature, '°')}</strong>
              <span className="weather-detail__chance" aria-label={(zh ? '降水概率 ' : 'Precipitation chance ') + number(item.precipitation, '%')}>{number(item.precipitation, '%')}</span>
            </li>
          ))}
        </ul>
        : <p className="weather-detail__message">{zh ? '逐小时预报暂不可用' : 'Hourly forecast unavailable'}</p>}
    </section>
  )
}

function DailyForecast({ days, selected, onSelect, labelFor }: {
  days: WeatherDetailDay[]
  selected?: string
  onSelect: (date: string) => void
  labelFor: (date: string, index: number) => string
}) {
  const { language } = useI18n()
  const zh = language === 'zh'
  const low = Math.min(...days.map(day => day.tempMin))
  const high = Math.max(...days.map(day => day.tempMax))
  const scale = Math.max(1, high - low)
  return (
    <section className="weather-detail__section weather-detail__days-panel">
      <div className="weather-detail__heading"><h3>{zh ? `${days.length} 日预报` : `${days.length}-day forecast`}</h3></div>
      <ol className="weather-detail__days">
        {days.map((day, index) => {
          const left = Math.min(98, (day.tempMin - low) / scale * 100)
          const width = Math.max(2, (day.tempMax - day.tempMin) / scale * 100)
          return (
            <li key={day.date}>
              <button type="button" aria-pressed={selected === day.date} onClick={() => onSelect(day.date)}>
                <span className="weather-detail__day-label">{labelFor(day.date, index)}</span>
                <WeatherCondition code={day.weatherCode} size={18} />
                <span className="weather-detail__chance">{number(day.precipitationProbability, '%')}</span>
                <span className="weather-detail__low">{number(day.tempMin, '°')}</span>
                <span className="weather-detail__track" aria-hidden="true">
                  <span style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} />
                </span>
                <strong>{number(day.tempMax, '°')}</strong>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function WeatherDetail({ snapshot, unit }: Props) {
  const { t, language } = useI18n()
  const zh = language === 'zh'
  const [selected, setSelected] = useState<string>()
  const hourlySection = useRef<HTMLElement>(null)
  const [refreshCount, setRefreshCount] = useState(0)
  const [forecast, setForecast] = useState<{ key: string; data?: DetailedWeather; failed?: boolean }>()
  const [air, setAir] = useState<{ key: string; aqi?: number; pm25?: number }>()
  const location = snapshot.data?.location
  const latitude = location?.latitude
  const longitude = location?.longitude
  const overviewTime = snapshot.data?.current?.time
  const forecastKey = `${latitude}:${longitude}:${unit}:${overviewTime}:${refreshCount}`
  const forecastResult = forecast?.key === forecastKey ? forecast : undefined
  const details = forecastResult?.data
  const quality = air?.key === forecastKey ? air : undefined

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return
    const controller = new AbortController()
    void fetchWeatherDetails({ latitude, longitude }, unit, controller.signal).then(data => {
      if (!controller.signal.aborted) setForecast({ key: forecastKey, data })
    }, () => {
      if (!controller.signal.aborted) setForecast({ key: forecastKey, failed: true })
    })
    void fetchWeatherAirQuality({ latitude, longitude }, controller.signal).then(data => {
      if (!controller.signal.aborted) setAir({ key: forecastKey, ...data })
    }, () => {})
    return () => controller.abort()
  }, [latitude, longitude, unit, forecastKey])

  const fallback = snapshot.data?.current
  const current = details?.current
  const days: WeatherDetailDay[] = details?.days ?? snapshot.data?.days ?? []
  const today = days[0]
  const selectedIndex = Math.max(0, days.findIndex(day => day.date === selected))
  const displayDay = days[selectedIndex]
  const isToday = selectedIndex === 0
  const currentTime = current?.time ?? overviewTime
  const weatherCode = current?.code ?? fallback?.weatherCode
  const weatherMeta = weatherCode === undefined ? null : getWeatherIconMeta(weatherCode)
  const isNight = (current?.daylight ?? fallback?.isDay) === false
  const temperature = current?.temperature ?? fallback?.temperature
  const degrees = unit === 'fahrenheit' ? '°F' : '°C'
  const windUnit = unit === 'fahrenheit' ? ' mph' : ' km/h'
  const locale = zh ? 'zh-CN' : 'en-US'
  const labelFor = (date: string, index: number) => index === 0 ? t('weather.today')
    : new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  const currentWind = current?.wind ?? fallback?.windSpeed
  const windDirection = direction(current?.direction, zh)
  const metricCards: { title: string; value: string; hint?: string; Icon: LucideIcon }[] = [
    { title: zh ? '体感温度' : 'Feels like', value: number(current?.apparent ?? fallback?.apparentTemperature, degrees), Icon: Thermometer },
    { title: zh ? '相对湿度' : 'Humidity', value: number(current?.humidity ?? fallback?.humidity, '%'), hint: current?.dewPoint === undefined ? undefined : `${zh ? '露点' : 'Dew point'} ${number(current.dewPoint, degrees)}`, Icon: Droplets },
    { title: zh ? '风速与风向' : 'Wind', value: [windDirection ? (zh ? `${windDirection}风` : windDirection) : null, number(currentWind, windUnit)].filter(Boolean).join(' '), hint: current?.gusts === undefined ? undefined : `${zh ? '阵风' : 'Gusts'} ${number(current.gusts, windUnit)}`, Icon: Wind },
    { title: zh ? '能见度' : 'Visibility', value: current?.visibility === undefined ? '—' : number(current.visibility / (unit === 'fahrenheit' ? 1609.344 : 1000), unit === 'fahrenheit' ? ' mi' : ' km', 1), Icon: Eye },
    { title: zh ? '海平面气压' : 'Sea-level pressure', value: number(current?.pressure, ' hPa'), Icon: Gauge },
    { title: zh ? '空气质量 · 美国 AQI' : 'Air quality · US AQI', value: number(quality?.aqi), hint: quality?.pm25 === undefined ? undefined : `PM2.5 ${number(quality.pm25, ' μg/m³', 1)}`, Icon: Wind },
  ]
  const dayCards: typeof metricCards = [
    { title: zh ? '降水概率' : 'Precipitation chance', value: number(displayDay?.precipitationProbability, '%'), hint: displayDay?.precipitationTotal === undefined ? undefined : `${zh ? '全天降水量' : 'Daily total'} ${number(displayDay.precipitationTotal, ' mm', 1)}`, Icon: Droplets },
    { title: zh ? '最高紫外线指数' : 'Max UV index', value: number(displayDay?.uvIndex, '', 1), Icon: Sun },
    { title: zh ? '日出' : 'Sunrise', value: clock(displayDay?.sunrise) ?? '—', Icon: Sunrise },
    { title: zh ? '日落' : 'Sunset', value: clock(displayDay?.sunset) ?? '—', Icon: Sunset },
  ]
  const refresh = () => {
    if (!location || snapshot.status === 'error') refreshWeatherRuntime()
    setRefreshCount(count => count + 1)
  }
  const openDay = (date: string) => {
    setSelected(date)
    requestAnimationFrame(() => {
      hourlySection.current?.focus({ preventScroll: true })
      hourlySection.current?.scrollIntoView({ block: 'nearest' })
    })
  }
  const refreshing = snapshot.status === 'loading' || (Boolean(location) && !forecastResult)
  const selectedLabel = displayDay ? labelFor(displayDay.date, selectedIndex) : ''
  const renderMetric = ({ title, value, hint, Icon }: typeof metricCards[number]) => (
    <div key={title} className="weather-detail__metric">
      <dt><Icon size={15} aria-hidden="true" />{title}</dt>
      <dd>{value}</dd>
      {hint && <dd className="weather-detail__metric-hint">{hint}</dd>}
    </div>
  )

  return (
    <div className="weather-detail">
      <div className="weather-detail__hero" data-night={isNight}>
        <div className="weather-detail__place">
          <span>{zh ? '当前天气' : 'Current weather'}</span>
          <h3>{location?.name.split(',')[0] || (zh ? '本地天气' : 'Local weather')}</h3>
          <div className="weather-detail__temperature">{number(temperature, degrees)}</div>
          {weatherMeta && <p>{zh ? weatherMeta.labelZh : weatherMeta.label}</p>}
          {today && <p className="weather-detail__hi-lo">{zh ? '最高' : 'H'} {number(today.tempMax, '°')} <span>{zh ? '最低' : 'L'} {number(today.tempMin, '°')}</span></p>}
        </div>
        {weatherMeta && <div className="weather-detail__hero-icon"><WeatherCondition code={weatherCode} daylight={!isNight} size={78} /></div>}
        <button type="button" className="weather-detail__refresh" disabled={refreshing} onClick={refresh} aria-label={t('weather.refresh')} title={t('weather.refresh')}>
          <RotateCcw size={17} aria-hidden="true" />
        </button>
        {clock(currentTime) && <p className="weather-detail__updated">{zh ? '当地时间' : 'Local time'} {clock(currentTime)}</p>}
      </div>
      {refreshing && <p className="weather-detail__status" role="status">{zh ? '正在获取详细预报…' : 'Loading detailed forecast…'}</p>}
      {(forecastResult?.failed || (snapshot.status === 'error' && !details && !location)) && <p className="weather-detail__status" role="status">
        {days.length > 0 ? (zh ? '详细预报暂不可用，可刷新重试。' : 'Detailed forecast is unavailable. You can refresh to retry.') : t('weather.error')}
      </p>}
      {days.length > 0 && (
        <div className="weather-detail__layout">
          <div className="weather-detail__main">
            <HourlyForecast key={displayDay?.date} hours={details?.hours ?? []} selected={displayDay?.date} selectedLabel={selectedLabel} currentTime={currentTime} isToday={isToday} sectionRef={hourlySection} />
            <section className="weather-detail__section">
              <div className="weather-detail__heading"><h3>{zh ? '当前天气指标' : 'Current conditions'}</h3></div>
              <dl className="weather-detail__metrics">{metricCards.map(renderMetric)}</dl>
            </section>
          </div>
          <div className="weather-detail__side">
            <DailyForecast days={days} selected={displayDay?.date} onSelect={openDay} labelFor={labelFor} />
            <section className="weather-detail__section">
              <div className="weather-detail__heading"><h3>{zh ? `${selectedLabel}概况` : `Day details · ${selectedLabel}`}</h3></div>
              <dl className="weather-detail__metrics weather-detail__metrics--day">{dayCards.map(renderMetric)}</dl>
            </section>
          </div>
        </div>
      )}
      <p className="weather-detail__source">{details ? 'Open-Meteo' + (quality && (quality.aqi !== undefined || quality.pm25 !== undefined) ? ' · CAMS' : '') : ''}</p>
    </div>
  )
}
