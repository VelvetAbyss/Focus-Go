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
import { repairWorldClockItems, resolveWorldClockItemFromSuggestion } from '../../dashboard/worldClock'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../../data/repositories/syncedPreferencesRepo'

const MAX_WORLD_CLOCK_ITEMS = 6

type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

const phaseFromHour = (hour: number): DayPhase => {
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 17) return 'day'
  if (hour >= 17 && hour < 20) return 'dusk'
  return 'night'
}

const getZoneOffsetMinutes = (timeZone: string, ref: Date): number => {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
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
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const parts = dtf.formatToParts(ref)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value) || 0
    return get('hour') + get('minute') / 60 + get('second') / 3600
  } catch {
    return 0
  }
}

type DialProps = { fraction: number; phase: DayPhase }

const Dial = ({ fraction, phase }: DialProps) => {
  const r = 11
  const c = 2 * Math.PI * r
  const offset = c * (1 - Math.min(Math.max(fraction / 24, 0), 0.9999))
  const angle = (fraction / 24) * 2 * Math.PI - Math.PI / 2
  const gx = 14 + r * Math.cos(angle)
  const gy = 14 + r * Math.sin(angle)
  const isNight = phase === 'night'
  return (
    <svg className={`wc-dial wc-dial--${phase}`} viewBox="0 0 28 28" width={28} height={28} aria-hidden>
      <circle className="wc-dial__track" cx={14} cy={14} r={r} />
      <circle
        className="wc-dial__arc"
        cx={14}
        cy={14}
        r={r}
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 14 14)"
      />
      {isNight ? (
        <g className="wc-dial__glyph" transform={`translate(${gx} ${gy})`}>
          <circle r={2.4} />
          <circle r={1.6} cx={1.1} cy={-0.6} className="wc-dial__glyph-cut" />
        </g>
      ) : (
        <g className="wc-dial__glyph" transform={`translate(${gx} ${gy})`}>
          <circle r={2.1} />
        </g>
      )}
    </svg>
  )
}

const WorldClockCard = () => {
  const { language, t } = useI18n()
  const [items, setItems] = useState<WorldClockItem[]>(() => readWorldClockItems())
  const [now, setNow] = useState(() => new Date())
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
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

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

  const summary = items.length > 0
    ? t('worldClock.summaryCount', { count: items.length })
    : t('worldClock.summaryEmpty')

  return (
    <Card
      eyebrow={t('worldClock.eyebrow')}
      actions={pending ? <LoaderCircle size={13} className="wc-spinner" /> : undefined}
    >
      <p className="wc-summary">{summary}</p>

      <div className="wc-rows">
        {items.length === 0 && !adding && (
          <div className="wc-empty">
            <svg className="wc-empty__meridian" viewBox="0 0 120 24" aria-hidden>
              <path d="M2 12 Q 30 2, 60 12 T 118 12" />
            </svg>
            <span>{t('worldClock.empty')}</span>
          </div>
        )}

        <AnimatePresence initial={false}>
          {items.map((item) => {
            const fraction = getZoneHourFraction(item.timeZone, now)
            const hour = Math.floor(fraction)
            const phase = phaseFromHour(hour)
            const phaseLabel = t(`worldClock.phase.${phase}` as const)

            const time = new Intl.DateTimeFormat(locale, {
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: item.timeZone,
            }).format(now)
            const [hh, mm] = time.split(':')

            const weekday = new Intl.DateTimeFormat(locale, {
              weekday: 'short', timeZone: item.timeZone,
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
              >
                <Dial fraction={fraction} phase={phase} />
                <div className="wc-row__main">
                  <div className="wc-row__head">
                    {isHome && <span className="wc-row__home-dot" aria-hidden />}
                    <span className="wc-row__city">{item.label}</span>
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
        ) : items.length < MAX_WORLD_CLOCK_ITEMS ? (
          <motion.button
            key="add"
            type="button"
            className="wc-add-btn"
            onClick={() => { setAdding(true); setActiveIndex(0) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Plus size={12} />
            <span>{t('worldClock.addCity')}</span>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}

export default WorldClockCard
