import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { LampDesk, RotateCcw, Shapes } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import { tasksRepo } from '../../../data/repositories/tasksRepo'
import { SYNC_DATA_UPDATED_EVENT } from '../../../data/sync/constants'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useThemeMode } from '../../../shared/theme/useThemeMode'
import { useThreeSurface } from '../../../shared/three/useThreeSurface'
import { readTokenRgb } from '../../../shared/three/tokens'
import type { SurfaceModule } from '../../../shared/three/surface'
import type { ThemeMode } from '../../../shared/theme/theme'
import { subscribeTasksChanged } from '../../tasks/taskSync'
import DeskPicker from './DeskPicker'
import LampLight from './LampLight'
import { createLampLightStore } from './lampLightStore'
import { DESK_LAYOUT, DESK_LINE_INSET, DESK_UNIT_MAX, DESK_UNIT_MIN, LAMP_X, findFreeSpot, onDesk, type DeskSpan } from './deskLayout'
import { DEFAULT_POSE, type LampPose } from './lampKinematics'
import { newItemId, readDeskSettings, writeDeskSettings, type DeskSettings } from './deskState'
import type { DeskColors, DeskItem, DeskParams, DeskPropId } from './deskTypes'
import { defaultPicture, fitPicture, isPicture, parsePicture, type PictureSettings } from './pictureTypes'
import { PictureSelection } from './PictureEditor'
import './desk.css'

const loadDesk = async (): Promise<SurfaceModule<DeskParams>> => {
  const [scene, assets] = await Promise.all([import('./three/deskScene'), import('./three/sourceModels')])
  await assets.prepareSourceModels()
  return scene
}

/** Header-local layout px; `origin` is where the masthead's middle (world x = 0) falls on the desk. */
type Placement = { left: number; width: number; height: number; unit: number; origin: number }

/** Room left of and right of the desk, so it never crowds the date, the quote or the toolbar. */
const CLEARANCE = 20
/** The hover controls' size (desk.css). */
const CONTROL_SIZE = 24

/**
 * The desk is the whole gap in the masthead between the date and the quote
 * (and, on the rule, between the view tabs and the layout actions), standing
 * on the toolbar rule. Null when it's too narrow for the lamp and a prop.
 */
const measurePlacement = (header: HTMLElement): Placement | null => {
  const box = header.getBoundingClientRect()
  const zoom = box.width / Math.max(1, header.offsetWidth)
  const local = (selector: string) => {
    const el = header.querySelector(selector)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { left: (r.left - box.left) / zoom, right: (r.right - box.left) / zoom, bottom: (r.bottom - box.top) / zoom }
  }
  const day = local('.dash-hero__day')
  const toolbar = local('.dash-toolbar')
  if (!day || !toolbar) return null
  const quote = local('.dash-hero__quote')
  const views = local('.dash-toolbar__views')
  const actions = local('.dash-toolbar__actions')
  // The desk line is the middle of the toolbar's 1px rule.
  const height = Math.round(toolbar.bottom - 0.5 + DESK_LINE_INSET)
  const from = Math.max(day.right, views?.right ?? toolbar.left) + CLEARANCE
  const to = Math.min(quote?.left ?? toolbar.right, actions?.left ?? toolbar.right) - CLEARANCE
  const unit = Math.round(Math.min(DESK_UNIT_MAX, height / DESK_LAYOUT.height) * 100) / 100
  if (!(unit >= DESK_UNIT_MIN) || to - from < DESK_LAYOUT.minWidth * unit) return null
  const left = Math.round(from)
  return { left, width: Math.round(to - from), height, unit, origin: Math.round(header.offsetWidth / 2) - left }
}

const samePlacement = (a: Placement | null, b: Placement | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.width === b.width && a.height === b.height && a.unit === b.unit && a.origin === b.origin)

/** The stretch a prop may stand on, in world units (as the scene sees it). */
const spanOf = (placement: Placement): DeskSpan => ({
  left: -placement.origin / placement.unit + 0.05,
  right: (placement.width - placement.origin) / placement.unit - 0.05,
})

const useDeskPlacement = (headerRef: RefObject<HTMLElement | null>) => {
  const [placement, setPlacement] = useState<Placement | null>(null)
  useEffect(() => {
    const header = headerRef.current
    if (!header || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const update = () => {
      raf = 0
      const next = window.matchMedia?.('(max-width: 960px)').matches ? null : measurePlacement(header)
      setPlacement((prev) => (samePlacement(prev, next) ? prev : next))
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(header)
    for (const selector of ['.dash-hero__day', '.dash-hero__quote', '.dash-toolbar__views', '.dash-toolbar__actions']) {
      const el = header.querySelector(selector)
      if (el) observer.observe(el)
    }
    window.addEventListener('resize', schedule)
    void document.fonts?.ready.then(schedule)
    schedule()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [headerRef])
  return placement
}

const readDeskColors = (theme: ThemeMode): DeskColors => {
  const dark = theme === 'dark'
  return {
    paper: readTokenRgb('--paper-raised', dark ? '#2d2b27' : '#ffffff'),
    ink: readTokenRgb('--ink-1', dark ? '#f2f0ec' : '#3a3733'),
    ink3: readTokenRgb('--ink-3', dark ? '#a39c91' : '#77726b'),
    ink4: readTokenRgb('--ink-4', dark ? '#6f6a62' : '#a8a298'),
    pencil: readTokenRgb('--pencil-line', dark ? '#8a847a' : '#948e84'),
    pen: readTokenRgb('--accent', dark ? '#7edbc7' : '#1b4f4a'),
    dark,
  }
}

/** Token colours, re-read whenever the theme, an ambient environment or a theme pack preview changes them. */
const useDeskColors = (theme: ThemeMode) => {
  const [colors, setColors] = useState(() => readDeskColors(theme))
  useEffect(() => {
    const refresh = () => {
      const next = readDeskColors(theme)
      setColors((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }
    refresh()
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-ambient-scene', 'data-theme-pack-preview', 'style', 'class'],
    })
    return () => observer.disconnect()
  }, [theme])
  return colors
}

/** The title of the task in progress (the latest one touched), for the sticky note. */
const useTaskInProgress = (enabled: boolean) => {
  const [title, setTitle] = useState('')
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = async () => {
      const tasks = await tasksRepo.list()
      const doing = tasks.filter((task) => task.status === 'doing').sort((a, b) => b.updatedAt - a.updatedAt)
      if (!cancelled) setTitle(doing[0]?.title.trim() ?? '')
    }
    void load()
    const unsubscribe = subscribeTasksChanged(() => void load())
    const onSync = () => void load()
    window.addEventListener(SYNC_DATA_UPDATED_EVENT, onSync)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener(SYNC_DATA_UPDATED_EVENT, onSync)
    }
  }, [enabled])
  return title
}

const isDefaultLamp = ({ pose, lampX }: DeskSettings) =>
  Math.abs(lampX - LAMP_X) < 0.01 &&
  Math.abs(pose.a1 - DEFAULT_POSE.a1) + Math.abs(pose.a2 - DEFAULT_POSE.a2) + Math.abs(pose.a3 - DEFAULT_POSE.a3) < 0.01

const withTimer = (item: DeskItem, endsAt: number | null): DeskItem => {
  const next = { ...item }
  if (endsAt) next.endsAt = endsAt
  else delete next.endsAt
  return next
}

/**
 * The desk in the masthead: a lamp and as many props as the user likes,
 * standing anywhere along the toolbar rule and dragged where they're wanted.
 * The lamp switches the page into a darker focus light; it slides along the
 * desk, its hinges bend and the light follows the shade. All of it is a
 * per-device setting.
 */
const DeskProps = ({ headerRef }: { headerRef: RefObject<HTMLElement | null> }) => {
  const placement = useDeskPlacement(headerRef)
  if (!placement) return null
  return <DeskStage placement={placement} />
}

const deviceSettings = { read: readDeskSettings, write: writeDeskSettings }
/** The preview fixture uses an isolated settings store with this same production stage. */
export const DeskStage = ({ placement, storage = deviceSettings }: { placement: Placement; storage?: typeof deviceSettings }) => {
  const { t } = useI18n()
  const theme = useThemeMode()
  const colors = useDeskColors(theme)
  const [settings, setSettings] = useState<DeskSettings>(storage.read)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedPicture, setSelectedPicture] = useState<string | null>(null)
  const [pictureStatuses, setPictureStatuses] = useState<Record<string, 'loading' | 'ready' | 'error'>>({})
  const onPictureStatus = useCallback((id: string, status: 'loading' | 'ready' | 'error') => setPictureStatuses(prev => prev[id] === status ? prev : { ...prev, [id]: status }), [])
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const store = useMemo(() => createLampLightStore(), [])
  const noteTitle = useTaskInProgress(settings.note)

  // A per-device setting: each change is written straight through.
  const update = useCallback((patch: (prev: DeskSettings) => Partial<DeskSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch(prev) }
      storage.write(next)
      return next
    })
  }, [storage])
  const toggleLamp = useCallback(() => update((prev) => ({ lampOn: !prev.lampOn })), [update])
  const onPose = useCallback((pose: LampPose) => update(() => ({ pose })), [update])
  const onLampMove = useCallback((lampX: number) => update(() => ({ lampX: Math.round(lampX * 100) / 100 })), [update])
  const resetLamp = useCallback(() => update(() => ({ pose: { ...DEFAULT_POSE }, lampX: LAMP_X })), [update])
  // A prop put down comes to the front.
  const onItemMove = useCallback((id: string, x: number) => update((prev) => {
    const item = prev.items.find((candidate) => candidate.id === id)
    return item ? { items: [...prev.items.filter((candidate) => candidate !== item), { ...item, x: Math.round(x * 100) / 100 }] } : {}
  }), [update])
  const onItemRemove = useCallback((id: string) => update((prev) => ({ items: prev.items.filter((item) => item.id !== id) })), [update])
  const onItemTimer = useCallback((id: string, endsAt: number | null) => update((prev) => ({
    items: prev.items.map((item) => (item.id === id ? withTimer(item, endsAt) : item)),
  })), [update])
  const span = useMemo(() => spanOf(placement), [placement])
  const onItemPicture = useCallback((id: string, patch: Partial<PictureSettings>, x?: number) => update(prev => ({
    items: prev.items.map(item => item.id === id && isPicture(item.kind)
      ? { ...item, x: x ?? item.x, picture: parsePicture(item.kind, { ...parsePicture(item.kind, item.picture), ...patch }) }
      : item),
  })), [update])
  const addItem = useCallback((kind: DeskPropId) => {
    const id = newItemId()
    update(prev => ({
      items: [...prev.items, { id, kind, x: kind === 'window' ? -1.2 : findFreeSpot(kind, prev.items.filter(item => !isPicture(item.kind)), prev.lampX, span), ...(isPicture(kind) ? { picture: defaultPicture(kind) } : {}) }],
    }))
    if (isPicture(kind)) { setSelectedPicture(id); setPickerOpen(false) }
  }, [update, span])
  const clearItems = useCallback(() => update(() => ({ items: [] })), [update])
  const setNote = useCallback((note: boolean) => update(() => ({ note })), [update])
  const [highlight, setHighlight] = useState<string | null>(null)
  const onPickerOpen = useCallback((open: boolean) => {
    setPickerOpen(open)
    if (!open) setHighlight(null)
  }, [])

  const note = useMemo(() => (settings.note ? { text: noteTitle } : null), [settings.note, noteTitle])
  const params = useMemo<DeskParams>(() => ({
    colors,
    unit: placement.unit,
    origin: placement.origin,
    lampOn: settings.lampOn,
    lampX: settings.lampX,
    pose: settings.pose,
    items: settings.items,
    note,
    highlight,
    onToggleLamp: toggleLamp,
    onPose,
    onLampMove,
    onItemMove,
    onItemRemove,
    onItemTimer,
    onItemPicture,
    onSelectPicture: setSelectedPicture,
    onPictureStatus,
    onBeam: store.set,
  }), [colors, placement.unit, placement.origin, settings, note, highlight, toggleLamp, onPose, onLampMove, onItemMove, onItemRemove, onItemTimer, onItemPicture, onPictureStatus, store])

  const status = useThreeSurface(canvasRef, loadDesk, params)
  const lampLabel = settings.lampOn ? t('dashboard.desk.lampOff') : t('dashboard.desk.lampOn')
  const selected = settings.items.find(item => item.id === selectedPicture)
  const selectedKind = selected && isPicture(selected.kind) ? selected.kind : null
  const storedPicture = selectedKind ? parsePicture(selectedKind, selected?.picture) : null
  const shownPicture = storedPicture ? fitPicture(storedPicture, span, (placement.height - DESK_LINE_INSET) / placement.unit, selectedKind ?? 'window') : null

  return (
    <div
      className="dash-desk"
      data-status={status}
      style={{ left: placement.left, width: placement.width, height: placement.height }}
    >
      <canvas ref={canvasRef} className="dash-desk__canvas" aria-hidden="true" />
      {selected && selectedKind && storedPicture && shownPicture && status === 'ready' ? <PictureSelection
        key={selected.id}
        kind={selectedKind} picture={shownPicture} stored={storedPicture} unit={placement.unit}
        x={onDesk(selected.x, shownPicture.width * 0.53, span)}
        left={placement.origin + (onDesk(selected.x, shownPicture.width * 0.53, span) - shownPicture.width / 2) * placement.unit}
        top={placement.height - DESK_LINE_INSET - (shownPicture.y + shownPicture.height) * placement.unit}
        status={pictureStatuses[selected.id]}
        onChange={(patch, x) => onItemPicture(selected.id, patch, x)}
        onRemove={() => onItemRemove(selected.id)}
        onClose={() => setSelectedPicture(null)}
        onDuplicate={() => {
          const id = newItemId()
          update(prev => ({ items: [...prev.items, { ...selected, id, x: onDesk(selected.x + 0.4, shownPicture.width * 0.53, span) }] }))
          setSelectedPicture(id)
        }}
      /> : null}
      {status === 'ready' ? (
        <div className="dash-desk__controls" role="group" aria-label={t('dashboard.desk.label')} data-open={pickerOpen ? 'true' : 'false'}>
          <button type="button" className="dash-desk__control" aria-pressed={settings.lampOn} aria-label={lampLabel} title={lampLabel} onClick={toggleLamp}>
            <LampDesk size={14} aria-hidden="true" />
          </button>
          <Popover open={pickerOpen} onOpenChange={onPickerOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="dash-desk__control" aria-label={t('dashboard.desk.pick')} title={t('dashboard.desk.pick')}>
                <Shapes size={14} aria-hidden="true" />
              </button>
            </PopoverTrigger>
            {/* Below the desk, so what's added can be seen dropping in. */}
            <PopoverContent align="start" sideOffset={placement.height - CONTROL_SIZE + 8} className="desk-picker__panel">
              <DeskPicker
                items={settings.items}
                note={settings.note}
                onAdd={addItem}
                onRemove={onItemRemove}
                onClear={clearItems}
                onNote={setNote}
                onHighlight={setHighlight}
              />
            </PopoverContent>
          </Popover>
          {isDefaultLamp(settings) ? null : (
            <button type="button" className="dash-desk__control" aria-label={t('dashboard.desk.resetLamp')} title={t('dashboard.desk.resetLamp')} onClick={resetLamp}>
              <RotateCcw size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : null}
      <LampLight store={store} source={canvasRef} dark={theme === 'dark'} />
    </div>
  )
}

export default DeskProps
