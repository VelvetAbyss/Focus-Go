import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { LayoutGrid, Settings as SettingsIcon } from 'lucide-react'
import { ROUTES } from '../../app/routes/routes'
import { AppNumber, AppNumberGroup } from '../../shared/ui/AppNumber'

type DashboardHeaderProps = {
  layoutEdit: boolean
  widgetsPanelOpen: boolean
  onToggleLayoutEdit: () => void
  onToggleWidgetsPanel: () => void
}

type HeaderInfoNodeId = 'date' | 'lunar' | 'clock'
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'
type HeaderInfoNodeLayout = {
  x: number
  y: number
  scale: number
}
type HeaderInfoLayout = Record<HeaderInfoNodeId, HeaderInfoNodeLayout>

type MoveInteraction = {
  type: 'move'
  nodeId: HeaderInfoNodeId
  pointerId: number
  startX: number
  startY: number
  startLayout: HeaderInfoLayout
}

type ResizeInteraction = {
  type: 'resize'
  nodeId: HeaderInfoNodeId
  handle: ResizeHandle
  pointerId: number
  startX: number
  startY: number
  startLayout: HeaderInfoLayout
}

type HeaderInteraction = MoveInteraction | ResizeInteraction

const LUNAR_DAY_LABELS = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]

const HEADER_INFO_LAYOUT_STORAGE_KEY = 'focusgo.headerInfo.layout.v1'
const GRID_SNAP = 8
const MIN_SCALE = 0.55
const MAX_SCALE = 1.8
const HEADER_ACTION_GUARD_WIDTH = 360

const DEFAULT_HEADER_INFO_LAYOUT: HeaderInfoLayout = {
  date: { x: 136, y: 64, scale: 0.55 },
  lunar: { x: 24, y: 64, scale: 0.55 },
  clock: { x: 24, y: 0, scale: 0.55 },
}

const HANDLE_DIR: Record<ResizeHandle, { x: -1 | 1; y: -1 | 1 }> = {
  nw: { x: -1, y: -1 },
  ne: { x: 1, y: -1 },
  sw: { x: -1, y: 1 },
  se: { x: 1, y: 1 },
}

const formatHeaderDate = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date)
  return `${year}/${month}/${day} ${weekday}`
}

const formatLunar = (date: Date) => {
  const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
    month: 'long',
    day: 'numeric',
  }).formatToParts(date)
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const rawDay = parts.find((part) => part.type === 'day')?.value ?? ''
  const dayNumber = Number.parseInt(rawDay, 10)
  const dayLabel =
    Number.isNaN(dayNumber) || dayNumber <= 0 || dayNumber >= LUNAR_DAY_LABELS.length
      ? rawDay
      : LUNAR_DAY_LABELS[dayNumber]
  return `Lunar ${month}${dayLabel}`
}

const isValidNodeLayout = (value: unknown): value is HeaderInfoNodeLayout => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HeaderInfoNodeLayout>
  return (
    typeof candidate.x === 'number' &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === 'number' &&
    Number.isFinite(candidate.y) &&
    typeof candidate.scale === 'number' &&
    Number.isFinite(candidate.scale)
  )
}

const readHeaderInfoLayout = (): HeaderInfoLayout => {
  if (typeof localStorage === 'undefined') return DEFAULT_HEADER_INFO_LAYOUT
  const raw = localStorage.getItem(HEADER_INFO_LAYOUT_STORAGE_KEY)
  if (!raw) return DEFAULT_HEADER_INFO_LAYOUT
  try {
    const parsed = JSON.parse(raw) as Partial<Record<HeaderInfoNodeId, unknown>>
    if (
      isValidNodeLayout(parsed?.date) &&
      isValidNodeLayout(parsed?.lunar) &&
      isValidNodeLayout(parsed?.clock)
    ) {
      return {
        date: parsed.date,
        lunar: parsed.lunar,
        clock: parsed.clock,
      }
    }
  } catch {
    // Fallback to defaults when local cache is malformed.
  }
  return DEFAULT_HEADER_INFO_LAYOUT
}

const writeHeaderInfoLayout = (layout: HeaderInfoLayout) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HEADER_INFO_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

const snapToGrid = (value: number) => Math.round(value / GRID_SNAP) * GRID_SNAP
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const DashboardHeader = ({
  layoutEdit,
  widgetsPanelOpen,
  onToggleLayoutEdit,
  onToggleWidgetsPanel,
}: DashboardHeaderProps) => {
  const [now, setNow] = useState(() => new Date())
  const [headerLayout, setHeaderLayout] = useState<HeaderInfoLayout>(() => readHeaderInfoLayout())
  const headerStageRef = useRef<HTMLDivElement | null>(null)
  const [interaction, setInteraction] = useState<HeaderInteraction | null>(null)
  const showProjectBadges = false

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    return () => window.clearInterval(timerId)
  }, [])

  useEffect(() => {
    writeHeaderInfoLayout(headerLayout)
  }, [headerLayout])

  const clampNodeLayout = useCallback((next: HeaderInfoLayout) => {
    const stage = headerStageRef.current
    if (!stage) return next
    const reserveWidth = window.matchMedia('(max-width: 960px)').matches ? 0 : HEADER_ACTION_GUARD_WIDTH
    const maxX = Math.max(stage.clientWidth - reserveWidth - 32, 0)
    const maxY = Math.max(stage.clientHeight - 32, 0)
    return {
      date: {
        ...next.date,
        x: clamp(snapToGrid(next.date.x), 0, maxX),
        y: clamp(snapToGrid(next.date.y), 0, maxY),
      },
      lunar: {
        ...next.lunar,
        x: clamp(snapToGrid(next.lunar.x), 0, maxX),
        y: clamp(snapToGrid(next.lunar.y), 0, maxY),
      },
      clock: {
        ...next.clock,
        x: clamp(snapToGrid(next.clock.x), 0, maxX),
        y: clamp(snapToGrid(next.clock.y), 0, maxY),
      },
    }
  }, [])

  useEffect(() => {
    const handleResize = () => {
      setHeaderLayout((current) => clampNodeLayout(current))
    }
    const initialClampFrame = window.requestAnimationFrame(handleResize)
    window.addEventListener('resize', handleResize)
    return () => {
      window.cancelAnimationFrame(initialClampFrame)
      window.removeEventListener('resize', handleResize)
    }
  }, [clampNodeLayout])

  useEffect(() => {
    if (!interaction || !layoutEdit) return
    const onPointerMove = (event: globalThis.PointerEvent) => {
      setHeaderLayout((current) => {
        const base = interaction.startLayout
        const dx = event.clientX - interaction.startX
        const dy = event.clientY - interaction.startY
        const node = base[interaction.nodeId]
        let nextNode: HeaderInfoNodeLayout = node

        if (interaction.type === 'move') {
          nextNode = {
            ...node,
            x: node.x + dx,
            y: node.y + dy,
          }
        } else {
          const dir = HANDLE_DIR[interaction.handle]
          const delta = (dx * dir.x + dy * dir.y) / 220
          nextNode = {
            ...node,
            scale: clamp(Number((node.scale + delta).toFixed(3)), MIN_SCALE, MAX_SCALE),
          }
        }

        return clampNodeLayout({
          ...current,
          [interaction.nodeId]: nextNode,
        })
      })
    }

    const onPointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== interaction.pointerId) return
      setInteraction(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [clampNodeLayout, interaction, layoutEdit])

  const startMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: HeaderInfoNodeId) => {
      if (!layoutEdit) return
      if ((event.target as HTMLElement).closest('.app-shell__hero-handle')) return
      event.preventDefault()
      setInteraction({
        type: 'move',
        nodeId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: headerLayout,
      })
    },
    [headerLayout, layoutEdit]
  )

  const startResize = useCallback(
    (event: PointerEvent<HTMLButtonElement>, nodeId: HeaderInfoNodeId, handle: ResizeHandle) => {
      if (!layoutEdit) return
      event.preventDefault()
      event.stopPropagation()
      setInteraction({
        type: 'resize',
        nodeId,
        handle,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLayout: headerLayout,
      })
    },
    [headerLayout, layoutEdit]
  )

  const getNodeStyle = (nodeId: HeaderInfoNodeId): CSSProperties => {
    const node = headerLayout[nodeId]
    return {
      left: `${node.x}px`,
      top: `${node.y}px`,
      '--node-scale': `${node.scale}`,
    } as CSSProperties
  }

  const headerDate = formatHeaderDate(now)
  const headerLunar = formatLunar(now)
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const seconds = now.getSeconds()
  const timeTrend = useMemo(() => (oldValue: number, value: number) => (value >= oldValue ? 1 : -1), [])
  const paddedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const heroStageStyle = { '--header-action-guard': `${HEADER_ACTION_GUARD_WIDTH}px` } as CSSProperties

  return (
    <header className="app-shell__header">
      <div
        ref={headerStageRef}
        className={`app-shell__hero-stage ${layoutEdit ? 'app-shell__hero-stage--editing' : ''}`}
        aria-live="polite"
        style={heroStageStyle}
      >
        <div
          className={`app-shell__hero-item app-shell__hero-item--date ${layoutEdit ? 'is-editable' : ''}`}
          style={getNodeStyle('date')}
          onPointerDown={(event) => startMove(event, 'date')}
        >
          <p className="app-shell__hero-date">{headerDate}</p>
          {layoutEdit ? (
            <>
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--nw"
                onPointerDown={(event) => startResize(event, 'date', 'nw')}
                aria-label="Resize date"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--ne"
                onPointerDown={(event) => startResize(event, 'date', 'ne')}
                aria-label="Resize date"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--sw"
                onPointerDown={(event) => startResize(event, 'date', 'sw')}
                aria-label="Resize date"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--se"
                onPointerDown={(event) => startResize(event, 'date', 'se')}
                aria-label="Resize date"
              />
            </>
          ) : null}
        </div>
        <div
          className={`app-shell__hero-item app-shell__hero-item--lunar ${layoutEdit ? 'is-editable' : ''}`}
          style={getNodeStyle('lunar')}
          onPointerDown={(event) => startMove(event, 'lunar')}
        >
          <p className="app-shell__hero-lunar">{headerLunar}</p>
          {layoutEdit ? (
            <>
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--nw"
                onPointerDown={(event) => startResize(event, 'lunar', 'nw')}
                aria-label="Resize lunar"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--ne"
                onPointerDown={(event) => startResize(event, 'lunar', 'ne')}
                aria-label="Resize lunar"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--sw"
                onPointerDown={(event) => startResize(event, 'lunar', 'sw')}
                aria-label="Resize lunar"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--se"
                onPointerDown={(event) => startResize(event, 'lunar', 'se')}
                aria-label="Resize lunar"
              />
            </>
          ) : null}
        </div>
        <div
          className={`app-shell__hero-item app-shell__hero-item--clock ${layoutEdit ? 'is-editable' : ''}`}
          style={getNodeStyle('clock')}
          onPointerDown={(event) => startMove(event, 'clock')}
        >
          <div className="app-shell__hero-time" aria-label={`Current time ${paddedTime}`}>
            <AppNumberGroup>
              <AppNumber value={hours} trend={timeTrend} format={{ minimumIntegerDigits: 2 }} className="app-shell__hero-time-main" />
              <span className="app-shell__hero-time-colon" aria-hidden>
                :
              </span>
              <AppNumber
                value={minutes}
                trend={timeTrend}
                format={{ minimumIntegerDigits: 2 }}
                className="app-shell__hero-time-main"
              />
              <span className="app-shell__hero-time-seconds-wrap" aria-hidden>
                :
                <AppNumber
                  value={seconds}
                  trend={timeTrend}
                  format={{ minimumIntegerDigits: 2 }}
                  className="app-shell__hero-time-seconds"
                />
              </span>
            </AppNumberGroup>
          </div>
          {layoutEdit ? (
            <>
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--nw"
                onPointerDown={(event) => startResize(event, 'clock', 'nw')}
                aria-label="Resize clock"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--ne"
                onPointerDown={(event) => startResize(event, 'clock', 'ne')}
                aria-label="Resize clock"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--sw"
                onPointerDown={(event) => startResize(event, 'clock', 'sw')}
                aria-label="Resize clock"
              />
              <button
                type="button"
                className="app-shell__hero-handle app-shell__hero-handle--se"
                onPointerDown={(event) => startResize(event, 'clock', 'se')}
                aria-label="Resize clock"
              />
            </>
          ) : null}
        </div>
      </div>
      <div className="app-shell__status">
        {showProjectBadges && !layoutEdit ? <span className="pill">Local First</span> : null}
        {showProjectBadges && !layoutEdit ? <span className="pill pill--soft">MVP</span> : null}
        {layoutEdit ? (
          <Button
            type="button"
            className={`app-shell__top-action app-shell__manage-widgets ${widgetsPanelOpen ? 'is-active' : ''}`}
            variant="outline"
            size="sm"
            onClick={onToggleWidgetsPanel}
          >
            <span>Manage widgets</span>
          </Button>
        ) : null}
        <Button
          type="button"
          className={`app-shell__top-action app-shell__edit-layout ${layoutEdit ? 'is-active' : ''}`}
          variant="outline"
          size="sm"
          onClick={onToggleLayoutEdit}
        >
          <LayoutGrid size={15} aria-hidden="true" />
          <span>{layoutEdit ? 'Done' : 'Edit layout'}</span>
        </Button>
        {!layoutEdit ? (
          <Button asChild className="app-shell__top-action app-shell__settings-link" variant="outline" size="sm">
            <Link to={ROUTES.SETTINGS}>
              <SettingsIcon size={15} aria-hidden="true" />
              <span>Settings</span>
            </Link>
          </Button>
        ) : null}
      </div>
    </header>
  )
}

export default DashboardHeader
