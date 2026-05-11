import { ChevronRight, Headphones, ListMusic, Pause, Play, Search, Shuffle, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import { getPlaybackProgress, seekTo, subscribePlaybackProgress } from '../podcastPlayback'
import type { PodcastPlaybackMode } from '../podcastPlayback'

const EPISODE_ROW_HEIGHT = 34 // 8px padding-top + ~16px content + 8px padding-bottom + 1px divider

const fmtDate = (iso?: string) => {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  } catch {
    return null
  }
}

const fmt = (s: number) => {
  if (!isFinite(s) || s <= 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
import type { LifePodcast } from '../../../data/models/types'
import type { PodcastPresentationModel } from '../cards/lifeDesignAdapters'
import {
  cardArrowStyle,
  cardHeaderStyle,
  cardShellStyle,
  detailPaneStyle,
  Field,
  iconButtonStyle,
  ink,
  inter,
  LifeCardLoader,
  modalHeaderStyle,
  modalLayoutStyle,
  mutedText,
  paper,
  playfair,
  sectionBorder,
  sidebarStyle,
  smallButtonStyle,
  subtleBorder,
  textareaStyle,
  inputStyle,
} from './lifeDesignPrimitives'
import { useLifeI18n } from '../lifeI18n'

type SearchResult = {
  id: string
  title: string
  author: string
  artworkUrl?: string
  genre?: string
  externalUrl?: string
  releaseDate?: string
  trackCount?: number
}

type Props = {
  model: PodcastPresentationModel
  items: LifePodcast[]
  selected: LifePodcast | null
  selectedId: string | null
  open: boolean
  loading: boolean
  query: string
  channelUrl: string
  searching: boolean
  error: string | null
  results: SearchResult[]
  presetChannels: Array<{ id: string; title: string; url: string }>
  addingCandidateId: string | null
  refreshingPodcastId: string | null
  playbackMode: PodcastPlaybackMode
  neteaseExperimentalPlaybackEnabled: boolean
  standalone?: boolean
  onOpen: () => void
  onClose: () => void
  onQueryChange: (value: string) => void
  onChannelUrlChange: (value: string) => void
  onSearch: () => void
  onImportChannel: (value: string) => void
  onImportPreset: (url: string, id: string) => void
  onSelectItem: (id: string) => void
  onAddItem: (id: string) => void
  onSelectEpisode: (podcastId: string, episodeId: string) => void
  onTogglePlaying: (podcastId: string) => void
  onPlaybackModeChange: (mode: PodcastPlaybackMode) => void
  onOpenExternal: (url?: string) => void
  onClearResults: () => void
  onRefreshItem: (id: string) => void
  onRemoveItem: (id: string) => void
}

export const PodcastCardSurface = ({
  model,
  items,
  selected,
  selectedId,
  open,
  loading,
  query,
  channelUrl,
  searching,
  error,
  results,
  presetChannels,
  addingCandidateId,
  refreshingPodcastId,
  playbackMode,
  neteaseExperimentalPlaybackEnabled,
  standalone,
  onOpen,
  onClose,
  onQueryChange,
  onChannelUrlChange,
  onSearch,
  onImportChannel,
  onImportPreset,
  onSelectItem,
  onAddItem,
  onSelectEpisode,
  onTogglePlaying,
  onPlaybackModeChange,
  onOpenExternal,
  onClearResults,
  onRefreshItem,
  onRemoveItem,
}: Props) => {
  const { t } = useLifeI18n()
  const sidebarRef = useRef<HTMLElement>(null)
  const [episodesEl, setEpisodesEl] = useState<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState<{ currentTime: number; duration: number } | null>(null)
  const [episodeSearch, setEpisodeSearch] = useState('')
  const [showEpisodeSearch, setShowEpisodeSearch] = useState(false)
  const [episodeSort, setEpisodeSort] = useState<'newest' | 'oldest'>('newest')
  const episodeSearchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const update = () => setProgress(getPlaybackProgress())
    update()
    return subscribePlaybackProgress(update)
  }, [])
  const [visibleEpisodeCount, setVisibleEpisodeCount] = useState(3)

  useEffect(() => {
    if (!episodesEl) return
    const observer = new ResizeObserver(([entry]) => {
      setVisibleEpisodeCount(Math.max(0, Math.floor(entry.contentRect.height / EPISODE_ROW_HEIGHT)))
    })
    observer.observe(episodesEl)
    return () => observer.disconnect()
  }, [episodesEl])

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClearResults()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClearResults])

  // Reset episode search/sort when switching podcasts
  useEffect(() => {
    setEpisodeSearch('')
    setShowEpisodeSearch(false)
  }, [selectedId])

  const selectedEpisode = useMemo(
    () => selected?.episodes.find((episode) => episode.id === selected.selectedEpisodeId) ?? selected?.episodes[0] ?? null,
    [selected],
  )

  const filteredEpisodes = useMemo(() => {
    const episodes = selected?.episodes ?? []
    const sorted = episodeSort === 'oldest' ? [...episodes].reverse() : episodes
    const q = episodeSearch.trim().toLowerCase()
    return q ? sorted.filter((ep) => ep.title.toLowerCase().includes(q)) : sorted
  }, [selected?.episodes, episodeSort, episodeSearch])

  const selectedSourceLabel = selected?.source === 'netease' ? t('life.podcast.netease') : t('life.podcast.apple')
  const isNeteaseDefaultMode = selected?.source === 'netease' && !neteaseExperimentalPlaybackEnabled
  const cardActionLabel = model.nowPlaying?.source === 'netease' && !neteaseExperimentalPlaybackEnabled ? t('life.podcast.openOriginal') : model.nowPlaying?.isPlaying ? t('life.podcast.pause') : t('life.podcast.openPlayer')
  const playbackModeButtonStyle = (mode: PodcastPlaybackMode): React.CSSProperties => ({
    ...smallButtonStyle,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: playbackMode === mode ? 'rgba(58,55,51,0.10)' : smallButtonStyle.background,
    borderColor: playbackMode === mode ? 'rgba(58,55,51,0.22)' : smallButtonStyle.borderColor,
    color: playbackMode === mode ? '#3A3733' : smallButtonStyle.color,
  })

  return (
    <>
      {!standalone && (<div onClick={onOpen} style={cardShellStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Headphones size={13} color="rgba(58,55,51,0.38)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{t('life.card.podcast')}</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{t('life.card.podcast')}</h3>
          </div>
          <div style={cardArrowStyle}><ChevronRight size={15} /></div>
        </div>

        <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <LifeCardLoader />
          ) : model.nowPlaying ? (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexShrink: 0 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: `linear-gradient(135deg, ${model.nowPlaying.coverColor} 0%, ${model.nowPlaying.coverColor}CC 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {model.nowPlaying.artworkUrl
                    ? <img src={model.nowPlaying.artworkUrl} alt={model.nowPlaying.podcastName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : model.nowPlaying.coverEmoji}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      ...inter(9, 600, model.nowPlaying.isPlaying ? '#3D7A4E' : 'rgba(58,55,51,0.40)'),
                      display: 'inline-flex',
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: model.nowPlaying.isPlaying ? 'rgba(110,171,122,0.12)' : 'rgba(58,55,51,0.06)',
                      marginBottom: 6,
                      letterSpacing: '0.05em',
                    }}
                  >
                    {model.nowPlaying.isPlaying ? t('life.podcast.playing') : t('life.podcast.lastPlayed')}
                  </span>
                  <p style={{ ...playfair(13, 500), lineHeight: 1.3, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{model.nowPlaying.title}</p>
                  <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.50)'), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {model.nowPlaying.podcastName}{model.nowPlaying.duration ? ` · ${model.nowPlaying.duration}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  if (selected) onTogglePlaying(selected.id)
                  else onOpen()
                }}
                style={{ ...smallButtonStyle, marginTop: 14, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {model.nowPlaying.isPlaying ? <Pause size={11} /> : <Play size={11} />}
                <span>{cardActionLabel}</span>
              </button>

              {/* Compact progress bar in card view */}
              {progress && progress.duration > 0 && (
                <div style={{ marginTop: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ ...inter(9, 400, 'rgba(58,55,51,0.35)') }}>{fmt(progress.currentTime)}</span>
                    <span style={{ ...inter(9, 400, 'rgba(58,55,51,0.25)') }}>{fmt(progress.duration)}</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'rgba(58,55,51,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: 'rgba(58,55,51,0.28)', width: `${(progress.currentTime / progress.duration) * 100}%`, transition: 'width 0.25s linear' }} />
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14, borderTop: `1px solid ${sectionBorder}`, paddingTop: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10, flexShrink: 0 }}>{t('life.podcast.recentEpisodes')}</p>
                <div ref={setEpisodesEl} style={{ flex: 1, overflow: 'hidden' }}>
                  {model.recentEpisodes.slice(0, visibleEpisodeCount).map((episode, index) => (
                    <div key={episode.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                        <span style={{ fontSize: 12 }}>{episode.coverEmoji}</span>
                        <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.65)'), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.title}</p>
                        <span style={{ ...inter(10, 400, 'rgba(58,55,51,0.30)') }}>{episode.duration}</span>
                      </div>
                      {index < visibleEpisodeCount - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.05)' }} /> : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', minHeight: 180, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Headphones size={20} color="rgba(58,55,51,0.30)" />
              </div>
              <p style={{ ...playfair(14, 500), marginBottom: 6 }}>{t('life.podcast.emptyTitle')}</p>
              <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.6, marginBottom: 18 }}>{t('life.podcast.emptyDescription')}</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Search size={11} />
                <span>{t('life.podcast.findPodcast')}</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${sectionBorder}` }}>
          <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)') }}>{model.statsLabel}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...inter(11, 500) }}>
            <span>{model.nowPlaying?.source === 'netease' && !neteaseExperimentalPlaybackEnabled ? t('life.podcast.openOriginal') : t('life.podcast.openPlayer')}</span>
            <ChevronRight size={11} />
          </div>
        </div>
      </div>)}

      {open ? <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>{t('life.card.podcast')}</p>
              <h2 style={{ ...playfair(22, 500) }}>{t('life.card.podcast')}</h2>
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            <aside ref={sidebarRef} style={sidebarStyle}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr', minWidth: 0 }}>
                <Field label={t('life.podcast.search')}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }}
                      placeholder={t('life.podcast.searchPlaceholder')}
                      style={{ ...inputStyle, paddingRight: 56 }}
                    />
                    <button
                      type="button"
                      onClick={onSearch}
                      style={{
                        position: 'absolute',
                        right: 6,
                        ...inter(11, 600, ink),
                        background: 'rgba(58,55,51,0.08)',
                        border: 'none',
                        borderRadius: 7,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {searching ? '···' : t('life.podcast.search')}
                    </button>
                  </div>
                </Field>
                <Field label={t('life.podcast.neteaseChannel')}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      value={channelUrl}
                      onChange={(event) => onChannelUrlChange(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') onImportChannel(channelUrl) }}
                      placeholder="https://music.163.com/djradio?id=..."
                      style={{ ...inputStyle, paddingRight: 72 }}
                    />
                    <button
                      type="button"
                      onClick={() => onImportChannel(channelUrl)}
                      style={{
                        position: 'absolute',
                        right: 6,
                        ...inter(11, 600, ink),
                        background: 'rgba(58,55,51,0.08)',
                        border: 'none',
                        borderRadius: 7,
                        padding: '5px 10px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {addingCandidateId?.startsWith('channel:') ? '···' : t('life.podcast.import')}
                    </button>
                  </div>
                </Field>
                <div style={{ display: 'grid', gap: 8 }}>
                  {presetChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => onImportPreset(channel.url, channel.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 16,
                        border: `1px solid ${subtleBorder}`,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channel.title}</p>
                          <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('life.podcast.presetChannel')}</p>
                        </div>
                        <span style={{ ...inter(11, 500, ink) }}>{addingCandidateId === `preset:${channel.id}` ? '...' : t('life.podcast.import')}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {error ? <p style={{ ...inter(11, 400, '#9D4C4C') }}>{error}</p> : null}
                {results.length ? (
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', minWidth: 0 }}>
                    {results.map((result) => {
                      const formattedDate = fmtDate(result.releaseDate)
                      return (
                        <div key={result.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 16, border: `1px solid ${subtleBorder}`, background: '#fff', minWidth: 0, width: '100%' }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', background: 'rgba(58,55,51,0.06)', flexShrink: 0, marginTop: 1 }}>
                            {result.artworkUrl ? <img src={result.artworkUrl} alt={result.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>{result.title}</p>
                            <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{result.author}{result.genre ? ` · ${result.genre}` : ''}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {result.trackCount != null && (
                                <span style={{ ...inter(9, 500, 'rgba(58,55,51,0.50)'), background: 'rgba(58,55,51,0.06)', borderRadius: 5, padding: '2px 6px' }}>
                                  {result.trackCount} 期
                                </span>
                              )}
                              {formattedDate && (
                                <span style={{ ...inter(9, 400, 'rgba(58,55,51,0.40)') }}>
                                  最新 {formattedDate}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onAddItem(result.id)}
                            title="Add"
                            style={{
                              flexShrink: 0,
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              border: '1px solid rgba(58,55,51,0.12)',
                              background: 'rgba(58,55,51,0.06)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              lineHeight: 1,
                              color: 'rgba(58,55,51,0.55)',
                              padding: 0,
                              alignSelf: 'center',
                            }}
                          >
                            {addingCandidateId === result.id ? '·' : '+'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                <div style={{ display: 'grid', gap: 6, paddingTop: 6, gridTemplateColumns: '1fr', minWidth: 0 }}>
                  {items.map((item) => (
                    <div key={item.id} className="life-sidebar-item">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 14px',
                          paddingRight: 40,
                          borderRadius: 16,
                          border: selectedId === item.id ? '1px solid rgba(58,55,51,0.12)' : '1px solid transparent',
                          background: selectedId === item.id ? 'rgba(58,55,51,0.06)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                        <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.author}{item.source === 'netease' ? ` · ${t('life.podcast.netease')}` : ` · ${t('life.podcast.apple')}`}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="life-sidebar-item__delete"
                        title={t('life.podcast.remove')}
                        onClick={(event) => { event.stopPropagation(); onRemoveItem(item.id) }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
            <div style={{ ...detailPaneStyle, background: paper, display: 'flex', flexDirection: 'column' }}>
              {selected ? (
                <>
                  <div
                    style={{
                      flexShrink: 0, background: paper,
                      position: 'relative',
                      padding: '20px 20px 16px', borderBottom: `1px solid ${sectionBorder}`,
                      overflow: 'hidden',
                      '--pod-color': selected.coverColor ?? 'rgba(58,55,51,0.15)',
                    } as React.CSSProperties}
                  >
                    {/* Album art blurred background */}
                    {selected.artworkUrl && (
                      <img
                        src={selected.artworkUrl}
                        alt=""
                        aria-hidden="true"
                        className={`podcast-bg-art${selected.isPlaying ? ' is-playing' : ''}`}
                      />
                    )}
                    {/* Ambient color bleed from cover art */}
                    <div
                      className={`podcast-ambient-glow${selected.isPlaying ? ' is-playing' : ''}`}
                      style={{
                        background: `radial-gradient(ellipse 220% 200% at -8% 50%, ${selected.coverColor ?? 'rgba(58,55,51,0.12)'} 0%, transparent 62%)`,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative' }}>
                      <div className={`podcast-cover-outer${selected.isPlaying ? ' is-playing' : ''}`}>
                        <div style={{ width: 88, height: 88, borderRadius: 24, overflow: 'hidden', background: selected.coverColor ?? 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34 }}>
                          {selected.artworkUrl ? <img src={selected.artworkUrl} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selected.coverEmoji ?? '🎙'}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {selected.isPlaying ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                            <span className="podcast-eq" style={{ color: '#3D7A4E' }}>
                              <span className="podcast-eq__bar" />
                              <span className="podcast-eq__bar" />
                              <span className="podcast-eq__bar" />
                            </span>
                            <span style={{ ...inter(9, 700, '#3D7A4E'), letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('life.podcast.nowPlaying')}</span>
                          </div>
                        ) : null}
                        <h3 style={{ ...playfair(24, 500), marginBottom: 4 }}>{selected.name}</h3>
                        <p style={{ ...inter(13, 400, mutedText), marginBottom: 10 }}>{selected.author}</p>
                        <p style={{ ...inter(10, 500, 'rgba(58,55,51,0.42)'), marginBottom: 10 }}>{selectedSourceLabel}</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => onTogglePlaying(selected.id)} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {selected.isPlaying && !isNeteaseDefaultMode ? <Pause size={11} /> : <Play size={11} />}
                            <span>{isNeteaseDefaultMode ? t('life.podcast.openOriginal') : selected.isPlaying ? t('life.podcast.pause') : t('life.podcast.play')}</span>
                          </button>
                          <button
                            type="button"
                            aria-pressed={playbackMode === 'sequence'}
                            title={t('life.podcast.sequenceMode')}
                            onClick={() => onPlaybackModeChange('sequence')}
                            style={playbackModeButtonStyle('sequence')}
                          >
                            <ListMusic size={11} />
                            <span>{t('life.podcast.sequenceShort')}</span>
                          </button>
                          <button
                            type="button"
                            aria-pressed={playbackMode === 'shuffle'}
                            title={t('life.podcast.shuffleMode')}
                            onClick={() => onPlaybackModeChange('shuffle')}
                            style={playbackModeButtonStyle('shuffle')}
                          >
                            <Shuffle size={11} />
                            <span>{t('life.podcast.shuffleShort')}</span>
                          </button>
                          {selected.source === 'itunes' ? (
                            <button type="button" onClick={() => onOpenExternal(selected.externalUrl ?? `https://podcasts.apple.com/podcast/id${selected.collectionId}`)} style={smallButtonStyle}>{t('life.podcast.viewOnApple')}</button>
                          ) : null}
                          {selected.source === 'netease' ? (
                            <button type="button" onClick={() => onOpenExternal(selected.externalUrl ?? `https://music.163.com/djradio?id=${encodeURIComponent(selected.sourceId)}`)} style={smallButtonStyle}>{t('life.podcast.openChannel')}</button>
                          ) : null}
                          {selected.source === 'netease' ? (
                            <button type="button" onClick={() => onRefreshItem(selected.id)} style={smallButtonStyle}>
                              {refreshingPodcastId === selected.id ? '...' : t('life.podcast.refresh')}
                            </button>
                          ) : null}
                          <button type="button" onClick={() => onRemoveItem(selected.id)} style={{ ...smallButtonStyle, color: '#9D4C4C' }}>{t('life.podcast.remove')}</button>
                        </div>
                        {/* Seekable progress bar in modal header */}
                        {progress && progress.duration > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <div
                              style={{ height: 4, borderRadius: 999, background: 'rgba(58,55,51,0.09)', cursor: 'pointer', overflow: 'hidden' }}
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                seekTo((e.clientX - rect.left) / rect.width)
                              }}
                            >
                              <div style={{ height: '100%', borderRadius: 999, background: 'rgba(58,55,51,0.32)', width: `${(progress.currentTime / progress.duration) * 100}%`, transition: 'width 0.25s linear' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                              <span style={{ ...inter(9, 400, 'rgba(58,55,51,0.38)') }}>{fmt(progress.currentTime)}</span>
                              <span style={{ ...inter(9, 400, 'rgba(58,55,51,0.28)') }}>{fmt(progress.duration)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Episodes section: sticky header bar + scrollable list */}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Fixed header bar — does not scroll */}
                    <div style={{ flexShrink: 0, padding: '10px 20px 8px', borderBottom: `1px solid ${sectionBorder}`, background: paper }}>
                      {selected.source === 'itunes' ? (
                        <p style={{ ...inter(10, 400, mutedText), marginBottom: 6 }}>{t('life.podcast.metadataApple')}</p>
                      ) : null}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', flex: 1, margin: 0 }}>
                          {t('life.podcast.episodes')}{selected.episodes.length > 0 ? ` · ${filteredEpisodes.length}${filteredEpisodes.length < selected.episodes.length ? `/${selected.episodes.length}` : ''}` : ''}
                        </p>
                        {/* Search toggle */}
                        <button
                          type="button"
                          title={showEpisodeSearch ? 'Clear search' : 'Search episodes'}
                          onClick={() => {
                            const next = !showEpisodeSearch
                            setShowEpisodeSearch(next)
                            if (!next) setEpisodeSearch('')
                            else setTimeout(() => episodeSearchRef.current?.focus(), 0)
                          }}
                          style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: showEpisodeSearch ? 0.7 : 0.35, transition: 'opacity 0.15s' }}
                        >
                          {showEpisodeSearch ? <X size={11} color={ink} /> : <Search size={11} color={ink} />}
                        </button>
                        {/* Sort toggle */}
                        <button
                          type="button"
                          title={episodeSort === 'newest' ? 'Showing newest first — click for oldest first' : 'Showing oldest first — click for newest first'}
                          onClick={() => setEpisodeSort((s) => s === 'newest' ? 'oldest' : 'newest')}
                          style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: episodeSort === 'oldest' ? 0.7 : 0.35, transition: 'opacity 0.15s', gap: 2 }}
                        >
                          <span style={{ ...inter(9, 600, ink), letterSpacing: '0.02em', lineHeight: 1 }}>
                            {episodeSort === 'newest' ? '↓' : '↑'}
                          </span>
                        </button>
                      </div>
                      {showEpisodeSearch ? (
                        <input
                          ref={episodeSearchRef}
                          type="text"
                          placeholder="Search episodes…"
                          value={episodeSearch}
                          onChange={(e) => setEpisodeSearch(e.target.value)}
                          style={{
                            ...inputStyle,
                            marginTop: 8,
                            width: '100%',
                            boxSizing: 'border-box',
                            fontSize: 12,
                            padding: '6px 10px',
                          }}
                        />
                      ) : null}
                    </div>
                    {/* Scrollable episodes list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {filteredEpisodes.map((episode) => (
                          <div
                            key={episode.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 16,
                              border: selected.selectedEpisodeId === episode.id ? '1px solid rgba(58,55,51,0.12)' : `1px solid ${subtleBorder}`,
                              background: selected.selectedEpisodeId === episode.id ? 'rgba(58,55,51,0.06)' : '#fff',
                              textAlign: 'left',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectEpisode(selected.id, episode.id)}
                              style={{ minWidth: 0, flex: 1, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            >
                              <p style={{ ...inter(12, 500), marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.title}</p>
                              <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.releaseDate ?? t('life.podcast.noDate')}{episode.duration ? ` · ${episode.duration}` : ''}</p>
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {selected.source === 'itunes' && episode.externalUrl ? (
                                <button type="button" onClick={() => onOpenExternal(episode.externalUrl)} style={smallButtonStyle}>{t('life.podcast.openInApple')}</button>
                              ) : null}
                              {selected.selectedEpisodeId === episode.id ? <Play size={12} color={ink} /> : null}
                            </div>
                          </div>
                        ))}
                        {filteredEpisodes.length === 0 && episodeSearch ? (
                          <p style={{ ...inter(12, 400, mutedText), padding: '12px 0' }}>No episodes match "{episodeSearch}"</p>
                        ) : null}
                      </div>
                      {selectedEpisode?.description ? (
                        <div style={{ marginTop: 16 }}>
                          <Field label="Description">
                            <textarea readOnly value={selectedEpisode.description} style={textareaStyle} />
                          </Field>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ padding: 20, ...inter(13, 400, mutedText) }}>{t('life.podcast.searchStart')}</div>
              )}
            </div>
          </div>
        </div>
      </Dialog> : null}
    </>
  )
}
