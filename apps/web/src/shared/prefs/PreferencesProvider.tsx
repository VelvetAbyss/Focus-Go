import { useEffect, useMemo, useState } from 'react'
import { PreferencesContext } from './PreferencesContext'
import {
  DEFAULT_CURRENCY_KEY,
  NUMBER_ANIMATIONS_ENABLED_KEY,
  UI_ANIMATIONS_ENABLED_KEY,
  WEATHER_AUTO_LOCATION_KEY,
  WEATHER_MANUAL_CITY_KEY,
  WEATHER_TEMP_UNIT_KEY,
  type CurrencyCode,
  type TemperatureUnit,
  readDefaultCurrency,
  readNumberAnimationsEnabled,
  readUiAnimationsEnabled,
  readWeatherAutoLocation,
  readWeatherManualCity,
  readWeatherTemperatureUnit,
  writeDefaultCurrency,
  writeNumberAnimationsEnabled,
  writeUiAnimationsEnabled,
  writeWeatherAutoLocation,
  writeWeatherManualCity,
  writeWeatherTemperatureUnit,
} from './preferences'

const readInitialUiAnimationsEnabled = () => {
  const enabled = readUiAnimationsEnabled()
  document.documentElement.setAttribute('data-motion', enabled ? 'force' : 'reduce')
  return enabled
}

export const PreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  const [uiAnimationsEnabled, setUiAnimationsEnabledState] = useState(() => readInitialUiAnimationsEnabled())
  const [numberAnimationsEnabled, setNumberAnimationsEnabledState] = useState(() => readNumberAnimationsEnabled())
  const [defaultCurrency, setDefaultCurrencyState] = useState<CurrencyCode>(() => readDefaultCurrency())
  const [weatherAutoLocationEnabled, setWeatherAutoLocationEnabledState] = useState(() => readWeatherAutoLocation())
  const [weatherManualCity, setWeatherManualCityState] = useState(() => readWeatherManualCity())
  const [weatherTemperatureUnit, setWeatherTemperatureUnitState] = useState<TemperatureUnit>(() =>
    readWeatherTemperatureUnit()
  )

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null) {
        setUiAnimationsEnabledState(readUiAnimationsEnabled())
        setNumberAnimationsEnabledState(readNumberAnimationsEnabled())
        setDefaultCurrencyState(readDefaultCurrency())
        setWeatherAutoLocationEnabledState(readWeatherAutoLocation())
        setWeatherManualCityState(readWeatherManualCity())
        setWeatherTemperatureUnitState(readWeatherTemperatureUnit())
        return
      }

      if (event.key === UI_ANIMATIONS_ENABLED_KEY) {
        setUiAnimationsEnabledState(readUiAnimationsEnabled())
        return
      }

      if (event.key === NUMBER_ANIMATIONS_ENABLED_KEY) {
        setNumberAnimationsEnabledState(readNumberAnimationsEnabled())
        return
      }

      if (event.key === DEFAULT_CURRENCY_KEY) {
        setDefaultCurrencyState(readDefaultCurrency())
        return
      }

      if (event.key === WEATHER_AUTO_LOCATION_KEY) {
        setWeatherAutoLocationEnabledState(readWeatherAutoLocation())
        return
      }

      if (event.key === WEATHER_MANUAL_CITY_KEY) {
        setWeatherManualCityState(readWeatherManualCity())
        return
      }

      if (event.key === WEATHER_TEMP_UNIT_KEY) {
        setWeatherTemperatureUnitState(readWeatherTemperatureUnit())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-motion', uiAnimationsEnabled ? 'force' : 'reduce')
  }, [uiAnimationsEnabled])

  const value = useMemo(() => {
    return {
      uiAnimationsEnabled,
      setUiAnimationsEnabled: (enabled: boolean) => {
        writeUiAnimationsEnabled(enabled)
        setUiAnimationsEnabledState(enabled)
      },
      numberAnimationsEnabled,
      setNumberAnimationsEnabled: (enabled: boolean) => {
        writeNumberAnimationsEnabled(enabled)
        setNumberAnimationsEnabledState(enabled)
      },
      defaultCurrency,
      setDefaultCurrency: (currency: CurrencyCode) => {
        writeDefaultCurrency(currency)
        setDefaultCurrencyState(currency)
      },
      weatherAutoLocationEnabled,
      setWeatherAutoLocationEnabled: (enabled: boolean) => {
        writeWeatherAutoLocation(enabled)
        setWeatherAutoLocationEnabledState(enabled)
      },
      weatherManualCity,
      setWeatherManualCity: (city: string) => {
        writeWeatherManualCity(city)
        setWeatherManualCityState(city.trim())
      },
      weatherTemperatureUnit,
      setWeatherTemperatureUnit: (unit: TemperatureUnit) => {
        writeWeatherTemperatureUnit(unit)
        setWeatherTemperatureUnitState(unit)
      },
    }
  }, [
    defaultCurrency,
    numberAnimationsEnabled,
    uiAnimationsEnabled,
    weatherAutoLocationEnabled,
    weatherManualCity,
    weatherTemperatureUnit,
  ])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
