import { ChevronRight, Headphones, Pause, Play, Search, X } from 'lucide-react'
import { useMemo } from 'react'
import Dialog from '../../../shared/ui/Dialog'
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
  onRefreshItem,
  onRemoveItem,
}: Props) => {
  const selectedEpisode = useMemo(
    () => selected?.episodes.find((episode) => episode.id === selected.selectedEpisodeId) ?? selected?.episodes[0] ?? null,
    [selected],
  )

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

        <div style={{ padding: '16px 20px', flex: 1 }}>
          {loading ? (
            <LifeCardLoader />
          ) : model.nowPlaying ? (
            <>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
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
                  }}
                >
                  {model.nowPlaying.coverEmoji}
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
                style={{ ...smallButtonStyle, marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                {model.nowPlaying.isPlaying ? <Pause size={11} /> : <Play size={11} />}
                <span>{model.nowPlaying.isPlaying ? 'Pause' : 'Open Player'}</span>
              </button>

              <div style={{ marginTop: 14, borderTop: `1px solid ${sectionBorder}`, paddingTop: 14 }}>
                <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>Recent Episodes</p>
                {model.recentEpisodes.map((episode, index) => (
                  <div key={episode.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                      <span style={{ fontSize: 12 }}>{episode.coverEmoji}</span>
                      <p style={{ ...inter(12, 400, 'rgba(58,55,51,0.65)'), flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.title}</p>
                      <span style={{ ...inter(10, 400, 'rgba(58,55,51,0.30)') }}>{episode.duration}</span>
                    </div>
                    {index < model.recentEpisodes.length - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.05)' }} /> : null}
                  </div>
                ))}
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
            <span>Open Player</span>
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
            <aside style={sidebarStyle}>
              <div style={{ display: 'grid', gap: 10 }}>
                <Field label="Search">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search podcast or paste a Netease link" style={inputStyle} />
                    <button type="button" onClick={onSearch} style={smallButtonStyle}>{searching ? '...' : 'Go'}</button>
                  </div>
                </Field>
                <Field label="Netease channel">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={channelUrl} onChange={(event) => onChannelUrlChange(event.target.value)} placeholder="https://music.163.com/djradio?id=..." style={inputStyle} />
                    <button type="button" onClick={() => onImportChannel(channelUrl)} style={smallButtonStyle}>
                      {addingCandidateId?.startsWith('channel:') ? '...' : 'Import'}
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
                  <div style={{ display: 'grid', gap: 8 }}>
                    {results.map((result) => (
                      <div key={result.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 12, borderRadius: 16, border: `1px solid ${subtleBorder}`, background: '#fff' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, overflow: 'hidden', background: 'rgba(58,55,51,0.06)', flexShrink: 0 }}>
                          {result.artworkUrl ? <img src={result.artworkUrl} alt={result.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ ...inter(12, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.title}</p>
                          <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.author}{result.genre ? ` · ${result.genre}` : ''}</p>
                        </div>
                        <button type="button" onClick={() => onAddItem(result.id)} style={smallButtonStyle}>{addingCandidateId === result.id ? '...' : 'Add'}</button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div style={{ display: 'grid', gap: 6, paddingTop: 6 }}>
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
                        {item.author}{item.source === 'netease' ? ' · Netease' : ' · iTunes'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>
            <div style={{ ...detailPaneStyle, background: paper, padding: 20, overflowY: 'auto' }}>
              {selected ? (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 88, height: 88, borderRadius: 24, overflow: 'hidden', background: selected.coverColor ?? 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, flexShrink: 0 }}>
                      {selected.artworkUrl ? <img src={selected.artworkUrl} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selected.coverEmoji ?? '🎙'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ ...playfair(24, 500), marginBottom: 6 }}>{selected.name}</h3>
                      <p style={{ ...inter(13, 400, mutedText), marginBottom: 10 }}>{selected.author}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => onTogglePlaying(selected.id)} style={{ ...smallButtonStyle, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          {selected.isPlaying ? <Pause size={11} /> : <Play size={11} />}
                          <span>{selected.isPlaying ? 'Pause' : 'Play'}</span>
                        </button>
                        {selected.source === 'netease' ? (
                          <button type="button" onClick={() => onRefreshItem(selected.id)} style={smallButtonStyle}>
                            {refreshingPodcastId === selected.id ? '...' : 'Refresh'}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onRemoveItem(selected.id)} style={{ ...smallButtonStyle, color: '#9D4C4C' }}>Remove</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: `1px solid ${sectionBorder}`, paddingTop: 16 }}>
                    <p style={{ ...inter(10, 600, 'rgba(58,55,51,0.35)'), letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 10 }}>Episodes</p>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {selected.episodes.map((episode) => (
                        <button
                          key={episode.id}
                          type="button"
                          onClick={() => onSelectEpisode(selected.id, episode.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            padding: '12px 14px',
                            borderRadius: 16,
                            border: selected.selectedEpisodeId === episode.id ? '1px solid rgba(58,55,51,0.12)' : `1px solid ${subtleBorder}`,
                            background: selected.selectedEpisodeId === episode.id ? 'rgba(58,55,51,0.06)' : '#fff',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ ...inter(12, 500), marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.title}</p>
                            <p style={{ ...inter(10, 400, mutedText), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{episode.releaseDate ?? 'No date'}{episode.duration ? ` · ${episode.duration}` : ''}</p>
                          </div>
                          {selected.selectedEpisodeId === episode.id ? <Play size={12} color={ink} /> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedEpisode?.description ? (
                    <Field label="Description">
                      <textarea readOnly value={selectedEpisode.description} style={textareaStyle} />
                    </Field>
                  ) : null}
                </div>
              ) : (
                <div style={{ ...inter(13, 400, mutedText) }}>Search and add a podcast to start.</div>
              )}
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
