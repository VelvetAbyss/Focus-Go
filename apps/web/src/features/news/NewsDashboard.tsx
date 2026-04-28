import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, ListFilter, RefreshCw, Settings2 } from 'lucide-react'
import { fetchNewsSource, fetchNewsSources, refreshNewsSources, type NewsCategory, type NewsItem, type NewsSource, type NewsSourceResponse } from './newsApi'
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

const NewsSkeleton = () => (
  <div className="news-card__skeleton" aria-hidden="true">
    <span />
    <span />
    <span />
    <span />
    <span />
  </div>
)

const NewsEmpty = ({ onManageSources }: { onManageSources: () => void }) => (
  <div className="news-dashboard__empty">
    <p>No stories yet</p>
    <button type="button" onClick={onManageSources}>管理来源</button>
  </div>
)

const NewsCard = ({
  source,
  state,
  density,
  onRefresh,
  onManageSources,
}: {
  source: NewsSource
  state: SourceState
  density: NewsDensity
  onRefresh: (sourceId: string) => void
  onManageSources: () => void
}) => {
  const items = state.response?.items ?? []
  const isCached = state.response?.status === 'cache'
  return (
    <article className={`news-card news-card--${density}`} style={{ '--news-accent': source.accent } as CSSProperties}>
      <header className="news-card__header">
        <a className="news-card__source" href={source.home} target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">{source.name.slice(0, 1)}</span>
          <strong>{source.name}</strong>
        </a>
        <button
          type="button"
          className="news-icon-button"
          onClick={() => onRefresh(source.id)}
          aria-label={`刷新 ${source.name}`}
          disabled={state.loading}
        >
          <RefreshCw size={15} aria-hidden="true" className={state.loading ? 'is-spinning' : undefined} />
        </button>
      </header>

      <div className="news-card__meta">
        <span>{source.type === 'hottest' ? '热榜' : '时间线'}</span>
        <span>{formatUpdatedTime(state.response?.updatedTime)}</span>
        {isCached ? <span>缓存</span> : null}
      </div>

      {state.loading && !items.length ? <NewsSkeleton /> : null}
      {!state.loading && state.error && !items.length ? (
        <div className="news-card__error">
          <p>刷新失败</p>
          <button type="button" onClick={() => onRefresh(source.id)}>重试</button>
        </div>
      ) : null}
      {!state.loading && !state.error && !items.length ? <NewsEmpty onManageSources={onManageSources} /> : null}

      {items.length ? (
        <ol className="news-card__list">
          {items.map((item, index) => (
            <li key={`${source.id}-${item.id}`}>
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

      {state.error && items.length ? <footer className="news-card__warning">刷新失败，正在显示缓存内容</footer> : null}
      {state.response?.warning ? <footer className="news-card__warning">来源暂不可用，已回退缓存</footer> : null}
    </article>
  )
}

const NewsDashboard = () => {
  const [sources, setSources] = useState<NewsSource[]>([])
  const [sourceStates, setSourceStates] = useState<Record<string, SourceState>>({})
  const [preferences, setPreferences] = useState<NewsPreferences>(() => readNewsPreferences())
  const [sourcesLoading, setSourcesLoading] = useState(true)
  const [sourcesError, setSourcesError] = useState<string | null>(null)
  const [manageOpen, setManageOpen] = useState(false)
  const [refreshingAll, setRefreshingAll] = useState(false)
  const requestedSourceIdsRef = useRef(new Set<string>())

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
      setSourceStates((prev) => ({
        ...prev,
        [sourceId]: { ...prev[sourceId], loading: false, error: error instanceof Error ? error.message : 'Failed to load source' },
      }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setSourcesLoading(true)
    void fetchNewsSources(controller.signal)
      .then((nextSources) => {
        setSources(nextSources)
        setSourcesError(null)
      })
      .catch((error) => setSourcesError(error instanceof Error ? error.message : 'Failed to load news sources'))
      .finally(() => setSourcesLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!visibleSources.length) return
    visibleSources.forEach((source) => {
      if (!requestedSourceIdsRef.current.has(source.id)) {
        requestedSourceIdsRef.current.add(source.id)
        void loadSource(source.id)
      }
    })
  }, [loadSource, visibleSources])

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

  if (sourcesLoading) {
    return (
      <section className="news-dashboard" aria-label="News">
        <div className="news-dashboard__loading"><NewsSkeleton /></div>
      </section>
    )
  }

  if (sourcesError) {
    return (
      <section className="news-dashboard" aria-label="News">
        <div className="news-dashboard__fatal">
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
          <button type="button" onClick={handleRefreshAll} disabled={refreshingAll || visibleSources.length === 0}>
            <RefreshCw size={15} aria-hidden="true" className={refreshingAll ? 'is-spinning' : undefined} />
            刷新全部
          </button>
          <button type="button" onClick={() => setManageOpen((prev) => !prev)} aria-expanded={manageOpen}>
            <Settings2 size={15} aria-hidden="true" />
            来源
          </button>
        </div>
      </header>

      <div className="news-dashboard__filters" role="tablist" aria-label="News categories">
        {(['all', 'hot', 'tech', 'finance'] as const).map((category) => (
          <button
            key={category}
            type="button"
            role="tab"
            aria-selected={preferences.selectedCategory === category}
            className={preferences.selectedCategory === category ? 'is-active' : undefined}
            onClick={() => setCategory(category)}
          >
            <ListFilter size={14} aria-hidden="true" />
            {categoryLabels[category]}
          </button>
        ))}
      </div>

      {manageOpen ? (
        <aside className="news-dashboard__manager" aria-label="Manage news sources">
          <div className="news-dashboard__density" aria-label="News density">
            {(['comfortable', 'compact'] as const).map((density) => (
              <button
                key={density}
                type="button"
                className={preferences.density === density ? 'is-active' : undefined}
                onClick={() => setDensity(density)}
              >
                {densityLabels[density]}
              </button>
            ))}
          </div>
          <div className="news-dashboard__source-grid">
            {orderedSources.map((source) => {
              const enabled = enabledSourceIds.has(source.id)
              return (
                <button
                  key={source.id}
                  type="button"
                  className={enabled ? 'is-enabled' : undefined}
                  onClick={() => toggleSource(source.id)}
                  style={{ '--news-accent': source.accent } as CSSProperties}
                >
                  <span>{source.name}</span>
                  {enabled ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
        </aside>
      ) : null}

      {visibleSources.length ? (
        <div className="news-dashboard__grid">
          {visibleSources.map((source) => (
            <NewsCard
              key={source.id}
              source={source}
              state={sourceStates[source.id] ?? { loading: true }}
              density={preferences.density}
              onRefresh={(sourceId) => void loadSource(sourceId, true)}
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
