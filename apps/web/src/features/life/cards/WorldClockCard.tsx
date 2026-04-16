import { useEffect, useMemo, useState } from 'react'
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

const WorldClockCard = () => {
  const { language } = useI18n()
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

  const formatRow = (item: WorldClockItem) => ({
    time: new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: item.timeZone,
    }).format(now),
    weekday: new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      timeZone: item.timeZone,
    }).format(now),
  })

  const eyebrow = language === 'zh' ? '世界时钟' : 'World Clock'
  const summary =
    items.length > 0
      ? language === 'zh'
        ? `已追踪 ${items.length} 个城市`
        : `${items.length} cities in sync`
      : language === 'zh'
        ? '保持跨时区节奏'
        : 'Stay in sync across time zones'

  return (
    <Card
      eyebrow={eyebrow}
      actions={pending ? <LoaderCircle size={13} className="wc-spinner" /> : undefined}
    >
      <p className="wc-summary">{summary}</p>
      <div className="wc-rows">
        {items.length === 0 && !adding && (
          <p className="wc-empty">
            {language === 'zh' ? '添加城市，追踪多地区时间' : 'Add cities to track time zones'}
          </p>
        )}
        {items.map((item) => {
          const { time, weekday } = formatRow(item)
          return (
            <div key={item.id} className="wc-row">
              <div className="wc-row__main">
                <span className="wc-row__city">{item.label}</span>
                <span className="wc-row__weekday">{weekday}</span>
              </div>
              <div className="wc-row__tail">
                <span className="wc-row__time">{time}</span>
                <button
                  type="button"
                  className="wc-row__remove"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.label}`}
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {adding ? (
        <div className="wc-composer">
          <div className="wc-composer__search">
            <Search size={13} className="wc-composer__icon" />
            <Input
              autoFocus
              value={query}
              placeholder={language === 'zh' ? '搜索城市' : 'Search city'}
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
                    >
                      <span>{suggestion.label}</span>
                      <span className="wc-composer__suggestion-source">
                        {suggestion.source === 'local' ? (language === 'zh' ? '已保存' : 'Saved') : (language === 'zh' ? '在线' : 'Online')}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="wc-composer__no-results">{language === 'zh' ? '没有找到地点' : 'No places found'}</p>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      ) : items.length < MAX_WORLD_CLOCK_ITEMS ? (
        <button
          type="button"
          className="wc-add-btn"
          onClick={() => { setAdding(true); setActiveIndex(0) }}
        >
          <Plus size={12} />
          <span>{language === 'zh' ? '添加城市' : 'Add city'}</span>
        </button>
      ) : null}
    </Card>
  )
}

export default WorldClockCard
