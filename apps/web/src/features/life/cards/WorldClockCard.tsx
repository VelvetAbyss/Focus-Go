import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { LoaderCircle, Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import Card from '../../../shared/ui/Card'
import {
  buildLocalSuggestions,
  MAX_CITY_SUGGESTIONS,
  MIN_CITY_QUERY_LENGTH,
  normalizeQuery,
  searchRemoteCitySuggestions,
  type CitySuggestion,
} from '../../../shared/location/citySuggestions'
import { useI18n } from '../../../shared/i18n/useI18n'
import {
  readWorldClockItems,
  WORLD_CLOCK_ITEMS_KEY,
  writeWorldClockItems,
  type WorldClockItem,
} from '../../../shared/prefs/preferences'
import { usePageActivity } from '../../../shared/hooks/usePageActivity'
import { useThemeMode } from '../../../shared/theme/useThemeMode'
import { readWeatherLastLocation } from '../../../shared/prefs/preferences'
import { repairWorldClockItems, resolveWorldClockItemFromSuggestion } from '../../dashboard/worldClock'
import WorldClockGlobe from '../../dashboard/worldClock/WorldClockGlobe'
import DaylightStrip from '../../dashboard/worldClock/DaylightStrip'
import { daylightAt, sunElevation } from '../../dashboard/worldClock/solar'
import type { GlobeCity } from '../../dashboard/worldClock/globeScene'
import '../../dashboard/worldClock/world-clock.css'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../../data/repositories/syncedPreferencesRepo'

const MAX_WORLD_CLOCK_ITEMS = 6

type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
const formatterCache = new Map<string, Intl.DateTimeFormat>()

const getFormatter = (locale: string, timeZone: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${locale}:${timeZone}:${JSON.stringify(options)}`
  const cached = formatterCache.get(key)
  if (cached) return cached
  const formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone })
  formatterCache.set(key, formatter)
  return formatter
}

// Light at the city from the real sun, not the hour on its clock: an 18:00 in
// Reykjavik in June is broad daylight, the same hour in Singapore is dusk.
const phaseAt = (elevation: number, localHour: number): DayPhase => {
  const light = daylightAt(elevation)
  if (light === 'day') return 'day'
  if (light === 'night') return 'night'
  return localHour < 12 ? 'dawn' : 'dusk'
}

const getZoneOffsetMinutes = (timeZone: string, ref: Date): number => {
  try {
    const dtf = getFormatter('en-US', timeZone, {
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts = dtf.formatToParts(ref)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    const utc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return Math.round((utc - ref.getTime()) / 60000)
  } catch {
    return 0
  }
}

const getZoneHourFraction = (timeZone: string, ref: Date): number => {
  try {
    const dtf = getFormatter('en-US', timeZone, {
      hourCycle: 'h23',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts = dtf.formatToParts(ref)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value) || 0
    return get('hour') + get('minute') / 60 + get('second') / 3600
  } catch {
    return 0
  }
}

const WorldClockCard = () => {
  const { language, t } = useI18n()
  const theme = useThemeMode()
  const [items, setItems] = useState<WorldClockItem[]>(() => readWorldClockItems())
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())
  const pageActivity = usePageActivity()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [remoteSuggestions, setRemoteSuggestions] = useState<{ query: string; suggestions: CitySuggestion[] }>({
    query: '',
    suggestions: [],
  })

  const localSuggestions = useMemo(() => buildLocalSuggestions(query), [query])
  const shouldSearch = normalizeQuery(query).length >= MIN_CITY_QUERY_LENGTH && items.length < MAX_WORLD_CLOCK_ITEMS
  const shouldFetchRemote = shouldSearch && localSuggestions.length < MAX_CITY_SUGGESTIONS

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === WORLD_CLOCK_ITEMS_KEY) {
        setItems(readWorldClockItems())
      }
    }
    const handleSyncedPreferencesUpdated = () => setItems(readWorldClockItems())
    window.addEventListener('storage', handleStorage)
    window.addEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SYNCED_PREFERENCES_UPDATED_EVENT, handleSyncedPreferencesUpdated)
    }
  }, [])

  useEffect(() => {
    if (pageActivity !== 'visible') return
    let timeoutId = 0
    const tick = () => {
      setNow(new Date())
      timeoutId = window.setTimeout(tick, 60_000 - (Date.now() % 60_000))
    }
    tick()
    return () => window.clearTimeout(timeoutId)
  }, [pageActivity])

  useEffect(() => {
    if (items.length === 0) return
    let cancelled = false
    void repairWorldClockItems(items).then((nextItems) => {
      if (cancelled) return
      const changed = nextItems.some((item, i) => item.timeZone !== items[i]?.timeZone || item.id !== items[i]?.id)
      if (!changed) return
      writeWorldClockItems(nextItems)
      setItems(nextItems)
      void syncedPreferencesRepo.persistFromLocal()
    })
    return () => { cancelled = true }
  }, [items])

  useEffect(() => {
    if (!shouldFetchRemote) return
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
      void searchRemoteCitySuggestions(query, controller.signal)
        .then((suggestions) => setRemoteSuggestions({ query, suggestions }))
        .catch(() => setRemoteSuggestions({ query, suggestions: [] }))
    }, 220)
    return () => {
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [query, shouldFetchRemote])

  const suggestions = useMemo(() => {
    const normalizedCurrentQuery = normalizeQuery(query)
    const normalizedRemoteQuery = normalizeQuery(remoteSuggestions.query)
    const mergedRemoteSuggestions =
      shouldFetchRemote && normalizedCurrentQuery === normalizedRemoteQuery ? remoteSuggestions.suggestions : []
    const seen = new Set(items.map((item) => normalizeQuery(item.label)))
    return [...localSuggestions, ...mergedRemoteSuggestions]
      .sort((a, b) => b.score - a.score)
      .filter((suggestion) => {
        const key = normalizeQuery(suggestion.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, MAX_CITY_SUGGESTIONS)
  }, [items, localSuggestions, query, remoteSuggestions, shouldFetchRemote])

  const resolvedActiveIndex =
    activeIndex >= 0 && activeIndex < suggestions.length ? activeIndex : suggestions.length > 0 ? 0 : -1

  const closeComposer = () => {
    setAdding(false)
    setQuery('')
    setActiveIndex(-1)
    setRemoteSuggestions({ query: '', suggestions: [] })
  }

  const commitItem = async (suggestion: CitySuggestion) => {
    if (pending || items.length >= MAX_WORLD_CLOCK_ITEMS) return
    setPending(true)
    try {
      const nextItem = await resolveWorldClockItemFromSuggestion(suggestion)
      const nextItems = [...items, nextItem].slice(0, MAX_WORLD_CLOCK_ITEMS)
      writeWorldClockItems(nextItems)
      setItems(nextItems)
      void syncedPreferencesRepo.persistFromLocal()
      closeComposer()
    } finally {
      setPending(false)
    }
  }

  const removeItem = (id: string) => {
    const nextItems = items.filter((item) => item.id !== id)
    writeWorldClockItems(nextItems)
    setItems(nextItems)
    void syncedPreferencesRepo.persistFromLocal()
  }

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const homeTimeZone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' }
  }, [])
  const homeOffsetMin = useMemo(() => getZoneOffsetMinutes(homeTimeZone, now), [homeTimeZone, now])

  // The strips share one axis: the viewer's local day, midnight to midnight.
  const axisStart = useMemo(() => {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return start.getTime()
  }, [now])

  // Pins: tracked cities, plus "you" from the weather location when none of
  // them is in your own time zone.
  const globeCities = useMemo<GlobeCity[]>(() => {
    const pins: GlobeCity[] = items.map((item) => ({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      home: item.timeZone === homeTimeZone,
    }))
    if (!pins.some((pin) => pin.home)) {
      const here = readWeatherLastLocation()
      if (here) pins.push({ id: 'home', latitude: here.latitude, longitude: here.longitude, home: true })
    }
    return pins
  }, [homeTimeZone, items])

  const nowLabel = getFormatter(language === 'zh' ? 'zh-CN' : 'en-US', homeTimeZone, { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)

  const summary = items.length > 0
    ? t('worldClock.summaryCount', { count: items.length })
    : t('worldClock.summaryEmpty')

  const canAddCity = !adding && items.length < MAX_WORLD_CLOCK_ITEMS

  return (
    <Card
      className="dashboard-widget-card dashboard-widget-card--worldclock"
      eyebrow={t('worldClock.eyebrow')}
      actions={
        pending ? (
          <LoaderCircle size={13} className="wc-spinner" />
        ) : canAddCity ? (
          <button
            type="button"
            className="wc-add-icon-btn"
            onClick={() => { setAdding(true); setActiveIndex(0) }}
            aria-label={t('worldClock.addCity')}
            title={t('worldClock.addCity')}
          >
            <Plus size={14} aria-hidden />
          </button>
        ) : undefined
      }
    >
      <div className="wc-hero">
        <WorldClockGlobe cities={globeCities} highlightId={highlightId} theme={theme} />
        <p className="wc-summary">{summary}</p>
      </div>

      {items.length > 0 ? (
        <div className="wc-axis" aria-hidden="true">
          <span className="wc-axis__caption">{t('worldClock.axisLocal')}</span>
          {[6, 12, 18]
            // The now label wins where they'd overlap.
            .filter((h) => Math.abs(h / 24 - (now.getTime() - axisStart) / 86400000) > 0.075)
            .map((h) => (
              <span key={h} className="wc-axis__tick" style={{ left: `${(h / 24) * 100}%` }}>{h}</span>
            ))}
          <span className="wc-axis__now" style={{ left: `${((now.getTime() - axisStart) / 86400000) * 100}%` }}>{nowLabel}</span>
        </div>
      ) : null}
      <div className="wc-rows">
        {items.length === 0 && !adding && (
          <div className="wc-empty">
            <span>{t('worldClock.empty')}</span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {items.map((item) => {
            const fraction = getZoneHourFraction(item.timeZone, now)
            const phase = phaseAt(sunElevation(now, item.latitude, item.longitude), fraction)
            const phaseLabel = t(`worldClock.phase.${phase}` as const)

            const time = getFormatter(locale, item.timeZone, {
              hour: '2-digit', minute: '2-digit', hour12: false,
            }).format(now)
            const [hh, mm] = time.split(':')

            const weekday = getFormatter(locale, item.timeZone, {
              weekday: 'short',
            }).format(now)

            const isHome = item.timeZone === homeTimeZone
            const offsetMin = isHome ? 0 : getZoneOffsetMinutes(item.timeZone, now) - homeOffsetMin
            const offsetH = offsetMin / 60
            const offsetLabel = isHome
              ? t('worldClock.home')
              : offsetMin === 0
                ? t('worldClock.offsetSame')
                : offsetMin > 0
                  ? t('worldClock.offsetAhead', { h: Number.isInteger(offsetH) ? offsetH : offsetH.toFixed(1) })
                  : t('worldClock.offsetBehind', { h: Number.isInteger(-offsetH) ? -offsetH : (-offsetH).toFixed(1) })

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, x: 8 }}
                transition={{ type: 'spring', stiffness: 360, damping: 32, mass: 0.6 }}
                className={cn('wc-row', `wc-row--${phase}`, isHome && 'wc-row--home')}
                onMouseEnter={() => setHighlightId(item.id)}
                onMouseLeave={() => setHighlightId((current) => (current === item.id ? null : current))}
              >
                <div className="wc-row__main">
                  <div className="wc-row__head">
                    {isHome && <span className="wc-row__home-dot" aria-hidden />}
                    <span className="wc-row__city" title={item.label}>{item.label.split(',')[0].trim()}</span>
                  </div>
                  <div className="wc-row__meta">
                    <span className="wc-row__weekday">{weekday}</span>
                    <span className="wc-row__sep" aria-hidden>·</span>
                    <span className="wc-row__phase">{phaseLabel}</span>
                    <span className="wc-row__sep" aria-hidden>·</span>
                    <span className="wc-row__offset">{offsetLabel}</span>
                  </div>
                </div>
                <div className="wc-row__tail">
                  <span className="wc-row__time" aria-label={time}>
                    <span className="wc-row__time-h">{hh}</span>
                    <span className="wc-row__time-colon">:</span>
                    <span className="wc-row__time-m" key={mm}>{mm}</span>
                  </span>
                  <button
                    type="button"
                    className="wc-row__remove"
                    onClick={() => removeItem(item.id)}
                    aria-label={t('worldClock.removeAria', { label: item.label })}
                  >
                    <X size={11} />
                  </button>
                </div>
                <DaylightStrip
                  latitude={item.latitude}
                  longitude={item.longitude}
                  offsetMinutes={getZoneOffsetMinutes(item.timeZone, now)}
                  axisStart={axisStart}
                  now={now.getTime()}
                />
              </motion.div>
            )
          })}
        </AnimatePresence>

      </div>

      <AnimatePresence initial={false} mode="wait">
        {adding ? (
          <motion.div
            key="composer"
            className="wc-composer"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="wc-composer__search">
              <Search size={13} className="wc-composer__icon" />
              <Input
                autoFocus
                value={query}
                placeholder={t('worldClock.searchPlaceholder')}
                className="wc-composer__input"
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
                onKeyDown={(e) => {
                  if (!shouldSearch) {
                    if (e.key === 'Escape') closeComposer()
                    return
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((prev) => (suggestions.length === 0 ? -1 : (prev + 1) % suggestions.length))
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((prev) => (suggestions.length === 0 ? -1 : (prev - 1 + suggestions.length) % suggestions.length))
                    return
                  }
                  if (e.key === 'Enter' && resolvedActiveIndex >= 0) {
                    e.preventDefault()
                    const active = suggestions[resolvedActiveIndex]
                    if (active) void commitItem(active)
                    return
                  }
                  if (e.key === 'Escape') { e.preventDefault(); closeComposer() }
                }}
              />
              <button type="button" className="wc-composer__dismiss" onClick={closeComposer}>
                <X size={13} />
              </button>
            </div>
            {shouldSearch && (
              <div className="wc-composer__suggestions" role="listbox">
                <ScrollArea className="wc-composer__suggestions-scroll">
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        role="option"
                        aria-selected={resolvedActiveIndex === index}
                        className={cn('wc-composer__suggestion', resolvedActiveIndex === index && 'is-active')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void commitItem(suggestion)}
                        style={{ animationDelay: `${index * 28}ms` }}
                      >
                        <span>{suggestion.label}</span>
                        <span className="wc-composer__suggestion-source">
                          {suggestion.source === 'local' ? t('worldClock.sourceLocal') : t('worldClock.sourceOnline')}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="wc-composer__no-results">{t('worldClock.noResults')}</p>
                  )}
                </ScrollArea>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}

export default WorldClockCard
