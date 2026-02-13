import {
  readWeatherLastLocation,
  type TemperatureUnit,
  type WeatherStoredLocation,
  writeWeatherLastLocation,
} from '../../shared/prefs/preferences'
import { fetchThreeDayForecast, reverseGeocodeLocation, searchCityLocation, type WeatherDay, type WeatherLocation } from './weatherApi'

const BEIJING_LOCATION: WeatherLocation = {
  name: 'Beijing, China',
  latitude: 39.9042,
  longitude: 116.4074,
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000
const RETRY_INTERVAL_MS = 60 * 1000
const MAX_RETRY_ATTEMPTS = 3

export type WeatherConfig = {
  weatherAutoLocationEnabled: boolean
  weatherManualCity: string
  weatherTemperatureUnit: TemperatureUnit
}

export type WeatherLoadResult = {
  location: WeatherLocation
  days: WeatherDay[]
}

export type WeatherStatus = 'loading' | 'ready' | 'error'

export type WeatherSnapshot = {
  status: WeatherStatus
  data: WeatherLoadResult | null
}

type WeatherSubscriber = (snapshot: WeatherSnapshot) => void

const subscribers = new Set<WeatherSubscriber>()
let snapshot: WeatherSnapshot = { status: 'loading', data: null }
let currentConfig: WeatherConfig | null = null
let timerId: number | null = null
let inFlight = false
let pendingReload = false
let retryAttempts = 0
let lastSuccessAt: number | null = null
let started = false

function toStoredLocation(location: WeatherLocation): WeatherStoredLocation {
  return {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
  }
}

function fromStoredLocation(location: WeatherStoredLocation): WeatherLocation {
  return {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
  }
}

function getCurrentPosition(timeoutMs = 7000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 5 * 60 * 1000,
    })
  })
}

function publish(next: Partial<WeatherSnapshot>) {
  snapshot = { ...snapshot, ...next }
  subscribers.forEach((subscriber) => subscriber(snapshot))
}

function clearTimer() {
  if (timerId !== null) {
    window.clearTimeout(timerId)
    timerId = null
  }
}

function sameConfig(a: WeatherConfig, b: WeatherConfig) {
  return (
    a.weatherAutoLocationEnabled === b.weatherAutoLocationEnabled &&
    a.weatherManualCity === b.weatherManualCity &&
    a.weatherTemperatureUnit === b.weatherTemperatureUnit
  )
}

async function resolveLocation(config: WeatherConfig): Promise<WeatherLocation> {
  const last = readWeatherLastLocation()
  const fallback = last ? fromStoredLocation(last) : BEIJING_LOCATION

  if (config.weatherAutoLocationEnabled) {
    try {
      const position = await getCurrentPosition()
      const latitude = position.coords.latitude
      const longitude = position.coords.longitude
      const reverse = await reverseGeocodeLocation(latitude, longitude)
      return reverse ?? { name: 'Current location', latitude, longitude }
    } catch {
      return fallback
    }
  }

  if (config.weatherManualCity.trim()) {
    const resolved = await searchCityLocation(config.weatherManualCity)
    if (resolved) return resolved
  }

  return fallback
}

function scheduleNextFromLastSuccess() {
  const anchor = lastSuccessAt ?? Date.now()
  const delay = Math.max(anchor + REFRESH_INTERVAL_MS - Date.now(), 0)
  clearTimer()
  timerId = window.setTimeout(() => {
    void loadAndSchedule()
  }, delay)
}

function scheduleRetry() {
  clearTimer()
  timerId = window.setTimeout(() => {
    void loadAndSchedule()
  }, RETRY_INTERVAL_MS)
}

async function loadAndSchedule() {
  if (!currentConfig) return
  if (inFlight) return
  inFlight = true
  const configAtStart = currentConfig

  publish({ status: 'loading' })

  try {
    const location = await resolveLocation(configAtStart)
    const days = await fetchThreeDayForecast(location, configAtStart.weatherTemperatureUnit)
    if (!days.length) throw new Error('Empty forecast')

    if (currentConfig && sameConfig(configAtStart, currentConfig)) {
      writeWeatherLastLocation(toStoredLocation(location))
      publish({
        status: 'ready',
        data: { location, days },
      })
      retryAttempts = 0
      lastSuccessAt = Date.now()
      scheduleNextFromLastSuccess()
    }
  } catch {
    if (currentConfig && sameConfig(configAtStart, currentConfig)) {
      publish({ status: 'error' })
      if (retryAttempts < MAX_RETRY_ATTEMPTS) {
        retryAttempts += 1
        scheduleRetry()
      } else {
        retryAttempts = 0
        scheduleNextFromLastSuccess()
      }
    }
  } finally {
    inFlight = false
    if (pendingReload) {
      pendingReload = false
      void loadAndSchedule()
    }
  }
}

export function startWeatherRuntime(config: WeatherConfig) {
  if (!started) {
    started = true
    currentConfig = config
    void loadAndSchedule()
    return
  }

  if (currentConfig && sameConfig(currentConfig, config)) return

  currentConfig = config
  retryAttempts = 0
  clearTimer()

  if (inFlight) {
    pendingReload = true
    return
  }

  void loadAndSchedule()
}

export function subscribeWeatherRuntime(subscriber: WeatherSubscriber) {
  subscribers.add(subscriber)
  subscriber(snapshot)
  return () => {
    subscribers.delete(subscriber)
  }
}

export function getWeatherSnapshot() {
  return snapshot
}
