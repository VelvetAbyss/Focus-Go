import { useEffect, useMemo, useState } from 'react'
import { PreferencesContext } from './PreferencesContext'
import {
  DEFAULT_CURRENCY_KEY,
  LANGUAGE_KEY,
  NUMBER_ANIMATIONS_ENABLED_KEY,
  UI_ANIMATIONS_ENABLED_KEY,
  WEATHER_AUTO_LOCATION_KEY,
  FOCUS_COMPLETION_SOUND_ENABLED_KEY,
  NETEASE_EXPERIMENTAL_PLAYBACK_CONFIRMED_KEY,
  NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY,
  TASK_REMINDER_ENABLED_KEY,
  TASK_REMINDER_LEAD_MINUTES_KEY,
  WEATHER_MANUAL_CITY_KEY,
  WEATHER_TEMP_UNIT_KEY,
  type CurrencyCode,
  type LanguageCode,
  type TemperatureUnit,
  readDefaultCurrency,
  readLanguage,
  readNumberAnimationsEnabled,
  readFocusCompletionSoundEnabled,
  readNeteaseExperimentalPlaybackConfirmed,
  readNeteaseExperimentalPlaybackEnabled,
  readTaskReminderEnabled,
  readTaskReminderLeadMinutes,
  readUiAnimationsEnabled,
  readWeatherAutoLocation,
  readWeatherManualCity,
  readWeatherTemperatureUnit,
  writeDefaultCurrency,
  writeLanguage,
  writeNumberAnimationsEnabled,
  writeFocusCompletionSoundEnabled,
  writeNeteaseExperimentalPlaybackConfirmed,
  writeNeteaseExperimentalPlaybackEnabled,
  writeTaskReminderEnabled,
  writeTaskReminderLeadMinutes,
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
  const [language, setLanguageState] = useState<LanguageCode>(() => readLanguage())
  const [uiAnimationsEnabled, setUiAnimationsEnabledState] = useState(() => readInitialUiAnimationsEnabled())
  const [numberAnimationsEnabled, setNumberAnimationsEnabledState] = useState(() => readNumberAnimationsEnabled())
  const [defaultCurrency, setDefaultCurrencyState] = useState<CurrencyCode>(() => readDefaultCurrency())
  const [weatherAutoLocationEnabled, setWeatherAutoLocationEnabledState] = useState(() => readWeatherAutoLocation())
  const [weatherManualCity, setWeatherManualCityState] = useState(() => readWeatherManualCity())
  const [weatherTemperatureUnit, setWeatherTemperatureUnitState] = useState<TemperatureUnit>(() =>
    readWeatherTemperatureUnit()
  )
  const [focusCompletionSoundEnabled, setFocusCompletionSoundEnabledState] = useState(() => readFocusCompletionSoundEnabled())
  const [taskReminderEnabled, setTaskReminderEnabledState] = useState(() => readTaskReminderEnabled())
  const [taskReminderLeadMinutes, setTaskReminderLeadMinutesState] = useState(() => readTaskReminderLeadMinutes())
  const [neteaseExperimentalPlaybackEnabled, setNeteaseExperimentalPlaybackEnabledState] = useState(() => readNeteaseExperimentalPlaybackEnabled())
  const [neteaseExperimentalPlaybackConfirmed, setNeteaseExperimentalPlaybackConfirmedState] = useState(() => readNeteaseExperimentalPlaybackConfirmed())

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null) {
        setLanguageState(readLanguage())
        setUiAnimationsEnabledState(readUiAnimationsEnabled())
        setNumberAnimationsEnabledState(readNumberAnimationsEnabled())
        setDefaultCurrencyState(readDefaultCurrency())
        setWeatherAutoLocationEnabledState(readWeatherAutoLocation())
        setWeatherManualCityState(readWeatherManualCity())
        setWeatherTemperatureUnitState(readWeatherTemperatureUnit())
        setFocusCompletionSoundEnabledState(readFocusCompletionSoundEnabled())
        setTaskReminderEnabledState(readTaskReminderEnabled())
        setTaskReminderLeadMinutesState(readTaskReminderLeadMinutes())
        setNeteaseExperimentalPlaybackEnabledState(readNeteaseExperimentalPlaybackEnabled())
        setNeteaseExperimentalPlaybackConfirmedState(readNeteaseExperimentalPlaybackConfirmed())
        return
      }

      if (event.key === UI_ANIMATIONS_ENABLED_KEY) {
        setUiAnimationsEnabledState(readUiAnimationsEnabled())
        return
      }

      if (event.key === LANGUAGE_KEY) {
        setLanguageState(readLanguage())
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
        return
      }

      if (event.key === FOCUS_COMPLETION_SOUND_ENABLED_KEY) {
        setFocusCompletionSoundEnabledState(readFocusCompletionSoundEnabled())
        return
      }

      if (event.key === TASK_REMINDER_ENABLED_KEY) {
        setTaskReminderEnabledState(readTaskReminderEnabled())
        return
      }

      if (event.key === TASK_REMINDER_LEAD_MINUTES_KEY) {
        setTaskReminderLeadMinutesState(readTaskReminderLeadMinutes())
        return
      }

      if (event.key === NETEASE_EXPERIMENTAL_PLAYBACK_ENABLED_KEY) {
        setNeteaseExperimentalPlaybackEnabledState(readNeteaseExperimentalPlaybackEnabled())
        return
      }

      if (event.key === NETEASE_EXPERIMENTAL_PLAYBACK_CONFIRMED_KEY) {
        setNeteaseExperimentalPlaybackConfirmedState(readNeteaseExperimentalPlaybackConfirmed())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-motion', uiAnimationsEnabled ? 'force' : 'reduce')
  }, [uiAnimationsEnabled])

  useEffect(() => {
    document.documentElement.setAttribute('lang', language)
  }, [language])

  const value = useMemo(() => {
    return {
      language,
      setLanguage: (nextLanguage: LanguageCode) => {
        writeLanguage(nextLanguage)
        setLanguageState(nextLanguage)
      },
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
      focusCompletionSoundEnabled,
      setFocusCompletionSoundEnabled: (enabled: boolean) => {
        writeFocusCompletionSoundEnabled(enabled)
        setFocusCompletionSoundEnabledState(enabled)
      },
      taskReminderEnabled,
      setTaskReminderEnabled: (enabled: boolean) => {
        writeTaskReminderEnabled(enabled)
        setTaskReminderEnabledState(enabled)
      },
      taskReminderLeadMinutes,
      setTaskReminderLeadMinutes: (minutes: number) => {
        writeTaskReminderLeadMinutes(minutes)
        setTaskReminderLeadMinutesState(Math.max(1, Math.floor(minutes)))
      },
      neteaseExperimentalPlaybackEnabled,
      setNeteaseExperimentalPlaybackEnabled: (enabled: boolean) => {
        writeNeteaseExperimentalPlaybackEnabled(enabled)
        setNeteaseExperimentalPlaybackEnabledState(enabled)
      },
      neteaseExperimentalPlaybackConfirmed,
      setNeteaseExperimentalPlaybackConfirmed: (confirmed: boolean) => {
        writeNeteaseExperimentalPlaybackConfirmed(confirmed)
        setNeteaseExperimentalPlaybackConfirmedState(confirmed)
      },
    }
  }, [
    language,
    defaultCurrency,
    focusCompletionSoundEnabled,
    taskReminderEnabled,
    taskReminderLeadMinutes,
    neteaseExperimentalPlaybackConfirmed,
    neteaseExperimentalPlaybackEnabled,
    numberAnimationsEnabled,
    uiAnimationsEnabled,
    weatherAutoLocationEnabled,
    weatherManualCity,
    weatherTemperatureUnit,
  ])

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
