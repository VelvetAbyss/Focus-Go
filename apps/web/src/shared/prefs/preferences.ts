export const NUMBER_ANIMATIONS_ENABLED_KEY = 'workbench.numberAnimations.enabled'
export const UI_ANIMATIONS_ENABLED_KEY = 'workbench.uiAnimations.enabled'
export const DEFAULT_CURRENCY_KEY = 'workbench.spend.defaultCurrency'
export const WEATHER_AUTO_LOCATION_KEY = 'workbench.weather.autoLocation'
export const WEATHER_MANUAL_CITY_KEY = 'workbench.weather.manualCity'
export const WEATHER_TEMP_UNIT_KEY = 'workbench.weather.temperatureUnit'
export const WEATHER_LAST_LOCATION_KEY = 'workbench.weather.lastLocation'

export type CurrencyCode = 'CNY' | 'USD'
export type TemperatureUnit = 'celsius' | 'fahrenheit'
export type WeatherStoredLocation = {
  name: string
  latitude: number
  longitude: number
}

export function readNumberAnimationsEnabled(): boolean {
  const raw = localStorage.getItem(NUMBER_ANIMATIONS_ENABLED_KEY)
  if (raw === null) return true
  return raw === 'true'
}

export function writeNumberAnimationsEnabled(enabled: boolean) {
  localStorage.setItem(NUMBER_ANIMATIONS_ENABLED_KEY, enabled ? 'true' : 'false')
}

export function readUiAnimationsEnabled(): boolean {
  const raw = localStorage.getItem(UI_ANIMATIONS_ENABLED_KEY)
  if (raw === null) return true
  return raw === 'true'
}

export function writeUiAnimationsEnabled(enabled: boolean) {
  localStorage.setItem(UI_ANIMATIONS_ENABLED_KEY, enabled ? 'true' : 'false')
}

export function readDefaultCurrency(): CurrencyCode {
  const raw = localStorage.getItem(DEFAULT_CURRENCY_KEY)
  if (raw === 'CNY' || raw === 'USD') return raw
  return 'USD'
}

export function writeDefaultCurrency(currency: CurrencyCode) {
  localStorage.setItem(DEFAULT_CURRENCY_KEY, currency)
}

export function readWeatherAutoLocation(): boolean {
  const raw = localStorage.getItem(WEATHER_AUTO_LOCATION_KEY)
  if (raw === null) return true
  return raw === 'true'
}

export function writeWeatherAutoLocation(enabled: boolean) {
  localStorage.setItem(WEATHER_AUTO_LOCATION_KEY, enabled ? 'true' : 'false')
}

export function readWeatherManualCity(): string {
  return localStorage.getItem(WEATHER_MANUAL_CITY_KEY) ?? ''
}

export function writeWeatherManualCity(city: string) {
  localStorage.setItem(WEATHER_MANUAL_CITY_KEY, city.trim())
}

export function readWeatherTemperatureUnit(): TemperatureUnit {
  const raw = localStorage.getItem(WEATHER_TEMP_UNIT_KEY)
  if (raw === 'celsius' || raw === 'fahrenheit') return raw
  return 'celsius'
}

export function writeWeatherTemperatureUnit(unit: TemperatureUnit) {
  localStorage.setItem(WEATHER_TEMP_UNIT_KEY, unit)
}

export function readWeatherLastLocation(): WeatherStoredLocation | null {
  const raw = localStorage.getItem(WEATHER_LAST_LOCATION_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as WeatherStoredLocation
    if (
      typeof parsed?.name === 'string' &&
      typeof parsed?.latitude === 'number' &&
      typeof parsed?.longitude === 'number'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function writeWeatherLastLocation(location: WeatherStoredLocation) {
  localStorage.setItem(WEATHER_LAST_LOCATION_KEY, JSON.stringify(location))
}
