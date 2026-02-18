import { createContext } from 'react'

export type PreferencesContextValue = {
  uiAnimationsEnabled: boolean
  setUiAnimationsEnabled: (enabled: boolean) => void
  numberAnimationsEnabled: boolean
  setNumberAnimationsEnabled: (enabled: boolean) => void
  defaultCurrency: import('./preferences').CurrencyCode
  setDefaultCurrency: (currency: import('./preferences').CurrencyCode) => void
  weatherAutoLocationEnabled: boolean
  setWeatherAutoLocationEnabled: (enabled: boolean) => void
  weatherManualCity: string
  setWeatherManualCity: (city: string) => void
  weatherTemperatureUnit: import('./preferences').TemperatureUnit
  setWeatherTemperatureUnit: (unit: import('./preferences').TemperatureUnit) => void
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(null)
