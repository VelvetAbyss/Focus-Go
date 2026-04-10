import { ChevronRight, Headphones, Pause, Play, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import Dialog from '../../../shared/ui/Dialog'
import { getPlaybackProgress, seekTo, subscribePlaybackProgress } from '../podcastPlayback'

const EPISODE_ROW_HEIGHT = 34 // 8px padding-top + ~16px content + 8px padding-bottom + 1px divider

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

type SearchResult = {
  id: string
  title: string
  author: string
  artworkUrl?: string
  genre?: string
  externalUrl?: string
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
  neteaseExperimentalPlaybackEnabled: boolean
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
  neteaseExperimentalPlaybackEnabled,
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
  onOpenExternal,
  onClearResults,
  onRefreshItem,
  onRemoveItem,
}: Props) => {
  const sidebarRef = useRef<HTMLElement>(null)
  const [episodesEl, setEpisodesEl] = useState<HTMLDivElement | null>(null)
  const [progress, setProgress] = useState<{ currentTime: number; duration: number } | null>(null)

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

  const selectedEpisode = useMemo(
    () => selected?.episodes.find((episode) => episode.id === selected.selectedEpisodeId) ?? selected?.episodes[0] ?? null,
    [selected],
  )
  const selectedSourceLabel = selected?.source === 'netease' ? 'Netease (Open Original)' : 'Apple Podcasts'
  const isNeteaseDefaultMode = selected?.source === 'netease' && !neteaseExperimentalPlaybackEnabled
  const cardActionLabel = model.nowPlaying?.source === 'netease' && !neteaseExperimentalPlaybackEnabled ? 'Open Original' : model.nowPlaying?.isPlaying ? 'Pause' : 'Open Player'

  return (
    <>
      <div onClick={onOpen} style={cardShellStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Headphones size={13} color="rgba(58,55,51,0.38)" />
              <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>Podcast</span>
            </div>
            <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>Podcast</h3>
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
                    {model.nowPlaying.isPlaying ? 'PLAYING' : 'LAST PLAYED'}
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
                <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10, flexShrink: 0 }}>Recent Episodes</p>
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
              <p style={{ ...playfair(14, 500), marginBottom: 6 }}>Your podcast shelf is empty</p>
              <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.6, marginBottom: 18 }}>Search podcasts or import a Netease channel link.</p>
              <button type="button" onClick={(event) => { event.stopPropagation(); onOpen() }} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Search size={11} />
                <span>Find podcast</span>
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: `1px solid ${sectionBorder}` }}>
          <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.38)') }}>{model.statsLabel}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...inter(11, 500) }}>
            <span>{model.nowPlaying?.source === 'netease' && !neteaseExperimentalPlaybackEnabled ? 'Open Original' : 'Open Player'}</span>
            <ChevronRight size={11} />
          </div>
        </div>
      </div>

      <Dialog open={open} onClose={onClose} panelClassName="life-modal__panel" contentClassName="life-modal__content">
        <div style={modalLayoutStyle}>
          <div style={modalHeaderStyle}>
            <div>
              <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>Podcast</p>
              <h2 style={{ ...playfair(22, 500) }}>Podcast</h2>
            </div>
            <button type="button" onClick={onClose} style={iconButtonStyle}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', minHeight: 0, flex: 1 }}>
            <aside ref={sidebarRef} style={sidebarStyle}>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1fr', minWidth: 0 }}>
                <Field label="Search">
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      value={query}
                      onChange={(event) => onQueryChange(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter') onSearch() }}
                      placeholder="Search podcast or paste a Netease link"
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
                      {searching ? '···' : 'Go'}
                    </button>
                  </div>
                </Field>
                <Field label="Netease channel">
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
                      {addingCandidateId?.startsWith('channel:') ? '···' : 'Import'}
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
                          <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Preset Netease channel</p>
                        </div>
                        <span style={{ ...inter(11, 500, ink) }}>{addingCandidateId === `preset:${channel.id}` ? '...' : 'Import'}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {error ? <p style={{ ...inter(11, 400, '#9D4C4C') }}>{error}</p> : null}
                {results.length ? (
                  <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr', minWidth: 0 }}>
                    {results.map((result) => (
                      <div key={result.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, border: `1px solid ${subtleBorder}`, background: '#fff', minWidth: 0, width: '100%' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, overflow: 'hidden', background: 'rgba(58,55,51,0.06)', flexShrink: 0 }}>
                          {result.artworkUrl ? <img src={result.artworkUrl} alt={result.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title}</p>
                          <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.author}{result.genre ? ` · ${result.genre}` : ''} · Apple Podcasts</p>
                        </div>
                        {result.externalUrl ? (
                          <button type="button" onClick={() => onOpenExternal(result.externalUrl)} style={smallButtonStyle}>Open in Apple Podcasts</button>
                        ) : null}
                        <button type="button" onClick={() => onAddItem(result.id)} style={smallButtonStyle}>{addingCandidateId === result.id ? '...' : 'Add'}</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'grid', gap: 6, paddingTop: 6, gridTemplateColumns: '1fr', minWidth: 0 }}>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectItem(item.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 16,
                        border: selectedId === item.id ? '1px solid rgba(58,55,51,0.12)' : '1px solid transparent',
                        background: selectedId === item.id ? 'rgba(58,55,51,0.06)' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                      <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.author}{item.source === 'netease' ? ' · Netease (Open Original)' : ' · Apple Podcasts'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            <div style={{ ...detailPaneStyle, background: paper, overflowY: 'auto' }}>
              {selected ? (
                <>
                  <div
                    style={{
                      position: 'sticky', top: 0, zIndex: 1, background: paper,
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
                            <span style={{ ...inter(9, 700, '#3D7A4E'), letterSpacing: '0.12em', textTransform: 'uppercase' }}>Now Playing</span>
                          </div>
                        ) : null}
                        <h3 style={{ ...playfair(24, 500), marginBottom: 4 }}>{selected.name}</h3>
                        <p style={{ ...inter(13, 400, mutedText), marginBottom: 10 }}>{selected.author}</p>
                        <p style={{ ...inter(10, 500, 'rgba(58,55,51,0.42)'), marginBottom: 10 }}>{selectedSourceLabel}</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => onTogglePlaying(selected.id)} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            {selected.isPlaying && !isNeteaseDefaultMode ? <Pause size={11} /> : <Play size={11} />}
                            <span>{isNeteaseDefaultMode ? 'Open Original' : selected.isPlaying ? 'Pause' : 'Play'}</span>
                          </button>
                          {selected.source === 'itunes' ? (
                            <button type="button" onClick={() => onOpenExternal(selected.externalUrl ?? `https://podcasts.apple.com/podcast/id${selected.collectionId}`)} style={smallButtonStyle}>View on Apple Podcasts</button>
                          ) : null}
                          {selected.source === 'netease' ? (
                            <button type="button" onClick={() => onOpenExternal(selected.externalUrl ?? `https://music.163.com/djradio?id=${encodeURIComponent(selected.sourceId)}`)} style={smallButtonStyle}>Open Channel</button>
                          ) : null}
                          {selected.source === 'netease' ? (
                            <button type="button" onClick={() => onRefreshItem(selected.id)} style={smallButtonStyle}>
                              {refreshingPodcastId === selected.id ? '...' : 'Refresh'}
                            </button>
                          ) : null}
                          <button type="button" onClick={() => onRemoveItem(selected.id)} style={{ ...smallButtonStyle, color: '#9D4C4C' }}>Remove</button>
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
                  <div style={{ padding: '16px 20px 20px', display: 'grid', gap: 16 }}>
                    <div>
                      {selected.source === 'itunes' ? (
                        <p style={{ ...inter(10, 400, mutedText), marginBottom: 10 }}>Metadata courtesy of Apple Podcasts</p>
                      ) : null}
                      <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>Episodes</p>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {selected.episodes.map((episode) => (
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
                              <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.releaseDate ?? 'No date'}{episode.duration ? ` · ${episode.duration}` : ''}</p>
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {selected.source === 'itunes' && episode.externalUrl ? (
                                <button type="button" onClick={() => onOpenExternal(episode.externalUrl)} style={smallButtonStyle}>Open in Apple Podcasts</button>
                              ) : null}
                              {selected.selectedEpisodeId === episode.id ? <Play size={12} color={ink} /> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedEpisode?.description ? (
                      <Field label="Description">
                        <textarea readOnly value={selectedEpisode.description} style={textareaStyle} />
                      </Field>
                    ) : null}
                  </div>
                </>
              ) : (
                <div style={{ padding: 20, ...inter(13, 400, mutedText) }}>Search and add a podcast to start.</div>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
