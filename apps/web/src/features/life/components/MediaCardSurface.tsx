import { useEffect, useRef } from 'react'
import { Check, ChevronRight, Circle, Film, Play, Plus, Search, Star, Trash2, Tv, X } from 'lucide-react'
import Dialog from '../../../shared/ui/Dialog'
import ImeTextarea from '../../../shared/ui/ImeTextarea'
import { AppNumber } from '../../../shared/ui/AppNumber'
import type { MediaItem } from '../../../data/models/types'
import type { MediaPresentationModel } from '../cards/lifeDesignAdapters'
import ProgressTrack from '../ProgressTrack'
import { detailPaneStyle, iconButtonStyle, inputStyle, inter, LifeCardLoader, LifePanelLoader, modalHeaderStyle, modalLayoutStyle, mutedText, playfair, sectionBorder, sidebarStyle, smallButtonStyle, subtleBorder, textareaStyle } from './lifeDesignPrimitives'
import { useLifeI18n, type LifeTranslate } from '../lifeI18n'

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
  quickMediaType: MediaItem['mediaType']
  results: SearchMedia[]
  addingCandidateId: string | null
  onOpen: () => void
  onClose: () => void
  onQueryChange: (value: string) => void
  onSearch: () => void
  onQuickAdd: () => void
  onQuickMediaTypeChange: (value: MediaItem['mediaType']) => void
  onDismissSearch: () => void
  onSelectItem: (id: string) => void
  onAddItem: (id: string) => void
  onPatchItem: (patch: Partial<MediaItem>) => void
  onRemoveItem: (id: string) => void
}

const statusTone = {
  'want-to-watch': { label: 'Want to Watch', color: 'var(--ink-3)', bg: 'color-mix(in srgb, var(--bg-elevated) 76%, transparent)', border: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' },
  watching: { label: 'Watching', color: 'var(--ink-3)', bg: 'color-mix(in srgb, var(--bg-elevated) 76%, transparent)', border: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' },
  completed: { label: 'Finished', color: 'var(--tone-done)', bg: 'var(--tone-done-wash)', border: 'color-mix(in srgb, var(--tone-done) 16%, transparent)' },
} as const

const mediaTypeLabel = (value: MediaItem['mediaType'], t: LifeTranslate) =>
  (value === 'tv' ? t('life.media.typeTv') : t('life.media.typeMovie')).toUpperCase()
const yearLabel = (value?: string) => value?.slice(0, 4) ?? 'TBA'
const formatStatusCount = (items: MediaItem[], status: MediaItem['status']) => items.filter((item) => item.status === status).length
const statusDot = (status: MediaItem['status']) => (status === 'completed' ? 'var(--tone-done)' : status === 'watching' ? 'var(--tone-warn)' : 'var(--ink-4)')
const itemTypeLine = (item: MediaItem, t: LifeTranslate) =>
  `${yearLabel(item.releaseDate)} · ${item.genres[0] ?? (item.mediaType === 'tv' ? t('life.media.typeSeries') : t('life.media.typeMovie'))}`
const itemMetaLine = (item: MediaItem) =>
  [item.director ? `Dir. ${item.director}` : item.creator ? `Dir. ${item.creator}` : null, yearLabel(item.releaseDate), item.duration].filter(Boolean).join(' · ')
const ratingLine = (item: MediaItem) => [item.rating ? `${item.rating} / 10` : null, item.country, item.language].filter(Boolean).join(' ')
const noteValue = (item: MediaItem) => item.reflection ?? ''
const synopsisValue = (item: MediaItem) => item.overview ?? ''
const titleCountLabel = (count: number) => `${count} title${count === 1 ? '' : 's'}`
const chipStyle = (active: boolean) => ({
  ...inter(11, active ? 600 : 400, active ? 'var(--text-primary)' : 'var(--text-tertiary)'),
  borderRadius: 999,
  padding: '6px 10px',
  background: active ? 'color-mix(in srgb, var(--text-primary) 8%, transparent)' : 'transparent',
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
  quickMediaType,
  results,
  addingCandidateId,
  onOpen,
  onClose,
  onQueryChange,
  onSearch,
  onQuickAdd,
  onQuickMediaTypeChange,
  onDismissSearch,
  onSelectItem,
  onAddItem,
  onPatchItem,
  onRemoveItem,
}: Props) => {
  const { t } = useLifeI18n()
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
        background: 'var(--bg-elevated)',
        border: '1px solid transparent',
        boxShadow: 'var(--shadow-card)',
      }}
      onClick={onOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid color-mix(in srgb, var(--text-primary) 7%, transparent)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Film size={14} color="color-mix(in srgb, var(--text-primary) 40%, transparent)" />
            <span style={{ ...inter(10, 600, 'var(--text-tertiary)'), letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase' }}>{model.header.eyebrow}</span>
          </div>
          <h3 style={{ ...playfair(18, 500), lineHeight: 1.2 }}>{model.header.title}</h3>
        </div>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, color: 'var(--text-tertiary)' }}>
          <ChevronRight size={15} />
        </div>
      </div>

      <div className="life-card-empty-host" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '0 20px' }}>
        {loading ? (
          <LifeCardLoader />
        ) : model.previewRows.length === 0 ? (
          <div className="life-card-empty" style={{ display: 'flex', height: '100%', minHeight: 0, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '12px 16px', textAlign: 'left' }}>
            <p style={{ ...playfair(18, 600), marginBottom: 6 }}>{t('life.media.emptyTitle')}</p>
            <p style={{ ...inter(12, 400, mutedText), lineHeight: 1.5 }}>{t('life.media.emptyDescription')}</p>
          </div>
        ) : (
          <div className="life-card-preview">
            {model.previewRows.map((item, index) => (
              <div key={item.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ width: 34, height: 46, borderRadius: 4, overflow: 'hidden', flexShrink: 0, position: 'relative', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', boxShadow: '2px 2px 8px rgba(0, 0, 0, 0.15), inset -1px 0 0 rgba(0,0,0,0.08)' }}>
                    {item.posterUrl ? <img src={item.posterUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    <div style={{ position: 'absolute', left: 2, bottom: 2, width: 14, height: 10, borderRadius: 2, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.type === 'tv' ? <Tv size={7} color="white" /> : <Film size={7} color="white" />}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...playfair(13, 500), marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                    <p style={{ ...inter(11, 400, 'var(--text-tertiary)'), marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.metaLine}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 2, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 999, background: item.statusColor }} />
                      </div>
                    </div>
                  </div>
                </div>
                {index < model.previewRows.length - 1 ? <div style={{ height: 1, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }} /> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <form
        className="life-quick-add life-quick-add--media"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onQuickAdd()
        }}
      >
        <div className="life-quick-add__media-types" role="group" aria-label={t('life.media.typeAria')}>
          {([
            ['movie', Film, t('life.media.typeMovie')],
            ['tv', Tv, t('life.media.typeTv')],
          ] as const).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              className={`life-quick-add__type${quickMediaType === value ? ' is-active' : ''}`}
              onClick={() => onQuickMediaTypeChange(value)}
            >
              <Icon size={11} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="life-quick-add__bar">
          <span className="life-quick-add__label">{t('life.library.add')}</span>
          <input
            className="life-quick-add__input"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t('life.media.searchPlaceholder')}
          />
          <button type="submit" className="life-quick-add__action">
            {searching ? '...' : t('life.library.add')}
          </button>
        </div>
        {!open && hint ? <p className="life-quick-add__hint">{hint}</p> : null}
      </form>

      {!loading && model.previewRows.length > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px', marginTop: 'auto', borderTop: `1px solid ${sectionBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--tone-warn)' }} />
            <span style={{ ...inter(11, 500, mutedText) }}>{t('life.media.watching')}</span>
            <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={model.stats.watchingNow} animated /></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--tone-done)' }} />
            <span style={{ ...inter(11, 500, mutedText) }}>{t('life.media.finished')}</span>
            <span style={{ ...inter(12, 600), marginLeft: 2 }}><AppNumber value={model.stats.completed} animated /></span>
          </div>
        </div>
      ) : null}
    </div>

    {open ? <Dialog
      open={open}
      onClose={onClose}
      panelClassName="life-modal__panel"
      contentClassName="life-modal__content"
      panelStyle={{ width: 'min(1100px, calc(100vw - 40px))', maxHeight: 'min(740px, calc(100vh - 32px))', borderRadius: 28, background: 'var(--bg-elevated)' }}
    >
      <div style={modalLayoutStyle}>
        <div style={modalHeaderStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Film size={15} color="color-mix(in srgb, var(--text-primary) 62%, transparent)" />
            <h2 style={playfair(26, 500)}>{model.header.title}</h2>
            <span style={{ ...inter(11, 500, 'var(--text-tertiary)'), padding: '4px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--text-primary) 6%, transparent)' }}>
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
              <Search size={14} color="color-mix(in srgb, var(--text-primary) 30%, transparent)" style={{ position: 'absolute', left: 15, top: 16 }} />
              <input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onSearch()
                }}
                placeholder={t('life.media.searchPlaceholder')}
                style={{ ...inputStyle, height: 38, padding: '0 14px 0 36px', borderRadius: 15, background: 'color-mix(in srgb, var(--text-primary) 3.5%, transparent)' }}
              />
              {searching ? (
                <span style={{ ...inter(11, 500, 'var(--text-tertiary)'), position: 'absolute', right: 14, top: 13 }}>
                  Searching...
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <span style={chipStyle(true)}>{t('life.media.all', { count: items.length })}</span>
              <span style={chipStyle(false)}>{t('life.media.watching')} {formatStatusCount(items, 'watching')}</span>
              <span style={chipStyle(false)}>{t('life.media.finished')} {formatStatusCount(items, 'completed')}</span>
              <span style={chipStyle(false)}>{t('life.media.queued')} {formatStatusCount(items, 'want-to-watch')}</span>
            </div>
            <div style={{ display: 'flex', gap: 18, marginTop: 10 }}>
              <span style={inter(11, 400, 'var(--text-tertiary)')}>{t('life.media.movies', { count: items.filter((item) => item.mediaType === 'movie').length })}</span>
              <span style={inter(11, 400, 'var(--text-tertiary)')}>{t('life.media.tv', { count: items.filter((item) => item.mediaType === 'tv').length })}</span>
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
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, textAlign: 'left', border: `1px solid ${subtleBorder}`, background: 'var(--bg-elevated)' }}
                  >
                    <div style={{ width: 28, height: 38, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...playfair(13, 500), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                      <p style={{ ...inter(11, 400, mutedText) }}>{item.mediaType === 'movie' ? t('life.media.typeMovie') : t('life.media.typeTv')}{item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ''}</p>
                    </div>
                    <span style={{ ...smallButtonStyle, padding: '6px 10px' }}>{addingCandidateId === item.id ? '...' : <Plus size={11} />}</span>
                  </button>
                ))}
              </div>
            ) : null}
            </div>
            {loading ? <LifePanelLoader /> : null}
            {!loading && items.length === 0 ? <p style={inter(12, 400, mutedText)}>{t('life.media.noMedia')}</p> : null}
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              {!loading && items.map((item) => (
                <div key={item.id} className="life-sidebar-item">
                  <button
                    type="button"
                    onClick={() => onSelectItem(item.id)}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'flex-start',
                      gap: 12,
                      borderRadius: 16,
                      padding: '12px 12px 10px',
                      paddingRight: 36,
                      textAlign: 'left',
                      cursor: 'pointer',
                      border: `1px solid ${selectedId === item.id ? 'color-mix(in srgb, var(--text-primary) 12%, transparent)' : 'transparent'}`,
                      background: selectedId === item.id ? 'color-mix(in srgb, var(--bg-elevated) 54%, transparent)' : 'transparent',
                    }}
                  >
                    <div style={{ width: 38, height: 54, borderRadius: 4, overflow: 'hidden', flexShrink: 0, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                      {item.posterUrl ? <img src={item.posterUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{ ...playfair(13, 500), flex: 1, minWidth: 0, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</p>
                        <span style={{ width: 6, height: 6, marginLeft: 'auto', flexShrink: 0, borderRadius: 999, background: statusDot(item.status) }} />
                      </div>
                      <p style={{ ...inter(11, 400, mutedText) }}>{itemTypeLine(item, t)}</p>
                      <div style={{ marginTop: 10, height: 2, borderRadius: 999, overflow: 'hidden', background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 999, background: item.status === 'watching' ? 'var(--tone-warn)' : 'var(--tone-done)' }} />
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="life-sidebar-item__delete"
                    title="Remove"
                    onClick={(event) => { event.stopPropagation(); onRemoveItem(item.id) }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
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
                    gap: 24,
                    padding: '24px 40px 20px',
                    borderBottom: `1px solid ${sectionBorder}`,
                    background: 'transparent',
                  }}
                >
                  <div style={{ width: 88, height: 124, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'color-mix(in srgb, var(--text-primary) 8%, transparent)', boxShadow: '0 10px 20px rgba(0, 0, 0, 0.12)' }}>
                    {selected.posterUrl ? <img src={selected.posterUrl} alt={selected.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: 'color-mix(in srgb, var(--bg-elevated) 66%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                        <Film size={10} color="color-mix(in srgb, var(--text-primary) 44%, transparent)" />
                        <span style={inter(10, 600, 'var(--text-tertiary)')}>{mediaTypeLabel(selected.mediaType, t)}</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, padding: '4px 9px', background: statusTone[selected.status].bg, border: `1px solid ${statusTone[selected.status].border}` }}>
                        <span style={inter(10, 700, statusTone[selected.status].color)}>{statusTone[selected.status].label.toUpperCase()}</span>
                      </div>
                    </div>
                    <h3 style={{ ...playfair(22, 500), lineHeight: 1.15, marginTop: 6 }}>{selected.title}</h3>
                    <p style={{ ...inter(13, 400, 'var(--text-tertiary)'), marginTop: 4 }}>{itemMetaLine(selected)}</p>
                    {ratingLine(selected) ? (
                      <p style={{ ...inter(12, 500, 'var(--text-tertiary)'), marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {selected.rating ? <Star size={12} color="var(--tone-warn)" fill="var(--tone-warn)" /> : null}
                        {selected.rating ? <span style={{ color: 'var(--tone-warn)', fontWeight: 600 }}>{selected.rating} / 10</span> : null}
                        {[selected.country, selected.language].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                    {selected.genres.length ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                        {selected.genres.slice(0, 3).map((genre) => (
                          <span key={genre} style={{ ...inter(10, 400, 'var(--text-tertiary)'), padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--bg-elevated) 48%, transparent)', border: '1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)' }}>
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 0 }}>
                  <div style={{ display: 'grid', gap: 16, padding: '20px 40px 16px', borderBottom: `1px solid ${sectionBorder}` }}>
                    <div>
                      <div style={{ ...inter(11, 500, 'var(--text-tertiary)'), letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{t('life.media.status')}</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {([
                          ['want-to-watch', Circle, t('life.media.wantToWatch')],
                          ['watching', Play, t('life.media.watching')],
                          ['completed', Check, t('life.media.finished')],
                        ] as [MediaItem['status'], typeof Circle, string][]).map(([value, Icon, label]) => {
                          const active = selected.status === value
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => onPatchItem({ status: value })}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                borderRadius: 999,
                                border: `1px solid ${active ? 'color-mix(in srgb, var(--tone-done) 20%, transparent)' : 'color-mix(in srgb, var(--text-primary) 8%, transparent)'}`,
                                background: active ? 'var(--tone-done-wash)' : 'transparent',
                                padding: '6px 12px',
                                color: active ? 'var(--tone-done)' : 'var(--text-tertiary)',
                                cursor: 'pointer',
                              }}
                            >
                              <Icon size={11} />
                              <span style={inter(11, active ? 500 : 400, active ? 'var(--tone-done)' : 'var(--text-tertiary)')}>{label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ ...inter(11, 500, 'var(--text-tertiary)'), letterSpacing: '0.07em', textTransform: 'uppercase' }}>{t('life.media.progress')}</div>
                        <span style={inter(12, 600, 'var(--text-primary)')}>{selected.progress}%</span>
                      </div>
                      <ProgressTrack
                        value={selected.progress}
                        onChange={(progress) => onPatchItem({ progress })}
                        label="Progress"
                        showLabel={false}
                        color="var(--tone-done)"
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={inter(10, 400, 'var(--text-tertiary)')}>0%</span>
                        <span style={inter(10, 400, 'var(--text-tertiary)')}>50%</span>
                        <span style={inter(10, 400, 'var(--text-tertiary)')}>100%</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '20px 40px', borderBottom: `1px solid ${sectionBorder}` }}>
                    <div style={{ ...inter(11, 500, 'var(--text-tertiary)'), letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>{t('life.media.myNotes')}</div>
                    <ImeTextarea
                      value={noteValue(selected)}
                      onChange={(val) => onPatchItem({ reflection: val })}
                      placeholder="Write a personal note..."
                      style={{ ...textareaStyle, minHeight: 80, padding: '14px 16px', borderRadius: 10, background: 'color-mix(in srgb, var(--text-primary) 2.5%, transparent)', fontFamily: 'var(--font-display)', fontSize: 'var(--fs-ui)', lineHeight: 1.75, fontStyle: 'italic', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div style={{ padding: '20px 40px 28px' }}>
                    <div style={{ ...inter(11, 500, 'var(--text-tertiary)'), letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{t('life.media.synopsis')}</div>
                    <textarea
                      value={synopsisValue(selected)}
                      onChange={(event) => onPatchItem({ overview: event.target.value })}
                      placeholder="Synopsis"
                      style={{ ...textareaStyle, minHeight: 100, padding: 0, border: 'none', background: 'transparent', borderRadius: 0, resize: 'none', ...inter(13, 400, 'color-mix(in srgb, var(--text-primary) 62%, transparent)'), lineHeight: 1.8 }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                <p style={inter(13, 400, mutedText)}>{t('life.media.selectTitle')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog> : null}
  </>
)
}
