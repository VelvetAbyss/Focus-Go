import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../../shared/ui/Card'
import Button from '../../shared/ui/Button'
import Select from '../../shared/ui/Select'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { applyTheme, clearStoredThemePreference, resolveTheme, writeStoredThemePreference } from '../../shared/theme/theme'
import type { DashboardLayout } from '../../data/models/types'
import { usePreferences } from '../../shared/prefs/usePreferences'

const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'

type ThemeSelection = 'system' | 'light' | 'dark'
type CitySuggestion = {
  id: string
  label: string
  searchValue: string
  score: number
  source: 'local' | 'remote'
}
type OpenMeteoGeocodeResponse = {
  results?: Array<{
    id?: number
    name?: string
    country?: string
    admin1?: string
  }>
}
type OpenMeteoGeocodeResult = NonNullable<OpenMeteoGeocodeResponse['results']>[number]

const MIN_CITY_QUERY_LENGTH = 2
const MAX_CITY_SUGGESTIONS = 8

const LOCAL_CITY_CANDIDATES: Array<{ label: string; tokens: string[] }> = [
  { label: 'Hangzhou, China', tokens: ['hangzhou', 'hang zhou', 'hz', '杭州'] },
  { label: 'Beijing, China', tokens: ['beijing', 'peking', '北京'] },
  { label: 'Shanghai, China', tokens: ['shanghai', '上海'] },
  { label: 'Shenzhen, China', tokens: ['shenzhen', '深圳'] },
  { label: 'Guangzhou, China', tokens: ['guangzhou', 'guang zhou', '广州'] },
  { label: 'Chengdu, China', tokens: ['chengdu', 'cheng du', '成都'] },
  { label: 'Wuhan, China', tokens: ['wuhan', '武汉'] },
  { label: 'Nanjing, China', tokens: ['nanjing', '南京'] },
  { label: "Xi'an, China", tokens: ['xian', "xi'an", '西安'] },
  { label: 'Tokyo, Japan', tokens: ['tokyo'] },
  { label: 'Seoul, South Korea', tokens: ['seoul'] },
  { label: 'Singapore, Singapore', tokens: ['singapore'] },
  { label: 'London, United Kingdom', tokens: ['london'] },
  { label: 'Paris, France', tokens: ['paris'] },
  { label: 'Berlin, Germany', tokens: ['berlin'] },
  { label: 'Sydney, Australia', tokens: ['sydney'] },
  { label: 'New York, United States', tokens: ['new york', 'nyc'] },
  { label: 'Los Angeles, United States', tokens: ['los angeles', 'la'] },
  { label: 'San Francisco, United States', tokens: ['san francisco', 'sf'] },
  { label: 'Chicago, United States', tokens: ['chicago'] },
]

const readLayoutLocked = () => {
  const raw = localStorage.getItem(LAYOUT_LOCK_KEY)
  if (raw === null) return true
  return raw !== 'false'
}

const writeLayoutLocked = (locked: boolean) => {
  localStorage.setItem(LAYOUT_LOCK_KEY, locked ? 'true' : 'false')
}

const normalizeQuery = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const CJK_CHAR_RE = /[\u3400-\u9fff]/u
const hasCjkChar = (value: string) => CJK_CHAR_RE.test(value)

const getSubsequenceScore = (query: string, target: string) => {
  let queryIndex = 0
  let penalty = 0
  for (let targetIndex = 0; targetIndex < target.length && queryIndex < query.length; targetIndex += 1) {
    if (target[targetIndex] === query[queryIndex]) {
      queryIndex += 1
    } else {
      penalty += 1
    }
  }
  if (queryIndex !== query.length) return -1
  return 420 - penalty
}

const getTokenMatchScore = (query: string, token: string) => {
  if (!query || !token) return -1
  if (token.startsWith(query)) return 1200 - (token.length - query.length)

  const containsIndex = token.indexOf(query)
  if (containsIndex >= 0) return 800 - containsIndex * 2 - (token.length - query.length)

  return getSubsequenceScore(query, token)
}

const buildLocalSuggestions = (query: string): CitySuggestion[] => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  return LOCAL_CITY_CANDIDATES.map((candidate) => {
    const tokens = [candidate.label, ...candidate.tokens].map((token) => normalizeQuery(token))
    const score = Math.max(...tokens.map((token) => getTokenMatchScore(normalizedQuery, token)))
    return {
      id: `local:${candidate.label}`,
      label: candidate.label,
      searchValue: candidate.label,
      score,
      source: 'local' as const,
    }
  })
    .filter((candidate) => candidate.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}

const searchRemoteCitySuggestions = async (query: string, signal: AbortSignal): Promise<CitySuggestion[]> => {
  const normalizedQuery = normalizeQuery(query)
  if (normalizedQuery.length < MIN_CITY_QUERY_LENGTH) return []

  const languages: Array<'en' | 'zh'> = hasCjkChar(query) ? ['zh', 'en'] : ['en', 'zh']
  const resultsByLang = await Promise.all(
    languages.map(async (language) => {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${MAX_CITY_SUGGESTIONS}&language=${language}&format=json`,
        { signal }
      )
      if (!response.ok) return [] as OpenMeteoGeocodeResult[]
      const payload = (await response.json()) as OpenMeteoGeocodeResponse
      return payload.results ?? []
    })
  )
  const results: OpenMeteoGeocodeResult[] = resultsByLang.flat()

  return results
    .reduce<CitySuggestion[]>((acc, result, index) => {
      const name = result?.name?.trim()
      if (!name) return acc

      const suffix = [result.admin1, result.country].filter(Boolean).join(', ')
      const label = suffix ? `${name}, ${suffix}` : name
      const score = Math.max(
        getTokenMatchScore(normalizedQuery, normalizeQuery(name)),
        getTokenMatchScore(normalizedQuery, normalizeQuery(label))
      )
      if (score < 0) return acc

      acc.push({
        id: `remote:${result.id ?? `${label}:${index}`}`,
        label,
        searchValue: label,
        score,
        source: 'remote' as const,
      })
      return acc
    }, [])
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CITY_SUGGESTIONS)
}

const SettingsRoute = () => {
  const [layoutLocked, setLayoutLocked] = useState(() => readLayoutLocked())
  const [theme, setTheme] = useState<ThemeSelection>('system')
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null)
  const {
    uiAnimationsEnabled,
    setUiAnimationsEnabled,
    numberAnimationsEnabled,
    setNumberAnimationsEnabled,
    defaultCurrency,
    setDefaultCurrency,
    weatherAutoLocationEnabled,
    setWeatherAutoLocationEnabled,
    weatherManualCity,
    setWeatherManualCity,
    weatherTemperatureUnit,
    setWeatherTemperatureUnit,
  } = usePreferences()
  const [manualCityInput, setManualCityInput] = useState(weatherManualCity)
  const [manualCityOpen, setManualCityOpen] = useState(false)
  const [manualCityHasPendingSelection, setManualCityHasPendingSelection] = useState(false)
  const [manualCityRemoteSearch, setManualCityRemoteSearch] = useState<{ query: string; suggestions: CitySuggestion[] }>({
    query: '',
    suggestions: [],
  })
  const [manualCityActiveIndex, setManualCityActiveIndex] = useState(-1)

  useEffect(() => {
    dashboardRepo.get().then((stored) => {
      setDashboard(stored)
      const override = stored?.themeOverride
      setTheme(override === 'light' || override === 'dark' ? override : 'system')
    })
  }, [])

  const themeHelp = useMemo(() => {
    if (theme === 'system') return 'Auto day/night + system preference'
    return `Force ${theme} theme`
  }, [theme])

  const saveThemeOverride = async (next: ThemeSelection) => {
    const themeOverride = next === 'system' ? null : next

    const stored = (await dashboardRepo.get()) ?? dashboard
    const items = stored?.items ?? []
    const updated = await dashboardRepo.upsert({ items, themeOverride })
    setDashboard(updated)

    if (themeOverride) writeStoredThemePreference(themeOverride)
    else clearStoredThemePreference()
    applyTheme(themeOverride ?? resolveTheme())
  }

  const localCitySuggestions = useMemo(() => buildLocalSuggestions(manualCityInput), [manualCityInput])
  const shouldShowManualCitySuggestions =
    !weatherAutoLocationEnabled && normalizeQuery(manualCityInput).length >= MIN_CITY_QUERY_LENGTH
  const shouldFetchRemoteSuggestions =
    shouldShowManualCitySuggestions && localCitySuggestions.length < MAX_CITY_SUGGESTIONS

  useEffect(() => {
    if (!shouldFetchRemoteSuggestions) return

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void searchRemoteCitySuggestions(manualCityInput, controller.signal)
        .then((results) => setManualCityRemoteSearch({ query: manualCityInput, suggestions: results }))
        .catch(() => setManualCityRemoteSearch({ query: manualCityInput, suggestions: [] }))
    }, 220)

    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [manualCityInput, shouldFetchRemoteSuggestions])

  const manualCitySuggestions = useMemo(() => {
    const normalizedCurrentQuery = normalizeQuery(manualCityInput)
    const normalizedRemoteQuery = normalizeQuery(manualCityRemoteSearch.query)
    const remoteSuggestions =
      shouldFetchRemoteSuggestions && normalizedCurrentQuery === normalizedRemoteQuery
        ? manualCityRemoteSearch.suggestions
        : []

    const seen = new Set<string>()
    const merged = [...localCitySuggestions, ...remoteSuggestions]
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const key = normalizeQuery(item.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, MAX_CITY_SUGGESTIONS)
    return merged
  }, [localCitySuggestions, manualCityInput, manualCityRemoteSearch, shouldFetchRemoteSuggestions])

  const resolvedActiveIndex =
    manualCityActiveIndex >= 0 && manualCityActiveIndex < manualCitySuggestions.length
      ? manualCityActiveIndex
      : manualCitySuggestions.length > 0
        ? 0
        : -1

  const applyManualCitySuggestion = (suggestion: CitySuggestion) => {
    setManualCityInput(suggestion.label)
    setWeatherManualCity(suggestion.searchValue)
    setManualCityHasPendingSelection(false)
    setManualCityOpen(false)
    setManualCityActiveIndex(-1)
  }

  const commitManualCityInput = () => {
    const committed = manualCityInput.trim()
    setManualCityHasPendingSelection(false)
    setManualCityOpen(false)
    setManualCityActiveIndex(-1)

    if (!committed) {
      setManualCityInput('')
      setWeatherManualCity('')
      return
    }

    setManualCityInput(committed)
    setWeatherManualCity(committed)
  }

  return (
    <div className="settings settings--overlay" role="dialog" aria-modal="true" aria-label="Settings">
      <div className="settings__panel">
        <div className="settings__top">
          <div>
            <p className="settings__eyebrow">Workbench</p>
            <h2>Settings</h2>
          </div>
          <Link className="button button--ghost" to="/">
            Back
          </Link>
        </div>

        <div className="settings__stack">
          <Card title="Layout" eyebrow="Dashboard">
            <div className="settings__row">
              <div>
                <p className="settings__label">Layout lock</p>
                <p className="muted">Disable grid drag/resize and prevent accidental layout writes.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={layoutLocked}
                  onChange={(event) => {
                    const locked = event.target.checked
                    setLayoutLocked(locked)
                    writeLayoutLocked(locked)
                  }}
                />
                <span className="toggle__track" />
              </label>
            </div>
          </Card>

          <Card title="Theme" eyebrow="Override">
            <label>
              <span className="settings__label">Theme override</span>
              <Select
                value={theme}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(v) => {
                  const next = v as ThemeSelection
                  setTheme(next)
                  void saveThemeOverride(next)
                }}
              />
            </label>
            <p className="muted">{themeHelp}</p>
          </Card>

          <Card title="Motion" eyebrow="UI + Numbers">
            <div className="settings__row">
              <div>
                <p className="settings__label">UI animations</p>
                <p className="muted">Controls route transitions, panel motion, list transitions, and micro-interactions.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={uiAnimationsEnabled}
                  onChange={(event) => setUiAnimationsEnabled(event.target.checked)}
                />
                <span className="toggle__track" />
              </label>
            </div>

            <div className="settings__row">
              <div>
                <p className="settings__label">Number animations</p>
                <p className="muted">Roll digits for changing numbers. When enabled, animations play even if your system prefers reduced motion.</p>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={numberAnimationsEnabled}
                  onChange={(event) => setNumberAnimationsEnabled(event.target.checked)}
                />
                <span className="toggle__track" />
              </label>
            </div>
          </Card>

          <Card title="Currency" eyebrow="Spend">
            <label>
              <span className="settings__label">Default currency</span>
              <Select
                value={defaultCurrency}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'CNY', label: 'CNY' },
                ]}
                onChange={(v) => setDefaultCurrency(v as 'USD' | 'CNY')}
              />
            </label>
            <p className="muted">Used for the Spend total and trend chart.</p>
          </Card>

          <Card title="Weather" eyebrow="Widget">
            <div className="settings__stack settings__stack--compact">
              <div className="settings__row">
                <div>
                  <p className="settings__label">Auto location</p>
                  <p className="muted">When enabled, weather uses your current location.</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={weatherAutoLocationEnabled}
                    onChange={(event) => setWeatherAutoLocationEnabled(event.target.checked)}
                  />
                  <span className="toggle__track" />
                </label>
              </div>

              <label className="settings__field">
                <span className="settings__label">Manual city</span>
                <div className="settings__autocomplete">
                  <input
                    className={`settings__manualCityInput${weatherAutoLocationEnabled ? '' : ' is-editable'}`}
                    type="text"
                    value={manualCityInput}
                    placeholder="e.g. Beijing"
                    disabled={weatherAutoLocationEnabled}
                    role="combobox"
                    aria-expanded={manualCityOpen && shouldShowManualCitySuggestions}
                    aria-controls="manual-city-suggestions"
                    aria-autocomplete="list"
                    onFocus={() => {
                      if (shouldShowManualCitySuggestions) {
                        setManualCityOpen(true)
                        setManualCityActiveIndex(0)
                      }
                    }}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      setManualCityInput(nextValue)
                      setManualCityHasPendingSelection(true)
                      setManualCityOpen(normalizeQuery(nextValue).length >= MIN_CITY_QUERY_LENGTH)
                      setManualCityActiveIndex(0)
                    }}
                    onKeyDown={(event) => {
                      if (weatherAutoLocationEnabled) return
                      if (!shouldShowManualCitySuggestions) return

                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setManualCityOpen(true)
                        setManualCityActiveIndex((prev) =>
                          manualCitySuggestions.length === 0 ? -1 : (prev + 1 + manualCitySuggestions.length) % manualCitySuggestions.length
                        )
                        return
                      }

                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setManualCityOpen(true)
                        setManualCityActiveIndex((prev) =>
                          manualCitySuggestions.length === 0
                            ? -1
                            : (prev - 1 + manualCitySuggestions.length) % manualCitySuggestions.length
                        )
                        return
                      }

                      if (event.key === 'Enter' && manualCityOpen && resolvedActiveIndex >= 0) {
                        event.preventDefault()
                        const active = manualCitySuggestions[resolvedActiveIndex]
                        if (active) applyManualCitySuggestion(active)
                        return
                      }

                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitManualCityInput()
                        return
                      }

                      if (event.key === 'Escape') {
                        event.preventDefault()
                        setManualCityOpen(false)
                        setManualCityActiveIndex(-1)
                      }
                    }}
                    onBlur={() => {
                      if (manualCityHasPendingSelection) commitManualCityInput()
                      else {
                        setManualCityOpen(false)
                        setManualCityActiveIndex(-1)
                      }
                    }}
                  />

                  {manualCityOpen && shouldShowManualCitySuggestions ? (
                    <div className="settings__autocompleteMenu" id="manual-city-suggestions" role="listbox">
                      {manualCitySuggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.id}
                          type="button"
                          role="option"
                          aria-selected={resolvedActiveIndex === index}
                          className={`settings__autocompleteItem${resolvedActiveIndex === index ? ' is-active' : ''}`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => applyManualCitySuggestion(suggestion)}
                        >
                          <span>{suggestion.label}</span>
                          <span className="settings__autocompleteSource">{suggestion.source === 'local' ? 'Local' : 'Online'}</span>
                        </button>
                      ))}

                      {manualCitySuggestions.length === 0 ? (
                        <p className="settings__autocompleteEmpty">No city found.</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </label>

              <label className="settings__field">
                <span className="settings__label">Temperature unit</span>
                <Select
                  value={weatherTemperatureUnit}
                  options={[
                    { value: 'celsius', label: 'Celsius (°C)' },
                    { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
                  ]}
                  onChange={(value) => setWeatherTemperatureUnit(value as 'celsius' | 'fahrenheit')}
                />
              </label>
            </div>
          </Card>

          <Card title="Data" eyebrow="Local-first">
            <p className="muted">Data is stored locally in IndexedDB (Dexie). Export/import will live here.</p>
            <div className="settings__actions">
              <Button className="button button--ghost" disabled>
                Export JSON
              </Button>
              <Button className="button button--ghost" disabled>
                Export CSV
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default SettingsRoute
