import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Copy, ImagePlus, LockKeyhole, Maximize2, Settings2, Trash2, UnlockKeyhole, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import { useI18n } from '../../../shared/i18n/useI18n'
import { PICTURE_PRESETS } from './pictureCatalog'
import { importPictureMedia, listPictureMedia } from './pictureMedia'
import { bounded, type PictureKind, type PictureSettings } from './pictureTypes'

type EditorProps = {
  kind: PictureKind
  picture: PictureSettings
  onChange: (patch: Partial<PictureSettings>) => void
  locked: boolean
  onLock: () => void
}
const PictureEditor = ({ kind, picture, onChange, locked, onLock }: EditorProps) => {
  const { t, language } = useI18n()
  const [tab, setTab] = useState<'presets' | 'mine'>('presets')
  const [media, setMedia] = useState<{ id: string; name: string; url: string }[]>([])
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let alive = true
    const urls: string[] = []
    void listPictureMedia().then(images => {
      if (!alive) return
      setMedia(images.map(image => {
        const url = URL.createObjectURL(image.blob); urls.push(url)
        return { id: 'local:' + image.id, name: image.name, url }
      }))
    }).catch(() => { if (alive) setError(true) })
    return () => { alive = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [revision])
  const select = (source: string) => onChange({ source, panX: 0.5, panY: 0.5, zoom: 1 })
  const chosen = PICTURE_PRESETS.find(p => p.id === picture.source)
  const choices = PICTURE_PRESETS.filter(p => p.kind === kind)
  return (
    <div className="desk-picture-editor">
      <div className="desk-picture-editor__heading">
        <strong>{t(kind === 'window' ? 'dashboard.desk.picture.windowTitle' : 'dashboard.desk.picture.frameTitle')}</strong>
        <span>{t('dashboard.desk.picture.local')}</span>
      </div>
      <div className="desk-picture-editor__tabs" role="tablist" aria-label={t('dashboard.desk.picture.library')}>
        {(['presets', 'mine'] as const).map(value => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{t(value === 'presets' ? 'dashboard.desk.picture.presets' : 'dashboard.desk.picture.mine')}</button>)}
      </div>
      <div className="desk-picture-editor__gallery" role="tabpanel">
        {tab === 'presets' ? choices.map(p => <button type="button" key={p.id} aria-pressed={picture.source === p.id} onClick={() => select(p.id)} title={p.author}>
          <img src={p.url} alt="" loading="lazy" /><span>{language === 'zh' ? p.zh : p.en}</span>
        </button>) : <>
          <button type="button" className="desk-picture-editor__upload" onClick={() => fileRef.current?.click()} disabled={busy}><ImagePlus size={23} /><span>{t(busy ? 'dashboard.desk.picture.importing' : 'dashboard.desk.picture.upload')}</span></button>
          {media.map(p => <button type="button" key={p.id} aria-pressed={picture.source === p.id} onClick={() => select(p.id)}><img src={p.url} alt="" loading="lazy" /><span>{p.name}</span></button>)}
        </>}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label={t('dashboard.desk.picture.upload')} hidden onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''
        if (!file) return
        setBusy(true); setError(false)
        try {
          const image = await importPictureMedia(file)
          select('local:' + image.id); setRevision(v => v + 1)
        } catch { setError(true) } finally { setBusy(false) }
      }} />
      {error ? <p className="desk-picture-editor__error" role="alert">{t('dashboard.desk.picture.uploadError')}</p> : null}
      {chosen ? <a className="desk-picture-editor__credit" href={chosen.source} target="_blank" rel="noreferrer">{chosen.author} · {chosen.license} ↗</a> : <p className="desk-picture-editor__credit">{t('dashboard.desk.picture.private')}</p>}
      <div className="desk-picture-editor__adjust">
        <label>{t('dashboard.desk.picture.width')}<input type="range" min={kind === 'window' ? 1.6 : 0.7} max={8} step={0.05} value={picture.width} onChange={event => {
          const width = Number(event.target.value)
          onChange({ width, ...(locked ? { height: picture.height * width / picture.width } : {}) })
        }} /></label>
        <label>{t('dashboard.desk.picture.height')}<input type="range" min={0.7} max={4} step={0.05} value={picture.height} onChange={event => {
          const height = Number(event.target.value)
          onChange({ height, ...(locked ? { width: picture.width * height / picture.height } : {}) })
        }} /></label>
        <button type="button" className="desk-picture-editor__lock" aria-pressed={locked} onClick={onLock}>{locked ? <LockKeyhole size={13} /> : <UnlockKeyhole size={13} />}{t('dashboard.desk.picture.lock')}</button>
      </div>
      <div className="desk-picture-editor__fit">
        {(['cover', 'contain'] as const).map(fit => <button type="button" key={fit} aria-pressed={picture.fit === fit} onClick={() => onChange({ fit, zoom: 1, panX: 0.5, panY: 0.5 })}>{t(fit === 'cover' ? 'dashboard.desk.picture.cover' : 'dashboard.desk.picture.contain')}</button>)}
        <button type="button" onClick={() => onChange({ zoom: 1, panX: 0.5, panY: 0.5 })}>{t('dashboard.desk.picture.resetCrop')}</button>
      </div>
      <div className="desk-picture-editor__adjust">
        <label>{t('dashboard.desk.picture.zoom')}<input type="range" min="1" max="3" step="0.02" value={picture.zoom} onChange={e => onChange({ zoom: Number(e.target.value) })} /></label>
        <label>{t('dashboard.desk.picture.panX')}<input type="range" min="0" max="1" step="0.01" value={picture.panX} onChange={e => onChange({ panX: Number(e.target.value) })} /></label>
        <label>{t('dashboard.desk.picture.panY')}<input type="range" min="0" max="1" step="0.01" value={picture.panY} onChange={e => onChange({ panY: Number(e.target.value) })} /></label>
      </div>
    </div>
  )
}

type Props = {
  kind: PictureKind; picture: PictureSettings; stored: PictureSettings; x: number; left: number; top: number; unit: number
  status?: 'loading' | 'ready' | 'error'
  onChange: (patch: Partial<PictureSettings>, x?: number) => void; onRemove: () => void; onDuplicate: () => void; onClose: () => void
}
export const PictureSelection = ({ kind, picture, stored, x, left, top, unit, status, onChange, onRemove, onDuplicate, onClose }: Props) => {
  const { t } = useI18n()
  const [locked, setLocked] = useState(true)
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ x: number; y: number; worldX: number; width: number; height: number; unit: number; id: number } | null>(null)
  const onDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const rect = event.currentTarget.parentElement!.getBoundingClientRect()
    drag.current = { x: event.clientX, y: event.clientY, worldX: x, width: picture.width, height: picture.height, unit: rect.width / picture.width, id: event.pointerId }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  return <div className="desk-picture-selection" data-kind={kind} style={{ left, top, width: picture.width * unit, height: picture.height * unit }} onKeyDown={e => { if (e.key === 'Escape' && !editing) { e.stopPropagation(); onClose() } }}>
    <button type="button" className="desk-picture-selection__resize" aria-label={t('dashboard.desk.picture.resize')} title={t('dashboard.desk.picture.resize')} onPointerDown={onDown} onPointerMove={event => {
      const start = drag.current
      if (!start || start.id !== event.pointerId) return
      const dx = (event.clientX - start.x) / start.unit, dy = (start.y - event.clientY) / start.unit
      let width = bounded(start.width + dx, start.width, kind === 'window' ? 1.6 : 0.7, 8)
      let height = bounded(start.height + dy, start.height, 0.7, 4)
      if (locked) {
        const scale = Math.abs(dx / start.width) > Math.abs(dy / start.height) ? width / start.width : height / start.height
        width = start.width * scale; height = start.height * scale
      }
      onChange({ width, height }, start.worldX + (width - start.width) / 2)
    }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => {
      if (drag.current) onChange({ width: drag.current.width, height: drag.current.height }, drag.current.worldX)
      drag.current = null
    }} onKeyDown={event => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
      event.preventDefault()
      const scale = event.key === 'ArrowUp' ? 1.05 : 0.95
      onChange({ width: stored.width * scale, height: stored.height * scale })
    }}><Maximize2 size={11} /></button>
    <div className="desk-picture-selection__toolbar">
      {kind === 'window' ? <button type="button" onClick={() => onChange({ open: !stored.open })}>{t(stored.open ? 'dashboard.desk.picture.closeWindow' : 'dashboard.desk.picture.openWindow')}</button> : null}
      <Popover open={editing} onOpenChange={setEditing}>
        <PopoverTrigger asChild><button type="button" aria-label={t('dashboard.desk.picture.edit')} title={t('dashboard.desk.picture.edit')}><Settings2 size={13} /><span>{t('dashboard.desk.picture.edit')}</span></button></PopoverTrigger>
        <PopoverContent side="bottom" align="center" sideOffset={9} collisionPadding={12} className="desk-picture-editor__panel" onOpenAutoFocus={e => e.preventDefault()} onEscapeKeyDown={e => { e.preventDefault(); e.stopPropagation(); setEditing(false) }}>
          <PictureEditor kind={kind} picture={stored} onChange={onChange} locked={locked} onLock={() => setLocked(v => !v)} />
        </PopoverContent>
      </Popover>
      <button type="button" aria-label={t('dashboard.desk.picture.duplicate')} title={t('dashboard.desk.picture.duplicate')} onClick={onDuplicate}><Copy size={13} /></button>
      <button type="button" aria-label={t('dashboard.desk.picture.remove')} title={t('dashboard.desk.picture.remove')} onClick={onRemove}><Trash2 size={13} /></button>
      <button type="button" aria-label={t('dashboard.desk.picture.done')} title={t('dashboard.desk.picture.done')} onClick={onClose}><X size={13} /></button>
    </div>
    {status && status !== 'ready' ? <span className="desk-picture-selection__status" role="status">{t(status === 'loading' ? 'dashboard.desk.picture.loading' : 'dashboard.desk.picture.loadError')}</span> : null}
  </div>
}
