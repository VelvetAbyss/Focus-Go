import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { BookOpen, Coffee, CupSoda, LampDesk, Laptop, RotateCcw } from 'lucide-react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useThemeMode } from '../../../shared/theme/useThemeMode'
import { useThreeSurface } from '../../../shared/three/useThreeSurface'
import { readTokenRgb } from '../../../shared/three/tokens'
import type { SurfaceModule } from '../../../shared/three/surface'
import type { ThemeMode } from '../../../shared/theme/theme'
import LampLight from './LampLight'
import { createLampLightStore } from './lampLightStore'
import { DESK_LAYOUT, DESK_LINE_INSET, DESK_UNIT_MAX, DESK_UNIT_MIN } from './deskLayout'
import { DEFAULT_POSE, type LampPose } from './lampKinematics'
import { readDeskSettings, writeDeskSettings, type DeskSettings } from './deskState'
import type { DeskColors, DeskParams } from './deskTypes'
import './desk.css'

const loadDesk = () => import('./three/deskScene') as Promise<SurfaceModule<DeskParams>>

type Placement = { left: number; width: number; height: number; unit: number }

/** Room left of and right of the desk, so it never crowds the date, the quote or the toolbar. */
const CLEARANCE = 20

/**
 * Finds the gap in the masthead between the date and the quote (and, on the
 * rule, between the view tabs and the layout actions) and fits the desk in it,
 * standing on the toolbar rule. Header-local layout px; null when it won't fit.
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
  const room = DESK_LAYOUT.width + 0.4
  const unit = Math.min(DESK_UNIT_MAX, height / DESK_LAYOUT.height, (to - from) / room)
  if (!(unit >= DESK_UNIT_MIN)) return null
  const width = Math.round(room * unit)
  // Centred on the header (over the middle column of cards) when there's room.
  const left = Math.round(Math.min(Math.max(header.offsetWidth / 2 - width / 2, from), to - width))
  return { left, width, height, unit: Math.round(unit * 100) / 100 }
}

const samePlacement = (a: Placement | null, b: Placement | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.width === b.width && a.height === b.height && a.unit === b.unit)

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

const isDefaultPose = (pose: LampPose) =>
  Math.abs(pose.a1 - DEFAULT_POSE.a1) + Math.abs(pose.a2 - DEFAULT_POSE.a2) + Math.abs(pose.a3 - DEFAULT_POSE.a3) < 0.01

/**
 * The desk in the masthead: a lamp, an open book (or a laptop) and a coffee
 * (or an iced cola), standing on the toolbar rule. The lamp switches the page
 * into a darker focus light; its hinges can be dragged and the light follows
 * the shade. All of it is a per-device setting.
 */
const DeskProps = ({ headerRef }: { headerRef: RefObject<HTMLElement | null> }) => {
  const placement = useDeskPlacement(headerRef)
  if (!placement) return null
  return <DeskStage placement={placement} />
}

const DeskStage = ({ placement }: { placement: Placement }) => {
  const { t } = useI18n()
  const theme = useThemeMode()
  const colors = useDeskColors(theme)
  const [settings, setSettings] = useState<DeskSettings>(readDeskSettings)
  const [turn, setTurn] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const store = useMemo(() => createLampLightStore(), [])

  // A per-device setting: each change is written straight through.
  const update = useCallback((patch: (prev: DeskSettings) => Partial<DeskSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch(prev) }
      writeDeskSettings(next)
      return next
    })
  }, [])
  const toggleLamp = useCallback(() => update((prev) => ({ lampOn: !prev.lampOn })), [update])
  const swapDrink = useCallback(() => update((prev) => ({ drink: prev.drink === 'coffee' ? 'cola' : 'coffee' })), [update])
  const swapItem = useCallback(() => update((prev) => ({ item: prev.item === 'book' ? 'laptop' : 'book' })), [update])
  const onPose = useCallback((pose: LampPose) => update(() => ({ pose })), [update])
  const resetLamp = useCallback(() => update(() => ({ pose: { ...DEFAULT_POSE } })), [update])

  const params = useMemo<DeskParams>(() => ({
    colors,
    unit: placement.unit,
    lampOn: settings.lampOn,
    item: settings.item,
    drink: settings.drink,
    pose: settings.pose,
    turn,
    onToggleLamp: toggleLamp,
    onSwapDrink: swapDrink,
    onPose,
    onBeam: store.set,
  }), [colors, placement.unit, settings, turn, toggleLamp, swapDrink, onPose, store])

  const status = useThreeSurface(canvasRef, loadDesk, params)

  const lampLabel = settings.lampOn ? t('dashboard.desk.lampOff') : t('dashboard.desk.lampOn')
  const itemLabel = settings.item === 'book' ? t('dashboard.desk.useLaptop') : t('dashboard.desk.useBook')
  const drinkLabel = settings.drink === 'coffee' ? t('dashboard.desk.useCola') : t('dashboard.desk.useCoffee')
  const turnLabel = settings.item === 'book' ? t('dashboard.desk.turnPage') : t('dashboard.desk.toggleLid')

  return (
    <div
      className="dash-desk"
      data-status={status}
      style={{ left: placement.left, width: placement.width, height: placement.height }}
    >
      <canvas ref={canvasRef} className="dash-desk__canvas" aria-hidden="true" />
      {status === 'ready' ? (
        <div className="dash-desk__controls" role="group" aria-label={t('dashboard.desk.label')}>
          <button type="button" className="dash-desk__control" aria-pressed={settings.lampOn} aria-label={lampLabel} title={lampLabel} onClick={toggleLamp}>
            <LampDesk size={14} aria-hidden="true" />
          </button>
          <button type="button" className="dash-desk__control" aria-label={itemLabel} title={itemLabel} onClick={swapItem}>
            {settings.item === 'book' ? <Laptop size={14} aria-hidden="true" /> : <BookOpen size={14} aria-hidden="true" />}
          </button>
          <button type="button" className="dash-desk__control" aria-label={drinkLabel} title={drinkLabel} onClick={swapDrink}>
            {settings.drink === 'coffee' ? <CupSoda size={14} aria-hidden="true" /> : <Coffee size={14} aria-hidden="true" />}
          </button>
          <button type="button" className="dash-desk__control dash-desk__control--keyboard" aria-label={turnLabel} onClick={() => setTurn((n) => n + 1)}>
            <BookOpen size={14} aria-hidden="true" />
          </button>
          {isDefaultPose(settings.pose) ? null : (
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
