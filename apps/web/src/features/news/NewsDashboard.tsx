import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Clock, ListFilter, RefreshCw, Settings2, Star, WifiOff } from 'lucide-react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  fetchNewsSource,
  fetchNewsSources,
  refreshNewsSources,
  type NewsCategory,
  type NewsItem,
  type NewsSource,
  type NewsSourceResponse,
} from './newsApi'
import { readNewsPreferences, writeNewsPreferences, type NewsCategoryTab, type NewsDensity, type NewsPreferences } from './newsPreferences'
import BrandLoader from '../../shared/ui/loading/BrandLoader'
import './news.css'

type SourceState = {
  loading: boolean
  response?: NewsSourceResponse
  error?: string
}

const categoryLabels: Record<NewsCategoryTab, string> = {
  all: '全部',
  custom: '自定义',
  hot: '热榜',
  tech: '科技',
  finance: '财经',
  world: '国际',
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: source.id })

  const articleRef = useRef<HTMLElement | null>(null)
  const onVisibleRef = useRef(onVisible)
  onVisibleRef.current = onVisible

  const assignRef = useCallback((node: HTMLElement | null) => {
    articleRef.current = node
    setNodeRef(node)
  }, [setNodeRef])

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
      ref={assignRef}
      className={`news-card news-card--${density}${isDragging ? ' is-dragging' : ''}`}
      style={{
        '--news-accent': source.accent,
        '--card-index': cardIndex,
        transform: CSS.Transform.toString(transform),
        transition,
      } as CSSProperties}
    >
      {/* Accent top stripe */}
      <div className="news-card__stripe" aria-hidden="true" />

      <header className="news-card__header" {...attributes} {...listeners}>
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
const CATEGORIES = ['all', 'custom', 'hot', 'tech', 'finance', 'world'] as const

const CategoryFilter = ({
  selected,
  onChange,
}: {
  selected: NewsCategoryTab
  onChange: (cat: NewsCategoryTab) => void
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
  world: '国际',
}

const SourceManager = ({
  sources,
  enabledIds,
  customIds,
  density,
  onToggle,
  onToggleCustom,
  onDensityChange,
}: {
  sources: NewsSource[]
  enabledIds: Set<string>
  customIds: Set<string>
  density: NewsDensity
  onToggle: (id: string) => void
  onToggleCustom: (id: string) => void
  onDensityChange: (d: NewsDensity) => void
}) => {
  const grouped = useMemo(() => {
    const map: Record<NewsCategory, NewsSource[]> = { hot: [], tech: [], finance: [], world: [] }
    sources.forEach((s) => { map[s.category]?.push(s) })
    return map
  }, [sources])

  const renderSourceButton = (source: NewsSource) => {
    const enabled = enabledIds.has(source.id)
    const isCustom = customIds.has(source.id)
    return (
      <div
        key={source.id}
        className={`news-dashboard__source-item${enabled ? ' is-enabled' : ''}`}
        style={{ '--news-accent': source.accent } as CSSProperties}
      >
        <button
          type="button"
          className="news-dashboard__source-toggle"
          onClick={() => onToggle(source.id)}
          aria-pressed={enabled}
        >
          <span>{source.name}</span>
          {enabled ? <Check size={13} aria-hidden="true" /> : null}
        </button>
        <button
          type="button"
          className={`news-dashboard__source-star${isCustom ? ' is-active' : ''}`}
          onClick={() => onToggleCustom(source.id)}
          aria-label={isCustom ? `从自定义移除 ${source.name}` : `加入自定义 ${source.name}`}
          aria-pressed={isCustom}
          title={isCustom ? '从自定义移除' : '加入自定义'}
        >
          <Star size={13} aria-hidden="true" fill={isCustom ? 'currentColor' : 'none'} />
        </button>
      </div>
    )
  }

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
              {catSources.map(renderSourceButton)}
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
  const customSourceIds = useMemo(() => new Set(preferences.customSourceIds), [preferences.customSourceIds])
  const visibleSources = useMemo(
    () => {
      if (preferences.selectedCategory === 'custom') {
        const map = new Map(sources.map((s) => [s.id, s]))
        return preferences.customSourceIds
          .map((id) => map.get(id))
          .filter((s): s is NewsSource => Boolean(s))
      }
      return orderedSources.filter((source) => {
        if (!enabledSourceIds.has(source.id)) return false
        if (preferences.selectedCategory === 'all') return true
        return source.category === preferences.selectedCategory
      })
    },
    [enabledSourceIds, orderedSources, preferences.selectedCategory, preferences.customSourceIds, sources],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const activeId = String(active.id)
    const overId = String(over.id)
    const currentIds = visibleSources.map((s) => s.id)
    const oldIndex = currentIds.indexOf(activeId)
    const newIndex = currentIds.indexOf(overId)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(currentIds, oldIndex, newIndex)

    if (preferences.selectedCategory === 'custom') {
      const next: NewsPreferences = { ...preferences, customSourceIds: newOrder }
      setPreferences(next)
      writeNewsPreferences(next)
      return
    }

    // For all/category tabs: write back to global sourceOrder.
    // Replace the positions of the visible source ids in the existing order.
    const visibleSet = new Set(currentIds)
    const baseOrder = orderedSources.map((s) => s.id)
    let cursor = 0
    const merged = baseOrder.map((id) => {
      if (visibleSet.has(id)) {
        const replacement = newOrder[cursor]
        cursor += 1
        return replacement
      }
      return id
    })
    const next: NewsPreferences = { ...preferences, sourceOrder: merged }
    setPreferences(next)
    writeNewsPreferences(next)
  }, [orderedSources, preferences, visibleSources])

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
    let active = true
    setSourcesLoading(true)
    void fetchNewsSources(controller.signal)
      .then((nextSources) => {
        if (!active) return
        setSources(nextSources)
        setSourcesError(null)
      })
      .catch((error) => {
        if (active && (error as Error)?.name !== 'AbortError') {
          setSourcesError(error instanceof Error ? error.message : 'Failed to load news sources')
        }
      })
      .finally(() => {
        if (active) setSourcesLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
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

  const toggleCustom = (sourceId: string) => {
    const inCustom = preferences.customSourceIds.includes(sourceId)
    if (inCustom) {
      persistPreferences({
        ...preferences,
        customSourceIds: preferences.customSourceIds.filter((id) => id !== sourceId),
      })
      return
    }
    const enabled = new Set(preferences.enabledSourceIds)
    enabled.add(sourceId)
    persistPreferences({
      ...preferences,
      customSourceIds: [...preferences.customSourceIds, sourceId],
      enabledSourceIds: [...enabled],
    })
  }

  const setCategory = (category: NewsCategoryTab) => {
    persistPreferences({ ...preferences, selectedCategory: category })
  }

  const setDensity = (density: NewsDensity) => {
    persistPreferences({ ...preferences, density })
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
      <div className="news-dashboard__controls">
        <CategoryFilter selected={preferences.selectedCategory} onChange={setCategory} />
        <div className="news-dashboard__actions">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={sourcesLoading || refreshingAll || visibleSources.length === 0}
          >
            <RefreshCw size={14} aria-hidden="true" className={refreshingAll ? 'is-spinning' : undefined} />
            刷新全部
          </button>
          <button
            type="button"
            onClick={() => setManageOpen((prev) => !prev)}
            aria-expanded={manageOpen}
            aria-label="管理来源"
            disabled={sourcesLoading}
          >
            <Settings2 size={14} aria-hidden="true" />
            来源
          </button>
        </div>
      </div>

      {manageOpen ? (
        <SourceManager
          sources={orderedSources}
          enabledIds={enabledSourceIds}
          customIds={customSourceIds}
          density={preferences.density}
          onToggle={toggleSource}
          onToggleCustom={toggleCustom}
          onDensityChange={setDensity}
        />
      ) : null}

      {sourcesLoading ? (
        <BrandLoader variant="inline" className="news-dashboard__page-loader" data-testid="news-source-loader" />
      ) : visibleSources.length ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleSources.map((s) => s.id)} strategy={rectSortingStrategy}>
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
          </SortableContext>
        </DndContext>
      ) : (
        <NewsEmpty onManageSources={() => setManageOpen(true)} />
      )}
    </section>
  )
}

export default NewsDashboard
