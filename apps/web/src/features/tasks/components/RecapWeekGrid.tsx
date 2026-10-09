import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useI18n } from '../../../shared/i18n/useI18n'
import type { WeekGridDay } from '../domain/weekGrid'
import './RecapWeekGrid.css'

type RecapWeekGridProps = {
  days: readonly WeekGridDay[]
  /** The day that is today, or null when the week on show is not this one. */
  todayIndex: number | null
}

/** The paper always has at least this many rows, so a light week is not a cramped one. */
const MIN_ROWS = 4
const GAP = 3
/** Day label plus its gap under the paper. */
const LABEL_SPACE = 19
const MAX_CELL = 16
const MIN_CELL = 8
// On first show the inked cells turn over one after another, oldest first, as
// if the week were being written in; the whole pass stays under INTRO_SPAN_MS.
const STAGGER_MS = 28
const INTRO_SPAN_MS = 560
const INTRO_DONE_MS = INTRO_SPAN_MS + 500

type Layout = { size: number; rows: number }

const layoutFor = (width: number, height: number, maxCount: number): Layout => {
  const wanted = Math.max(MIN_ROWS, maxCount)
  // Unmeasured (first paint, tests): the preferred size, every row.
  if (width === 0 || height === 0) return { size: MAX_CELL, rows: wanted }
  const room = height - LABEL_SPACE
  const byWidth = Math.floor(width / 7) - 6
  const size = Math.min(MAX_CELL, byWidth, Math.floor((room - (wanted - 1) * GAP) / wanted))
  if (size >= MIN_CELL) return { size, rows: wanted }
  // Too many for the room: smallest cells, as many rows as fit, "+N" on top.
  return { size: MIN_CELL, rows: Math.max(2, Math.floor((room + GAP) / (MIN_CELL + GAP))) }
}

/**
 * The weekly recap's graph paper (DESIGN.md › Recap week grid): one cell per
 * task finished, stacked on the day it was done. Paper is pencil, a finished
 * task is ink, and today's latest is the pen. A cell turns over from pencil
 * to ink when it lands. A record, never a goal: the paper has no target row.
 */
const RecapWeekGrid = ({ days, todayIndex }: RecapWeekGridProps) => {
  const { t, language } = useI18n()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [intro, setIntro] = useState(true)

  useLayoutEffect(() => {
    const node = wrapRef.current
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // The parent keys this component by week, so each week gets one intro.
  useEffect(() => {
    const timer = window.setTimeout(() => setIntro(false), INTRO_DONE_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const locale = language === 'zh' ? 'zh-CN' : 'en-US'
  const formats = useMemo(
    () => ({
      narrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }),
      short: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }),
    }),
    [locale],
  )

  const total = days.reduce((sum, day) => sum + day.cells.length, 0)
  const layout = layoutFor(size.width, size.height, Math.max(0, ...days.map((day) => day.cells.length)))
  const step = total > 0 ? Math.min(STAGGER_MS, INTRO_SPAN_MS / total) : 0
  const order = useMemo(() => {
    const ids = days.flatMap((day) => day.cells).sort((a, b) => a.completedAt - b.completedAt)
    return new Map(ids.map((cell, index) => [cell.taskId, index]))
  }, [days])

  const label = t('taskRecap.grid.aria', {
    count: total,
    days: days.map((day) => `${formats.short.format(day.startAt)} ${day.cells.length}`).join(', '),
  })

  return (
    <div className="recap-grid" ref={wrapRef} role="img" aria-label={label} style={{ '--cell': `${layout.size}px` } as CSSProperties}>
      <div className="recap-grid__paper">
        {days.map((day, index) => {
          const isToday = index === todayIndex
          const future = todayIndex !== null && index > todayIndex
          const overflow = day.cells.length > layout.rows
          const shown = overflow ? day.cells.slice(0, layout.rows - 1) : day.cells
          return (
            <div key={day.startAt} className="recap-grid__day" data-today={isToday || undefined}>
              <div className="recap-grid__stack">
                {Array.from({ length: layout.rows }, (_, row) => {
                  const cell = shown[row]
                  if (cell) {
                    const pen = isToday && !overflow && row === shown.length - 1
                    const delay = intro ? (order.get(cell.taskId) ?? 0) * step : 0
                    return (
                      <span
                        key={cell.taskId}
                        className={`recap-grid__cell is-filled${pen ? ' is-pen' : ''}`}
                        style={{ '--turn-delay': `${Math.round(delay)}ms` } as CSSProperties}
                        title={`${cell.title} · ${formats.time.format(cell.completedAt)}`}
                      />
                    )
                  }
                  if (overflow && row === layout.rows - 1) {
                    return (
                      <span key="more" className="recap-grid__more">
                        +{day.cells.length - shown.length}
                      </span>
                    )
                  }
                  return <span key={`paper-${row}`} className={`recap-grid__cell${future ? ' is-future' : ''}`} />
                })}
              </div>
              <span className="recap-grid__label" aria-hidden="true">
                {formats.narrow.format(day.startAt)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default RecapWeekGrid
