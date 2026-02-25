import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Brush, Database, LayoutGrid, Sparkles, SunMedium, Waves, Bell, LocateFixed, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { dashboardRepo } from '../../data/repositories/dashboardRepo'
import { db } from '../../data/db'
import { applyTheme, clearStoredThemePreference, resolveTheme, writeStoredThemePreference } from '../../shared/theme/theme'
import type { DashboardLayout } from '../../data/models/types'
import { usePreferences } from '../../shared/prefs/usePreferences'
import { useI18n } from '../../shared/i18n/useI18n'
import type { LanguageCode } from '../../shared/i18n/types'

const LAYOUT_LOCK_KEY = 'workbench.dashboard.layoutLocked'

type ThemeSelection = 'system' | 'light' | 'dark'
type SettingsSection = 'appearance' | 'experience' | 'weather' | 'data'
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

const SECTION_META: Array<{
  key: SettingsSection
  titleKey:
    | 'settings.module.appearance.title'
    | 'settings.module.experience.title'
    | 'settings.module.weather.title'
    | 'settings.module.data.title'
  hintKey:
    | 'settings.module.appearance.hint'
    | 'settings.module.experience.hint'
    | 'settings.module.weather.hint'
    | 'settings.module.data.hint'
  icon: typeof Brush
  badge: string
}> = [
  { key: 'appearance', titleKey: 'settings.module.appearance.title', hintKey: 'settings.module.appearance.hint', icon: Brush, badge: 'Visual' },
  { key: 'experience', titleKey: 'settings.module.experience.title', hintKey: 'settings.module.experience.hint', icon: Sparkles, badge: 'Motion' },
  { key: 'weather', titleKey: 'settings.module.weather.title', hintKey: 'settings.module.weather.hint', icon: SunMedium, badge: 'Widget' },
  { key: 'data', titleKey: 'settings.module.data.title', hintKey: 'settings.module.data.hint', icon: Database, badge: 'Safety' },
]

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

  return resultsByLang
    .flat()
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

type SettingRowProps = {
  icon: typeof Brush
  title: string
  description: string
  children: ReactNode
}

const SettingRow = ({ icon: Icon, title, description, children }: SettingRowProps) => (
  <motion.div
    layout
    className="grid gap-4 rounded-xl border border-border/70 bg-background/70 p-4 backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    whileHover={{ y: -2 }}
  >
    <div className="flex gap-3">
      <div className="mt-0.5 rounded-md border border-border/80 bg-muted/60 p-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="w-full lg:w-auto lg:justify-self-end">{children}</div>
  </motion.div>
)

const SettingsRoute = () => {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const [layoutLocked, setLayoutLocked] = useState(() => readLayoutLocked())
  const [theme, setTheme] = useState<ThemeSelection>('system')
  const [dashboard, setDashboard] = useState<DashboardLayout | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const {
    language,
    setLanguage,
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
    focusCompletionSoundEnabled,
    setFocusCompletionSoundEnabled,
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
    if (theme === 'system') return t('settings.theme.systemHelp')
    return t('settings.theme.forceHelp', { theme })
  }, [theme, t])

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
  const shouldShowManualCitySuggestions = !weatherAutoLocationEnabled && normalizeQuery(manualCityInput).length >= MIN_CITY_QUERY_LENGTH
  const shouldFetchRemoteSuggestions = shouldShowManualCitySuggestions && localCitySuggestions.length < MAX_CITY_SUGGESTIONS

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
    return [...localCitySuggestions, ...remoteSuggestions]
      .sort((a, b) => b.score - a.score)
      .filter((item) => {
        const key = normalizeQuery(item.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, MAX_CITY_SUGGESTIONS)
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

  const resetApp = async () => {
    setIsResetting(true)
    try {
      await db.delete()
      localStorage.clear()
      sessionStorage.clear()
      window.location.reload()
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="relative min-h-0 overflow-hidden rounded-fluid-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-3 sm:p-4 lg:p-6">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
      </motion.div>

      <div className="relative z-10 flex h-full flex-col gap-5">
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border/70 bg-card/75 p-5 backdrop-blur"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t('settings.pageEyebrow')}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{t('settings.pageTitle')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('settings.pageDescription')}</p>
          </div>
          <Badge variant="secondary" className="h-8 px-3 text-xs font-semibold">
            shadcn system
          </Badge>
        </motion.header>

        <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as SettingsSection)} className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-full border-border/70 bg-card/80 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('settings.modulesTitle')}</CardTitle>
              <CardDescription>{t('settings.modulesDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <TabsList className="h-auto w-full flex-col items-stretch gap-2 bg-transparent p-0">
                {SECTION_META.map((section) => {
                  const Icon = section.icon
                  const active = activeSection === section.key
                  return (
                    <motion.div key={section.key} layout>
                      <TabsTrigger
                        value={section.key}
                        className="relative h-auto w-full justify-start rounded-xl border border-border/70 bg-background/60 px-3 py-3 text-left data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:shadow-lg"
                      >
                        <div className="flex w-full items-center gap-3">
                          <Icon className="h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold">{t(section.titleKey)}</div>
                            <div className="truncate text-xs text-muted-foreground">{t(section.hintKey)}</div>
                          </div>
                          <Badge variant={active ? 'default' : 'secondary'} className="h-6 px-2 text-[11px]">
                            {section.badge}
                          </Badge>
                        </div>
                      </TabsTrigger>
                    </motion.div>
                  )
                })}
              </TabsList>
            </CardContent>
          </Card>

          <Card className="h-full border-border/70 bg-card/85 backdrop-blur">
            <CardContent className="h-full p-0">
              <ScrollArea className="max-h-[min(72vh,760px)] xl:max-h-[calc(100vh-240px)]">
                <div className="p-5 md:p-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={activeSection}
                      initial={{ opacity: 0, y: 24, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.98 }}
                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                      className="space-y-4"
                    >
                      {activeSection === 'appearance' ? (
                        <>
                          <SettingRow
                            icon={Brush}
                            title={t('settings.language.title')}
                            description={t('settings.language.description')}
                          >
                            <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.language.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">{t('settings.language.option.en')}</SelectItem>
                                <SelectItem value="zh">{t('settings.language.option.zh')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>

                          <SettingRow
                            icon={Brush}
                            title={t('settings.theme.title')}
                            description={themeHelp}
                          >
                            <Select
                              value={theme}
                              onValueChange={(value) => {
                                const next = value as ThemeSelection
                                setTheme(next)
                                void saveThemeOverride(next)
                              }}
                            >
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.theme.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
                                <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                                <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>

                          <SettingRow
                            icon={LayoutGrid}
                            title={t('settings.layoutLock.title')}
                            description={t('settings.layoutLock.description')}
                          >
                            <Switch
                              checked={layoutLocked}
                              onCheckedChange={(checked) => {
                                setLayoutLocked(checked)
                                writeLayoutLocked(checked)
                              }}
                            />
                          </SettingRow>

                          <SettingRow
                            icon={Waves}
                            title={t('settings.currency.title')}
                            description={t('settings.currency.description')}
                          >
                            <Select value={defaultCurrency} onValueChange={(value) => setDefaultCurrency(value as 'USD' | 'CNY')}>
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.currency.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="CNY">CNY</SelectItem>
                              </SelectContent>
                            </Select>
                          </SettingRow>
                        </>
                      ) : null}

                      {activeSection === 'experience' ? (
                        <>
                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.uiAnimations.title')}
                            description={t('settings.experience.uiAnimations.description')}
                          >
                            <Switch checked={uiAnimationsEnabled} onCheckedChange={(checked) => setUiAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Sparkles}
                            title={t('settings.experience.numberAnimations.title')}
                            description={t('settings.experience.numberAnimations.description')}
                          >
                            <Switch checked={numberAnimationsEnabled} onCheckedChange={(checked) => setNumberAnimationsEnabled(checked)} />
                          </SettingRow>

                          <SettingRow
                            icon={Bell}
                            title={t('settings.experience.completionSound.title')}
                            description={t('settings.experience.completionSound.description')}
                          >
                            <Switch checked={focusCompletionSoundEnabled} onCheckedChange={(checked) => setFocusCompletionSoundEnabled(checked)} />
                          </SettingRow>
                        </>
                      ) : null}

                      {activeSection === 'weather' ? (
                        <>
                          <SettingRow
                            icon={LocateFixed}
                            title={t('settings.weather.autoLocation.title')}
                            description={t('settings.weather.autoLocation.description')}
                          >
                            <Switch checked={weatherAutoLocationEnabled} onCheckedChange={(checked) => setWeatherAutoLocationEnabled(checked)} />
                          </SettingRow>

                          <motion.div
                            className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{t('settings.weather.manualCity.title')}</h3>
                              <p className="text-sm text-muted-foreground">{t('settings.weather.manualCity.description')}</p>
                            </div>

                            <div className="relative">
                              <Input
                                type="text"
                                value={manualCityInput}
                                placeholder={t('settings.weather.manualCity.placeholder')}
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
                                      manualCitySuggestions.length === 0 ? -1 : (prev - 1 + manualCitySuggestions.length) % manualCitySuggestions.length
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
                                <div
                                  id="manual-city-suggestions"
                                  role="listbox"
                                  className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
                                >
                                  <ScrollArea className="max-h-64">
                                    <div className="p-1">
                                      {manualCitySuggestions.map((suggestion, index) => (
                                        <button
                                          key={suggestion.id}
                                          type="button"
                                          role="option"
                                          aria-selected={resolvedActiveIndex === index}
                                          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                                            resolvedActiveIndex === index ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                                          }`}
                                          onMouseDown={(event) => event.preventDefault()}
                                          onClick={() => applyManualCitySuggestion(suggestion)}
                                        >
                                          <span>{suggestion.label}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {suggestion.source === 'local' ? t('settings.weather.manualCity.local') : t('settings.weather.manualCity.online')}
                                          </span>
                                        </button>
                                      ))}
                                      {manualCitySuggestions.length === 0 ? (
                                        <p className="px-3 py-2 text-sm text-muted-foreground">{t('settings.weather.manualCity.empty')}</p>
                                      ) : null}
                                    </div>
                                  </ScrollArea>
                                </div>
                              ) : null}
                            </div>

                            <Select
                              value={weatherTemperatureUnit}
                              onValueChange={(value) => setWeatherTemperatureUnit(value as 'celsius' | 'fahrenheit')}
                            >
                              <SelectTrigger className="w-full sm:max-w-[220px]">
                                <SelectValue placeholder={t('settings.weather.temperature.placeholder')} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="celsius">{t('settings.weather.temperature.celsius')}</SelectItem>
                                <SelectItem value="fahrenheit">{t('settings.weather.temperature.fahrenheit')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </motion.div>
                        </>
                      ) : null}

                      {activeSection === 'data' ? (
                        <>
                          <SettingRow
                            icon={Database}
                            title={t('settings.data.export.title')}
                            description={t('settings.data.export.description')}
                          >
                            <div className="flex gap-2">
                              <Button variant="outline" disabled>
                                {t('settings.data.export.json')}
                              </Button>
                              <Button variant="outline" disabled>
                                {t('settings.data.export.csv')}
                              </Button>
                            </div>
                          </SettingRow>

                          <motion.div
                            className="space-y-4 rounded-xl border border-destructive/35 bg-destructive/5 p-4"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                              <div>
                                <h3 className="text-sm font-semibold text-foreground">{t('settings.data.danger.title')}</h3>
                                <p className="text-sm text-muted-foreground">{t('settings.data.danger.description')}</p>
                              </div>
                            </div>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isResetting}>
                                  {isResetting ? t('settings.data.resetting') : t('settings.data.reset')}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('settings.data.resetDialog.title')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('settings.data.resetDialog.description')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('settings.data.resetDialog.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void resetApp()}>{t('settings.data.resetDialog.confirm')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </motion.div>
                        </>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </div>
  )
}

export default SettingsRoute
