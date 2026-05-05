import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Clock, ListFilter, RefreshCw, Settings2, WifiOff } from 'lucide-react'
import {
  fetchNewsSource,
  fetchNewsSources,
  refreshNewsSources,
  type NewsCategory,
  type NewsItem,
  type NewsSource,
  type NewsSourceResponse,
} from './newsApi'
import { readNewsPreferences, writeNewsPreferences, type NewsDensity, type NewsPreferences } from './newsPreferences'
import './news.css'

type SourceState = {
  loading: boolean
  response?: NewsSourceResponse
  error?: string
}

const categoryLabels: Record<NewsCategory | 'all', string> = {
  all: '全部',
  hot: '热榜',
  tech: '科技',
  finance: '财经',
}

const densityLabels: Record<NewsDensity, string> = {
  comfortable: '舒适',
  compact: '紧凑',
}

const formatUpdatedTime = (value?: number | string) => {
  if (!value) return '尚未更新'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '尚未更新'
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

const getStoryHref = (item: NewsItem) => item.mobileUrl || item.url

const mergeSourceOrder = (sources: NewsSource[], preferences: NewsPreferences) => {
  const sourceMap = new Map(sources.map((source) => [source.id, source]))
  const known = new Set<string>()
  const ordered = preferences.sourceOrder
    .map((id) => sourceMap.get(id))
    .filter((source): source is NewsSource => {
      if (!source || known.has(source.id)) return false
      known.add(source.id)
      return true
    })
  const missing = sources.filter((source) => !known.has(source.id))
  return [...ordered, ...missing]
}

// ─── Source icon with favicon + letter fallback ────────────────────────────────
const SourceIcon = ({ source }: { source: NewsSource }) => {
  const [imgFailed, setImgFailed] = useState(false)
  const hostname = useMemo(() => {
    try { return new URL(source.home).hostname } catch { return '' }
  }, [source.home])

  const letter = source.name.slice(0, 1)

  return (
    <span className="news-card__icon" style={{ '--news-accent': source.accent } as CSSProperties}>
      {!imgFailed && hostname ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
          alt=""
          width={16}
          height={16}
          onError={() => setImgFailed(true)}
          aria-hidden="true"
        />
      ) : (
        <span className="news-card__icon-letter" aria-hidden="true">{letter}</span>
      )}
    </span>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
const NewsSkeleton = () => (
  <div className="news-card__skeleton" role="status" aria-label="正在加载新闻">
    <span aria-hidden="true" />
    <span aria-hidden="true" />
    <span aria-hidden="true" />
    <span aria-hidden="true" />
    <span aria-hidden="true" />
    <span aria-hidden="true" />
  </div>
)

// ─── Error state (first-load failure) ─────────────────────────────────────────
const NewsError = ({ onRetry }: { onRetry: () => void }) => (
  <div className="news-card__error">
    <WifiOff size={22} aria-hidden="true" />
    <p>暂时无法加载</p>
    <button type="button" onClick={onRetry}>重试</button>
  </div>
)

// ─── Empty state (no sources enabled) ─────────────────────────────────────────
const NewsEmpty = ({ onManageSources }: { onManageSources: () => void }) => (
  <div className="news-dashboard__empty">
    <p>暂无来源</p>
    <button type="button" onClick={onManageSources}>管理来源</button>
  </div>
)

// ─── Individual news card ──────────────────────────────────────────────────────
const NewsCard = ({
  source,
  state,
  density,
  cardIndex,
  onRefresh,
  onVisible,
  onManageSources,
}: {
  source: NewsSource
  state: SourceState
  density: NewsDensity
  cardIndex: number
  onRefresh: (sourceId: string) => void
  onVisible: (sourceId: string) => void
  onManageSources: () => void
}) => {
  const articleRef = useRef<HTMLElement>(null)
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  // Lazy-load: fetch data only when card enters the viewport
  useEffect(() => {
    const el = articleRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisibleRef.current(source.id)
          observer.disconnect()
        }
      },
      { rootMargin: '120px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [source.id])

  const items = state.response?.items ?? []
  const isCached = state.response?.status === 'cache'
  const hasStaleWarning = (state.error || state.response?.warning) && items.length > 0

  return (
    <article
      ref={articleRef}
      className={`news-card news-card--${density}`}
      style={{ '--news-accent': source.accent, '--card-index': cardIndex } as CSSProperties}
    >
      {/* Accent top stripe */}
      <div className="news-card__stripe" aria-hidden="true" />

      <header className="news-card__header">
        <a className="news-card__source" href={source.home} target="_blank" rel="noopener noreferrer">
          <SourceIcon source={source} />
          <strong>{source.name}</strong>
        </a>
        <button
          type="button"
          className="news-icon-button"
          onClick={() => onRefresh(source.id)}
          aria-label={`刷新 ${source.name}`}
          disabled={state.loading}
        >
          <RefreshCw size={14} aria-hidden="true" className={state.loading ? 'is-spinning' : undefined} />
        </button>
      </header>

      <div className="news-card__meta">
        <span className="news-card__meta-type">{source.type === 'hottest' ? '热榜' : '时间线'}</span>
        <span>{formatUpdatedTime(state.response?.updatedTime)}</span>
        {isCached ? <span>缓存</span> : null}
      </div>

      {/* Loading state — skeleton */}
      {state.loading && !items.length ? <NewsSkeleton /> : null}

      {/* Error state — first load failure */}
      {!state.loading && state.error && !items.length ? (
        <NewsError onRetry={() => onRefresh(source.id)} />
      ) : null}

      {/* Empty — loaded but no items */}
      {!state.loading && !state.error && !items.length ? (
        <NewsEmpty onManageSources={onManageSources} />
      ) : null}

      {/* News list */}
      {items.length ? (
        <ol className="news-card__list">
          {items.map((item, index) => (
            <li key={`${source.id}-${item.id}`} className={index < 3 ? 'is-top' : undefined}>
              <a href={getStoryHref(item)} target="_blank" rel="noopener noreferrer" title={item.extra?.hover}>
                <span className="news-card__rank">{index + 1}</span>
                <span className="news-card__story">
                  <strong>{item.title}</strong>
                  {item.extra?.info || item.pubDate ? (
                    <small>{item.extra?.info || formatUpdatedTime(item.pubDate)}</small>
                  ) : null}
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : null}

      {/* Stale banner — background refresh failed but we have cached data */}
      {hasStaleWarning ? (
        <footer className="news-card__stale-banner">
          <Clock size={11} aria-hidden="true" />
          显示缓存内容
        </footer>
      ) : null}
    </article>
  )
}

// ─── Category filter with sliding indicator ────────────────────────────────────
const CATEGORIES = ['all', 'hot', 'tech', 'finance'] as const

const CategoryFilter = ({
  selected,
  onChange,
}: {
  selected: NewsCategory | 'all'
  onChange: (cat: NewsCategory | 'all') => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number } | null>(null)

  const updateIndicator = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const activeBtn = container.querySelector<HTMLButtonElement>('button[aria-selected="true"]')
    if (!activeBtn) return
    // offsetLeft / offsetWidth are relative to the offsetParent's padding edge —
    // the same reference point as position:absolute, so no border-width adjustment needed.
    setIndicatorStyle({
      left: activeBtn.offsetLeft,
      width: activeBtn.offsetWidth,
    })
  }, [])

  useEffect(() => {
    updateIndicator()
  }, [selected, updateIndicator])

  return (
    <div
      ref={containerRef}
      className="news-dashboard__filters"
      role="tablist"
      aria-label="News categories"
    >
      {CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          role="tab"
          aria-selected={selected === category}
          className={selected === category ? 'is-active' : undefined}
          onClick={() => onChange(category)}
        >
          <ListFilter size={13} aria-hidden="true" />
          {categoryLabels[category]}
        </button>
      ))}
      {/* Sliding indicator underneath the active tab */}
      {indicatorStyle ? (
        <span
          className="news-dashboard__filter-indicator"
          style={{ '--fi-left': `${indicatorStyle.left}px`, '--fi-width': `${indicatorStyle.width}px` } as CSSProperties}
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}

// ─── Source manager panel ──────────────────────────────────────────────────────
const CATEGORY_GROUP_LABELS: Record<NewsCategory, string> = {
  hot: '热榜',
  tech: '科技',
  finance: '财经',
}

const SourceManager = ({
  sources,
  enabledIds,
  density,
  onToggle,
  onDensityChange,
}: {
  sources: NewsSource[]
  enabledIds: Set<string>
  density: NewsDensity
  onToggle: (id: string) => void
  onDensityChange: (d: NewsDensity) => void
}) => {
  const grouped = useMemo(() => {
    const map: Record<NewsCategory, NewsSource[]> = { hot: [], tech: [], finance: [] }
    sources.forEach((s) => { map[s.category]?.push(s) })
    return map
  }, [sources])

  return (
    <aside className="news-dashboard__manager" aria-label="Manage news sources">
      <div className="news-dashboard__manager-header">
        <span>来源管理</span>
        <div className="news-dashboard__density" aria-label="News density">
          {(['comfortable', 'compact'] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={density === d ? 'is-active' : undefined}
              onClick={() => onDensityChange(d)}
            >
              {densityLabels[d]}
            </button>
          ))}
        </div>
      </div>

      {(Object.entries(grouped) as [NewsCategory, NewsSource[]][]).map(([cat, catSources]) => (
        catSources.length ? (
          <div key={cat} className="news-dashboard__source-group">
            <p className="news-dashboard__source-group-label">{CATEGORY_GROUP_LABELS[cat]}</p>
            <div className="news-dashboard__source-grid">
              {catSources.map((source) => {
                const enabled = enabledIds.has(source.id)
                return (
                  <button
                    key={source.id}
                    type="button"
                    className={enabled ? 'is-enabled' : undefined}
                    onClick={() => onToggle(source.id)}
                    style={{ '--news-accent': source.accent } as CSSProperties}
                  >
                    <span>{source.name}</span>
                    {enabled ? <Check size={13} aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null
      ))}
    </aside>
  )
}

// ─── Main dashboard ────────────────────────────────────────────────────────────
const NewsDashboard = () => {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>({})
  const [preferences, setPreferences] = useState<NewsPreferences>(() => readNewsPreferences())
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)

  const persistPreferences = useCallback((next: NewsPreferences) => {
    setPreferences(next)
    writeNewsPreferences(next)
  }, [])

  const orderedSources = useMemo(() => mergeSourceOrder(sources, preferences), [preferences, sources])
  const enabledSourceIds = useMemo(() => new Set(preferences.enabledSourceIds), [preferences.enabledSourceIds])
  const visibleSources = useMemo(
    () =>
      orderedSources.filter((source) => {
        if (!enabledSourceIds.has(source.id)) return false
        if (preferences.selectedCategory === 'all') return true
        return source.category === preferences.selectedCategory
      }),
    [enabledSourceIds, orderedSources, preferences.selectedCategory],
  )

  const latestUpdated = useMemo(() => {
    const timestamps = Object.values(sourceStates)
      .map((state) => new Date(state.response?.updatedTime ?? 0).getTime())
      .filter((value) => Number.isFinite(value) && value > 0)
    return timestamps.length ? Math.max(...timestamps) : undefined
  }, [sourceStates])

  const loadSource = useCallback(async (sourceId: string, latest = false, signal?: AbortSignal) => {
    setSourceStates((prev) => ({ ...prev, [sourceId]: { ...prev[sourceId], loading: true, error: undefined } }))
    try {
      const response = await fetchNewsSource(sourceId, { latest, signal })
      setSourceStates((prev) => ({ ...prev, [sourceId]: { loading: false, response } }))
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return
      setSourceStates((prev) => ({
        ...prev,
        [sourceId]: { ...prev[sourceId], loading: false, error: error instanceof Error ? error.message : 'Failed to load source' },
      }))
    }
  }, [])

  // Fetch sources list on mount
  useEffect(() => {
    const controller = new AbortController()
    setSourcesLoading(true)
    void fetchNewsSources(controller.signal)
      .then((nextSources) => {
        setSources(nextSources)
        setSourcesError(null)
      })
      .catch((error) => {
        if ((error as Error)?.name !== 'AbortError') {
          setSourcesError(error instanceof Error ? error.message : 'Failed to load news sources')
        }
      })
      .finally(() => setSourcesLoading(false))
    return () => controller.abort()
  }, [])

  // onVisible: called by IntersectionObserver inside each NewsCard
  const handleCardVisible = useCallback(
    (sourceId: string) => {
      // Only load if we haven't already started loading for this source
      setSourceStates((prev) => {
        if (prev[sourceId]) return prev  // already loading or loaded
        return { ...prev, [sourceId]: { loading: true } }
      })
      void loadSource(sourceId)
    },
    [loadSource],
  )

  const handleRefreshAll = async () => {
    const ids = visibleSources.map((source) => source.id)
    if (!ids.length) return
    setRefreshingAll(true)
    ids.forEach((id) => setSourceStates((prev) => ({ ...prev, [id]: { ...prev[id], loading: true, error: undefined } })))
    try {
      const response = await refreshNewsSources(ids)
      setSourceStates((prev) => {
        const next = { ...prev }
        response.results.forEach((result) => {
          if (result.status === 'error') next[result.id] = { ...next[result.id], loading: false, error: result.error }
          else next[result.id] = { loading: false, response: result }
        })
        return next
      })
    } finally {
      setRefreshingAll(false)
    }
  }

  const toggleSource = (sourceId: string) => {
    const enabled = new Set(preferences.enabledSourceIds)
    if (enabled.has(sourceId)) enabled.delete(sourceId)
    else enabled.add(sourceId)
    persistPreferences({ ...preferences, enabledSourceIds: [...enabled] })
  }

  const setCategory = (category: NewsCategory | 'all') => {
    persistPreferences({ ...preferences, selectedCategory: category })
  }

  const setDensity = (density: NewsDensity) => {
    persistPreferences({ ...preferences, density })
  }

  // ── Loading / error states for the source list itself ─────────────────
  if (sourcesLoading) {
    return (
      <section className="news-dashboard" aria-label="News">
        <div className="news-dashboard__loading">
          <div className="news-card__skeleton">
            <span /><span /><span /><span /><span />
          </div>
        </div>
      </section>
    )
  }

  if (sourcesError) {
    return (
      <section className="news-dashboard" aria-label="News">
        <div className="news-dashboard__fatal">
          <WifiOff size={28} aria-hidden="true" />
          <p>新闻来源加载失败</p>
          <small>{sourcesError}</small>
        </div>
      </section>
    )
  }

  return (
    <section className={`news-dashboard news-dashboard--${preferences.density}`} aria-label="News">
      <header className="news-dashboard__toolbar">
        <div>
          <p>NEWSROOM</p>
          <h2>News</h2>
          <span>最后更新 {formatUpdatedTime(latestUpdated)}</span>
        </div>
        <div className="news-dashboard__actions">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshingAll || visibleSources.length === 0}
          >
            <RefreshCw size={14} aria-hidden="true" className={refreshingAll ? 'is-spinning' : undefined} />
            刷新全部
          </button>
          <button
            type="button"
            onClick={() => setManageOpen((prev) => !prev)}
            aria-expanded={manageOpen}
            aria-label="管理来源"
          >
            <Settings2 size={14} aria-hidden="true" />
            来源
          </button>
        </div>
      </header>

      <CategoryFilter selected={preferences.selectedCategory} onChange={setCategory} />

      {manageOpen ? (
        <SourceManager
          sources={orderedSources}
          enabledIds={enabledSourceIds}
          density={preferences.density}
          onToggle={toggleSource}
          onDensityChange={setDensity}
        />
      ) : null}

      {visibleSources.length ? (
        <div className="news-dashboard__grid">
          {visibleSources.map((source, index) => (
            <NewsCard
              key={source.id}
              source={source}
              state={sourceStates[source.id] ?? { loading: true }}
              density={preferences.density}
              cardIndex={index}
              onRefresh={(sourceId) => void loadSource(sourceId, true)}
              onVisible={handleCardVisible}
              onManageSources={() => setManageOpen(true)}
            />
          ))}
        </div>
      ) : (
        <NewsEmpty onManageSources={() => setManageOpen(true)} />
      )}
    </section>
  )
}

export default NewsDashboard
