import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import { useThemeMode } from '../../../shared/theme/useThemeMode'
import { useThreeSurface } from '../../../shared/three/useThreeSurface'
import type { SurfaceModule } from '../../../shared/three/surface'
import type { JarShelf, JarWeek } from '../domain/completionJar'
import { packJarWithin } from '../jar/beadPacking'
import { JAR_OUTER, JAR_TILT, layoutJars, type JarSlot } from '../jar/jarLayout'
import type { JarSceneColors, JarSceneParams } from '../jar/jarTypes'
import './CompletionJar.css'

type CompletionJarProps = {
  renderMode?: 'three' | 'sketch'
  shelf: JarShelf
  /** True when the week on show is the current one (its jar is still open). */
  isCurrentWeek: boolean
  onOpenWeek: (startAt: number) => void
}

/** Below this the jar area stops shrinking and the card scrolls instead. */
const MIN_HEIGHT = 92
// A completion only drops in if it happened moments ago on this screen; one
// synced from another device, or made while the page was hidden, just appears.
const FRESH_MS = 10_000
const SEEN_WEEK_KEY = 'focusgo.recap.jarSeenWeek'

const loadScene = () => import('../jar/jarScene') as Promise<SurfaceModule<JarSceneParams>>

const readColors = (dark: boolean): JarSceneColors => {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  return {
    // Ink jade: a touch deeper than text ink in the light theme; pale pearls in the dark one.
    bead: dark ? '#d6cfc2' : '#211f1d',
    pencil: token('--pencil', dark ? '#9d968a' : '#6f6a63'),
    paper: token('--paper-raised', dark ? '#2d2b27' : '#ffffff'),
    plank: token('--paper-sunken', dark ? '#211f1c' : '#f0ede7'),
    lid: dark ? '#5a544c' : '#ebe5da',
    twine: dark ? '#8c7c63' : '#b39c79',
  }
}

const readSeenWeek = () => {
  try {
    return window.localStorage.getItem(SEEN_WEEK_KEY)
  } catch {
    return null
  }
}

const writeSeenWeek = (key: string) => {
  try {
    window.localStorage.setItem(SEEN_WEEK_KEY, key)
  } catch {
    // private mode: the seal just replays next time
  }
}

const rangeLabel = (week: JarWeek, language: string) => {
  const format = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric' })
  return `${format.format(week.startAt)}–${format.format(week.endAt - 1)}`
}

/** A flat drawing of the same jars, for when WebGL can't start. */
const JarSketch = ({ slots, weeks, width, height }: { slots: JarSlot[]; weeks: JarWeek[]; width: number; height: number }) => {
  const cos = Math.cos(JAR_TILT)
  const sin = Math.sin(JAR_TILT)
  return (
    <svg className="recap-jar__sketch" width={width} height={height} aria-hidden="true">
      <line x1={2} x2={width - 2} y1={height - 9} y2={height - 9} className="recap-jar__sketch-plank" />
      {slots.map((slot, index) => {
        const week = weeks[index]
        const { beads, radius } = packJarWithin(week.key, week.beads.map((bead) => bead.taskId), slot.maxPile)
        const top = beads.reduce((max, bead) => Math.max(max, bead.position[1] + radius), 0)
        const body = (slot.sealed ? Math.max(0.55, top + 0.05) : Math.max(1.1, top + 0.5)) * slot.scale * cos
        const r = JAR_OUTER * slot.scale
        const base = height - slot.baseY
        return (
          <g key={week.key}>
            <path
              className="recap-jar__sketch-glass"
              d={`M ${slot.x - r} ${base - body} V ${base - 3} Q ${slot.x - r} ${base} ${slot.x - r + 3} ${base} H ${slot.x + r - 3} Q ${slot.x + r} ${base} ${slot.x + r} ${base - 3} V ${base - body}`}
            />
            {beads.map((bead, i) => (
              <circle
                key={i}
                className="recap-jar__sketch-bead"
                cx={slot.x + bead.position[0] * slot.scale}
                cy={base - (bead.position[1] * cos + bead.position[2] * sin) * slot.scale}
                r={radius * slot.scale}
              />
            ))}
            {slot.sealed ? <rect className="recap-jar__sketch-lid" x={slot.x - r * 0.9} y={base - body - 4} width={r * 1.8} height={4} rx={1} /> : null}
          </g>
        )
      })}
    </svg>
  )
}

/** The WebGL surface only mounts where explicitly requested. */
const JarCanvas = ({ params, onStatus }: { params: JarSceneParams; onStatus: (status: 'loading' | 'ready' | 'failed') => void }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const status = useThreeSurface(canvasRef, loadScene, params)
  useEffect(() => onStatus(status), [onStatus, status])
  return <canvas ref={canvasRef} className="recap-jar__canvas" data-status={status} aria-hidden="true" />
}

/**
 * The completion jar in the weekly recap: one ink bead per task finished this
 * week, and a shelf of earlier weeks' sealed jars. A record, never a goal —
 * no capacity line, no count, nothing resets (DESIGN.md › Completion jar).
 */
const CompletionJar = ({ shelf, isCurrentWeek, onOpenWeek, renderMode = 'three' }: CompletionJarProps) => {
  const { t, language } = useI18n()
  const theme = useThemeMode()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const { width, height } = size
  const [animation, setAnimation] = useState<{ id: number; dropFrom: number | null; sealKey: string | null }>({ id: 0, dropFrom: null, sealKey: null })
  const previous = useRef<{ key: string; ids: string[] } | null>(null)

  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, height: Math.max(MIN_HEIGHT, node.clientHeight) })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const mainIds = useMemo(() => shelf.main.beads.map((bead) => bead.taskId), [shelf.main])
  const newestFirst = useMemo(() => [...shelf.shelf].reverse(), [shelf.shelf])

  // New beads drop in only when they were ticked a moment ago, here.
  useEffect(() => {
    const before = previous.current
    previous.current = { key: shelf.main.key, ids: mainIds }
    if (!before || before.key !== shelf.main.key || !isCurrentWeek) return
    if (mainIds.length <= before.ids.length) return
    const fresh = shelf.main.beads.slice(before.ids.length)
    const now = Date.now()
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible'
    if (!visible || !fresh.every((bead) => now - bead.completedAt < FRESH_MS)) return
    setAnimation((current) => ({ id: current.id + 1, dropFrom: before.ids.length, sealKey: null }))
  }, [isCurrentWeek, mainIds, shelf.main])

  // The first time a new week is seen, last week's jar gets its lid.
  useEffect(() => {
    if (!isCurrentWeek) return
    const seen = readSeenWeek()
    writeSeenWeek(shelf.main.key)
    if (!seen || seen === shelf.main.key) return
    const lastWeek = newestFirst[0]
    if (lastWeek && lastWeek.key === seen) {
      setAnimation((current) => ({ id: current.id + 1, dropFrom: null, sealKey: lastWeek.key }))
    }
  }, [isCurrentWeek, newestFirst, shelf.main.key])

  const colors = useMemo(() => (typeof document === 'undefined' ? null : readColors(theme === 'dark')), [theme])
  const params = useMemo<JarSceneParams | null>(
    () =>
      colors
        ? {
            main: { key: shelf.main.key, ids: mainIds, sealed: !isCurrentWeek },
            shelf: newestFirst.map((week) => ({ key: week.key, ids: week.beads.map((bead) => bead.taskId), sealed: true })),
            colors,
            dark: theme === 'dark',
            dropFrom: animation.dropFrom,
            sealKey: animation.sealKey,
            animationId: animation.id,
          }
        : null,
    [animation, colors, isCurrentWeek, mainIds, newestFirst, shelf.main.key, theme],
  )

  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  const layout = useMemo(
    () => (width > 0 ? layoutJars(width, height, shelf.main.key, !isCurrentWeek, newestFirst.map((week) => week.key)) : null),
    [height, isCurrentWeek, newestFirst, shelf.main.key, width],
  )

  const count = shelf.main.beads.length
  return (
    <div className="recap-jar" ref={wrapRef}>
      <p className="sr-only">{t('taskRecap.jar.aria', { count })}</p>
      {renderMode === 'three' && params ? <JarCanvas params={params} onStatus={setStatus} /> : null}
      {(renderMode === 'sketch' || status === 'failed') && layout ? (
        <JarSketch slots={[layout.main, ...layout.shelf]} weeks={[shelf.main, ...newestFirst.slice(0, layout.shelf.length)]} width={width} height={height} />
      ) : null}
      {layout && count === 0 && isCurrentWeek ? (
        <span
          className="recap-jar__fresh"
          style={{ left: layout.main.hit.left, width: layout.main.hit.width, top: layout.main.hit.top + layout.main.hit.height * 0.55 }}
        >
          {t('taskRecap.jar.fresh')}
        </span>
      ) : null}
      {layout
        ? layout.shelf.map((slot, index) => {
            const week = newestFirst[index]
            const range = rangeLabel(week, language)
            return (
              <button
                key={slot.key}
                type="button"
                className="recap-jar__target"
                style={{ left: slot.hit.left, top: slot.hit.top, width: slot.hit.width, height: slot.hit.height }}
                title={range}
                aria-label={t('taskRecap.jar.openWeek', { range })}
                onClick={() => onOpenWeek(week.startAt)}
              />
            )
          })
        : null}
    </div>
  )
}

export default CompletionJar
