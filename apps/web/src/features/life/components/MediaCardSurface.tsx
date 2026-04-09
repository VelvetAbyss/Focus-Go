import { useEffect, useRef } from 'react'
import { Check, ChevronRight, Circle, Film, Play, Plus, Search, Star, Tv, X } from 'lucide-react'
import Dialog from '../../../shared/ui/Dialog'
import { AppNumber } from '../../../shared/ui/AppNumber'
import type { MediaItem } from '../../../data/models/types'
import type { MediaPresentationModel } from '../cards/lifeDesignAdapters'
import ProgressTrack from '../ProgressTrack'
import { detailPaneStyle, iconButtonStyle, inputStyle, inter, modalHeaderStyle, modalLayoutStyle, mutedText, playfair, sectionBorder, sidebarStyle, smallButtonStyle, subtleBorder, textareaStyle } from './lifeDesignPrimitives'

type SearchMedia = {
  id: string
  title: string
  releaseDate?: string
  mediaType: 'movie' | 'tv'
  posterUrl?: string
}

type Props = {
  model: MediaPresentationModel
  items: MediaItem[]
  selected: MediaItem | null
  selectedId: string | null
  open: boolean
  loading: boolean
  query: string
  searching: boolean
  hint: string | null
  results: SearchMedia[]
  addingCandidateId: string | null
  onOpen: () => void
  onClose: () => void
  onQueryChange: (value: string) => void
  onSearch: () => void
  onDismissSearch: () => void
  onSelectItem: (id: string) => void
  onAddItem: (id: string) => void
  onPatchItem: (patch: Partial<MediaItem>) => void
  onRemoveItem: (id: string) => void
}

const statusTone = {
  'want-to-watch': { label: 'Want to Watch', color: '#9C9288', bg: 'rgba(255,255,255,0.76)', border: 'rgba(58,55,51,0.10)' },
  watching: { label: 'Watching', color: '#9C9288', bg: 'rgba(255,255,255,0.76)', border: 'rgba(58,55,51,0.10)' },
  completed: { label: 'Finished', color: '#5A7A62', bg: 'rgba(90,122,98,0.12)', border: 'rgba(90,122,98,0.16)' },
} as const

const mediaTypeLabel = (value: MediaItem['mediaType']) => (value === 'tv' ? 'TV' : 'MOVIE')
const yearLabel = (value?: string) => value?.slice(0, 4) ?? 'TBA'
const formatStatusCount = (items: MediaItem[], status: MediaItem['status']) => items.filter((item) => item.status === status).length
const statusDot = (status: MediaItem['status']) => (status === 'completed' ? '#7E9A84' : status === 'watching' ? '#9587BE' : '#9B948C')
const itemTypeLine = (item: MediaItem) => `${yearLabel(item.releaseDate)} · ${item.genres[0] ?? (item.mediaType === 'tv' ? 'Series' : 'Movie')}`
const itemMetaLine = (item: MediaItem) =>
  [item.director ? `Dir. ${item.director}` : item.creator ? `Dir. ${item.creator}` : null, yearLabel(item.releaseDate), item.duration].filter(Boolean).join(' · ')
const ratingLine = (item: MediaItem) => [item.rating ? `${item.rating} / 10` : null, item.country, item.language].filter(Boolean).join(' ')
const noteValue = (item: MediaItem) => item.reflection ?? ''
const synopsisValue = (item: MediaItem) => item.overview ?? ''
const titleCountLabel = (count: number) => `${count} title${count === 1 ? '' : 's'}`
const chipStyle = (active: boolean) => ({
  ...inter(11, active ? 600 : 400, active ? '#3A3733' : 'rgba(58,55,51,0.40)'),
  borderRadius: 999,
  padding: '6px 10px',
  background: active ? 'rgba(58,55,51,0.08)' : 'transparent',
})

export const MediaCardSurface = ({
  model,
  items,
  selected,
  selectedId,
  open,
  loading,
  query,
  searching,
  hint,
  results,
  addingCandidateId,
  onOpen,
  onClose,
  onQueryChange,
  onSearch,
  onDismissSearch,
  onSelectItem,
  onAddItem,
  onPatchItem,
  onRemoveItem: _onRemoveItem,
}: Props) => {
  const searchAreaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open || results.length === 0) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (searchAreaRef.current?.contains(target)) return
      onDismissSearch()
    }
    const handleVisibility = () => {
      if (document.hidden) onDismissSearch()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [open, results.length, onDismissSearch])

  return (
    <>
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: model.previewRows.length === 0 ? 280 : 0,
        overflow: 'hidden',
        borderRadius: 24,
        cursor: 'pointer',
        background: '#ffffff',
        border: '1px solid transparent',
        boxShadow: '0 12px 28px rgba(58, 55, 51, 0.08)',
      }}
      onClick={onOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid rgba(58,55,51,0.07)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Film size={14} color="rgba(58,55,51,0.40)" />
            <span style={{ ...inter(10, 600, 'rgba(58,55,51,0.40)'), letterSpacing: '0.10em', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>
          </div>
          <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{model.header.title}</h3>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'rgba(58,55,51,0.40)' }}>
          <ChevronRight size={15} />
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px' }}>
        {model.previewRows.length === 0 ? (
          <div style={{ display: 'flex', minHeight: 172, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, marginBottom: 16, borderRadius: 999, background: 'rgba(58,55,51,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Film size={20} color="rgba(58,55,51,0.35)" />
            </div>
            <p style={{ ...playfair(14, 500), marginBottom: 6 }}>Your watchlist is empty</p>
            <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.5 }}>Search for movies or TV shows to start your collection.</p>
          </div>
        ) : (
          <div>
            {model.previewRows.map((item, index) => (
              <div key={item.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ width: 34, height: 46, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'rgba(58,55,51,0.08)', boxShadow: '2px 2px 8px rgba(58,55,51,0.15), inset -1px 0 0 rgba(0,0,0,0.08)' }}>
                    {item.posterUrl ? <img src={item.posterUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    <div style={{ position: 'absolute', left: 2, bottom: 2, width: 14, height: 10, borderRadius: 2, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.type === 'tv' ? <Tv size={7} color="white" /> : <Film size={7} color="white" />}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...playfair(13, 500), marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                    <p style={{ ...inter(11, 400, 'rgba(58,55,51,0.50)'), marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.metaLine}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 2, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.10)' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 999, background: item.statusColor }} />
                      </div>
                    </div>
                  </div>
                </div>
                {index < model.previewRows.length - 1 ? <div style={{ height: 1, background: 'rgba(58,55,51,0.06)' }} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {model.previewRows.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', marginTop: 'auto', borderTop: `1px solid ${sectionBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: '#7A6A9E' }} />
            <span style={{ ...inter(11, 500, mutedText) }}>Watching</span>
            <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={model.stats.watchingNow} animated /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: '#5A7A62' }} />
            <span style={{ ...inter(11, 500, mutedText) }}>Finished</span>
            <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={model.stats.completed} animated /></span>
          </div>
        </div>
      ) : null}
    </div>

    <Dialog
      open={open}
      onClose={onClose}
      panelClassName="life-modal__panel"
      contentClassName="life-modal__content"
      panelStyle={{ width: 'min(1100px, calc(100vw - 40px))', maxHeight: 'min(740px, calc(100vh - 32px))', borderRadius: 28, background: '#F5F3F0' }}
    >
      <div style={modalLayoutStyle}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Film size={15} color="rgba(58,55,51,0.62)" />
            <h2 style={playfair(26, 500)}>{model.header.title}</h2>
            <span style={{ ...inter(11, 500, 'rgba(58,55,51,0.44)'), padding: '4px 10px', borderRadius: 999, background: 'rgba(58,55,51,0.06)' }}>
              {titleCountLabel(items.length)}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconButtonStyle}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', minHeight: 0, flex: 1, borderTop: `1px solid ${sectionBorder}` }}>
          <aside style={{ ...sidebarStyle, width: 314, padding: 18 }}>
            <div ref={searchAreaRef}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="rgba(58,55,51,0.30)" style={{ position: 'absolute', left: 15, top: 16 }} />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearch()
                }}
                placeholder="Movie, series, director..."
                style={{ ...inputStyle, height: 38, padding: '0 14px 0 36px', borderRadius: 15, background: 'rgba(58,55,51,0.035)' }}
              />
              {searching ? (
                <span style={{ ...inter(11, 500, 'rgba(58,55,51,0.34)'), position: 'absolute', right: 14, top: 13 }}>
                  Searching...
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <span style={chipStyle(true)}>All {items.length}</span>
              <span style={chipStyle(false)}>Watching {formatStatusCount(items, 'watching')}</span>
              <span style={chipStyle(false)}>Finished {formatStatusCount(items, 'completed')}</span>
              <span style={chipStyle(false)}>Queued {formatStatusCount(items, 'want-to-watch')}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
              <span style={inter(11, 400, 'rgba(58,55,51,0.34)')}>Movies {items.filter((item) => item.mediaType === 'movie').length}</span>
              <span style={inter(11, 400, 'rgba(58,55,51,0.34)')}>TV {items.filter((item) => item.mediaType === 'tv').length}</span>
            </div>
            {hint ? <p style={{ ...inter(12, 400, mutedText), marginTop: 12 }}>{hint}</p> : null}
            {results.length > 0 ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 14, marginBottom: 12 }}>
                {results.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onAddItem(item.id)}
                    disabled={Boolean(addingCandidateId)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, textAlign: 'left', border: `1px solid ${subtleBorder}`, background: '#FDFAF7' }}
                  >
                    <div style={{ width: 28, height: 38, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(58,55,51,0.08)' }}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...playfair(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                      <p style={{ ...inter(11, 400, mutedText) }}>{item.mediaType === 'movie' ? 'Movie' : 'TV'}{item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ''}</p>
                    </div>
                    <span style={{ ...smallButtonStyle, padding: '6px 10px' }}>{addingCandidateId === item.id ? '...' : <Plus size={11} />}</span>
                  </button>
                ))}
              </div>
            ) : null}
            </div>
            {loading ? <p style={inter(12, 400, mutedText)}>Loading…</p> : null}
            {!loading && items.length === 0 ? <p style={inter(12, 400, mutedText)}>No media yet.</p> : null}
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'flex-start',
                    gap: 12,
                    borderRadius: 16,
                    padding: '12px 12px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: `1px solid ${selectedId === item.id ? 'rgba(58,55,51,0.12)' : 'transparent'}`,
                    background: selectedId === item.id ? 'rgba(255,255,255,0.54)' : 'transparent',
                  }}
                >
                  <div style={{ width: 38, height: 54, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'rgba(58,55,51,0.08)' }}>
                    {item.posterUrl ? <img src={item.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ ...playfair(13, 500), flex: 1, minWidth: 0, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                      <span style={{ width: 6, height: 6, marginLeft: 'auto', flexShrink: 0, borderRadius: 999, background: statusDot(item.status) }} />
                    </div>
                    <p style={{ ...inter(11, 400, mutedText) }}>{itemTypeLine(item)}</p>
                    <div style={{ marginTop: 10, height: 2, borderRadius: 999, overflow: 'hidden', background: 'rgba(58,55,51,0.08)' }}>
                      <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 999, background: item.status === 'watching' ? '#8E81B8' : '#6D8B74' }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div style={detailPaneStyle}>
            {selected ? (
              <div style={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column', overflowY: 'auto' }}>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    gap: 32,
                    padding: '34px 40px 30px',
                    borderBottom: `1px solid ${sectionBorder}`,
                    background: 'radial-gradient(circle at 18% 14%, rgba(198,177,135,0.20), transparent 24%), radial-gradient(circle at 64% 12%, rgba(255,255,255,0.84), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.16))',
                  }}
                >
                  <div style={{ width: 112, height: 158, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'rgba(58,55,51,0.08)', boxShadow: '0 14px 28px rgba(58,55,51,0.14)' }}>
                    {selected.posterUrl ? <img src={selected.posterUrl} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: 'rgba(255,255,255,0.66)', border: '1px solid rgba(58,55,51,0.08)' }}>
                        <Film size={10} color="rgba(58,55,51,0.44)" />
                        <span style={inter(10, 600, 'rgba(58,55,51,0.52)')}>{mediaTypeLabel(selected.mediaType)}</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: statusTone[selected.status].bg, border: `1px solid ${statusTone[selected.status].border}` }}>
                        <span style={inter(10, 700, statusTone[selected.status].color)}>{statusTone[selected.status].label.toUpperCase()}</span>
                      </div>
                    </div>
                    <h3 style={{ ...playfair(28, 500), lineHeight: 1.08 }}>{selected.title}</h3>
                    <p style={{ ...inter(14, 400, 'rgba(58,55,51,0.58)'), marginTop: 6 }}>{itemMetaLine(selected)}</p>
                    {ratingLine(selected) ? (
                      <p style={{ ...inter(13, 500, 'rgba(58,55,51,0.42)'), marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {selected.rating ? <Star size={12} color="#D39B37" fill="#D39B37" /> : null}
                        {selected.rating ? <span style={{ color: '#D39B37', fontWeight: 600 }}>{selected.rating} / 10</span> : null}
                        {[selected.country, selected.language].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {selected.genres.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                        {selected.genres.slice(0, 3).map((genre) => (
                          <span key={genre} style={{ ...inter(11, 400, 'rgba(58,55,51,0.42)'), padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.48)', border: '1px solid rgba(58,55,51,0.08)' }}>
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 0 }}>
                  <div style={{ display: 'grid', gap: 22, padding: '24px 40px 20px', borderBottom: `1px solid ${sectionBorder}` }}>
                    <div>
                      <div style={{ ...inter(12, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Status</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {([
                          ['want-to-watch', Circle, 'Want to Watch'],
                          ['watching', Play, 'Watching'],
                          ['completed', Check, 'Finished'],
                        ] as const).map(([value, Icon, label]) => {
                          const active = selected.status === value
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => onPatchItem({ status: value })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                borderRadius: 999,
                                border: `1px solid ${active ? 'rgba(90,122,98,0.20)' : 'rgba(58,55,51,0.10)'}`,
                                background: active ? 'rgba(90,122,98,0.10)' : 'rgba(255,255,255,0.54)',
                                padding: '8px 14px',
                                color: active ? '#5A7A62' : 'rgba(58,55,51,0.46)',
                              }}
                            >
                              <Icon size={12} />
                              <span style={inter(12, active ? 600 : 500, active ? '#5A7A62' : 'rgba(58,55,51,0.48)')}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...inter(12, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Progress</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                        <span style={inter(14, 700, '#3A3733')}>{selected.progress}%</span>
                      </div>
                      <ProgressTrack
                        value={selected.progress}
                        onChange={(progress) => onPatchItem({ progress })}
                        label="Progress"
                        showLabel={false}
                        color="#6F8F77"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={inter(11, 400, 'rgba(58,55,51,0.26)')}>0%</span>
                        <span style={inter(11, 400, 'rgba(58,55,51,0.26)')}>50%</span>
                        <span style={inter(11, 400, 'rgba(58,55,51,0.26)')}>100%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '28px 40px 30px', borderBottom: `1px solid ${sectionBorder}` }}>
                    <div style={{ ...inter(12, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>My Notes</div>
                    <textarea
                      value={noteValue(selected)}
                      onChange={(event) => onPatchItem({ reflection: event.target.value })}
                      placeholder="Write a personal note..."
                      style={{ ...textareaStyle, minHeight: 118, padding: '18px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.44)', fontFamily: '"Playfair Display", serif', fontSize: 18, lineHeight: 1.55, fontStyle: 'italic', color: '#3A3733' }}
                    />
                  </div>

                  <div style={{ padding: '24px 40px 36px' }}>
                    <div style={{ ...inter(12, 600, 'rgba(58,55,51,0.38)'), letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Synopsis</div>
                    <textarea
                      value={synopsisValue(selected)}
                      onChange={(event) => onPatchItem({ overview: event.target.value })}
                      placeholder="Synopsis"
                      style={{ ...textareaStyle, minHeight: 120, padding: 0, border: 'none', background: 'transparent', borderRadius: 0, resize: 'none', ...inter(15, 400, 'rgba(58,55,51,0.62)'), lineHeight: 1.8 }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <p style={inter(13, 400, mutedText)}>Select a title to inspect details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
    </>
  )
}
