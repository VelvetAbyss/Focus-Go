import { useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Plus, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  buildLocalSuggestions,
  MAX_CITY_SUGGESTIONS,
  MIN_CITY_QUERY_LENGTH,
  normalizeQuery,
  searchRemoteCitySuggestions,
  type CitySuggestion,
} from '../../shared/location/citySuggestions'
import { useI18n } from '../../shared/i18n/useI18n'
import { HelpBadge } from '../../shared/ui/HelpBadge'
import { readWorldClockItems, WORLD_CLOCK_ITEMS_KEY, writeWorldClockItems, type WorldClockItem } from '../../shared/prefs/preferences'
import { usePageActivity } from '../../shared/hooks/usePageActivity'
import { formatWorldClockDisplay, repairWorldClockItems, resolveWorldClockItemFromSuggestion } from './worldClock'
import { syncedPreferencesRepo, SYNCED_PREFERENCES_UPDATED_EVENT } from '../../data/repositories/syncedPreferencesRepo'

const MAX_WORLD_CLOCK_ITEMS = 4

const copy = {
  zh: {
    add: '添加城市',
    adding: '添加中',
    placeholder: '搜索城市',
    empty: '搜索城市后，可在这里固定多地区时间',
    full: '最多添加 4 个地区',
    noResults: '没有找到地点',
    remove: '删除地区时间',
    close: '关闭搜索',
    local: '本地',
    remote: '在线',
  },
  en: {
    add: 'Add city',
    adding: 'Adding',
    placeholder: 'Search city',
    empty: 'Search for a city to pin up to four time zones here.',
    full: 'Up to 4 cities',
    noResults: 'No places found',
    remove: 'Remove world clock',
    close: 'Close search',
    local: 'Saved',
    remote: 'Online',
  },
} as const

const WorldClockStrip = () => {
  const { language, t } = useI18n()
  const text = language === 'zh' ? copy.zh : copy.en
  const [items, setItems] = useState<WorldClockItem[]>(() => readWorldClockItems())
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [remoteSuggestions, setRemoteSuggestions] = useState<{ query: string; suggestions: CitySuggestion[] }>({
    query: '',
    suggestions: [],
  })
  const [activeIndex, setActiveIndex] = useState(-1)
  const [now, setNow] = useState(() => new Date())
  const pageActivity = usePageActivity()

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
      const changed = nextItems.some((item, index) => item.timeZone !== items[index]?.timeZone || item.id !== items[index]?.id)
      if (!changed) return
      writeWorldClockItems(nextItems)
      setItems(nextItems)
      void syncedPreferencesRepo.persistFromLocal()
    })

    return () => {
      cancelled = true
    }
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

  const resolvedActiveIndex = activeIndex >= 0 && activeIndex < suggestions.length ? activeIndex : suggestions.length > 0 ? 0 : -1
  const cards = useMemo(() => items.map((item) => ({ item, display: formatWorldClockDisplay(item, language, now) })), [items, language, now])

  const closeComposer = () => {
    setOpen(false)
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

  return (
    <div className="app-shell__hero-item app-shell__hero-item--world-clock">
      <section className="world-clock-strip" aria-label={language === 'zh' ? '多地区时间' : 'World clocks'}>
        <div className="world-clock-strip__list">
          {cards.map(({ item, display }) => (
            <article key={item.id} className="world-clock-strip__card">
              <button
                type="button"
                className="world-clock-strip__remove"
                onClick={() => removeItem(item.id)}
                aria-label={`${text.remove} ${display.location}`}
              >
                <X size={11} />
              </button>
              <p className="world-clock-strip__location">{display.location}</p>
              <p className="world-clock-strip__time">{display.time}</p>
              <p className="world-clock-strip__meta">
                <span>{display.weekday}</span>
                <span aria-hidden="true">·</span>
                <span>{display.date}</span>
              </p>
            </article>
          ))}

          {open ? (
            <div className="world-clock-strip__composer">
              <div className="world-clock-strip__search">
                <Search size={14} />
                <Input
                  value={query}
                  autoFocus
                  placeholder={text.placeholder}
                  className="world-clock-strip__input"
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setActiveIndex(0)
                  }}
                  onKeyDown={(event) => {
                    if (!shouldSearch) {
                      if (event.key === 'Escape') closeComposer()
                      return
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setActiveIndex((prev) => (suggestions.length === 0 ? -1 : (prev + 1 + suggestions.length) % suggestions.length))
                      return
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setActiveIndex((prev) => (suggestions.length === 0 ? -1 : (prev - 1 + suggestions.length) % suggestions.length))
                      return
                    }
                    if (event.key === 'Enter' && resolvedActiveIndex >= 0) {
                      event.preventDefault()
                      const active = suggestions[resolvedActiveIndex]
                      if (active) void commitItem(active)
                      return
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault()
                      closeComposer()
                    }
                  }}
                />
                <button type="button" className="world-clock-strip__dismiss" onClick={closeComposer} aria-label={text.close}>
                  <X size={14} />
                </button>
              </div>
              {shouldSearch ? (
                <div className="world-clock-strip__suggestions" role="listbox">
                  <ScrollArea className="world-clock-strip__suggestions-scroll">
                    <div className="world-clock-strip__suggestions-inner">
                      {suggestions.length > 0 ? (
                        suggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            role="option"
                            aria-selected={resolvedActiveIndex === index}
                            className={cn('world-clock-strip__suggestion', resolvedActiveIndex === index && 'is-active')}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => void commitItem(suggestion)}
                          >
                            <span>{suggestion.label}</span>
                            <span>{suggestion.source === 'local' ? text.local : text.remote}</span>
                          </button>
                        ))
                      ) : (
                        <p className="world-clock-strip__suggestion-empty">{text.noResults}</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </div>
          ) : items.length < MAX_WORLD_CLOCK_ITEMS ? (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                className={`world-clock-strip__add${cards.length === 0 ? ' world-clock-strip__add--empty' : ''}`}
                onClick={() => {
                  setOpen(true)
                  setActiveIndex(0)
                }}
                title={cards.length === 0 ? text.empty : undefined}
              >
                <Plus size={14} />
                <span>{text.add}</span>
              </button>
              <HelpBadge label={t('worldClock.addCity')}>
                {t('helpBadge.worldClock')}
              </HelpBadge>
            </div>
          ) : null}
        </div>

        {pending ? (
          <div className="world-clock-strip__pending" aria-live="polite">
            <LoaderCircle size={14} className="world-clock-strip__spinner" />
            <span>{text.adding}</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default WorldClockStrip
