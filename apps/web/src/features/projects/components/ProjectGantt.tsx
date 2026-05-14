import { useMemo, useRef, useEffect, useLayoutEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { TaskItem, TaskPriority, TaskStatus } from '../../../data/models/types'

type ProjectGanttViewMode = 'week' | 'month' | 'year'

type ProjectGanttProps = {
  tasks: TaskItem[]
  projectColor?: string
  viewMode: ProjectGanttViewMode
  onTaskClick?: (task: TaskItem) => void
}

const DAY_MS = 86400000

const DAY_WIDTH: Record<ProjectGanttViewMode, number> = {
  week: 56,
  month: 20,
  year: 4,
}

const ROW_HEIGHT_BASE = 44
const ROW_HEIGHT_HIGH = 56
const STICKY_COL = 260
const STICKY_COL_COMPACT = 180
const AXIS_HEIGHT = 56

const PRIORITY_TRAIL_DAYS: Record<TaskPriority | 'none', number> = {
  high: 7,
  medium: 4,
  low: 2,
  none: 3,
}

const STATUS_TONE: Record<TaskStatus, { dot: string; label: string }> = {
  todo: { dot: '#9A8F83', label: '待办' },
  doing: { dot: '#3D7A6C', label: '进行中' },
  done: { dot: '#3D7A4E', label: '已完成' },
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const parseDateOnly = (value: string | undefined | null): Date | null => {
  if (!value) return null
  const parts = value.split('-').map((p) => Number.parseInt(p, 10))
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS)

const addDays = (d: Date, n: number) => {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

type ResolvedRange = {
  start: Date
  due: Date
  hasExplicitStart: boolean
}

const resolveTaskRange = (task: TaskItem): ResolvedRange | null => {
  const explicitStart = parseDateOnly(task.startDate)
  const explicitEnd = parseDateOnly(task.endDate ?? task.dueDate)
  const explicitDue = parseDateOnly(task.dueDate)

  if (explicitStart && explicitEnd) {
    return {
      start: startOfDay(explicitStart),
      due: startOfDay(explicitEnd.getTime() >= explicitStart.getTime() ? explicitEnd : explicitStart),
      hasExplicitStart: true,
    }
  }
  if (explicitDue) {
    const trail = PRIORITY_TRAIL_DAYS[task.priority ?? 'none']
    const due = startOfDay(explicitDue)
    return {
      start: addDays(due, -trail),
      due,
      hasExplicitStart: Boolean(explicitStart),
    }
  }
  if (explicitStart) {
    return {
      start: startOfDay(explicitStart),
      due: startOfDay(addDays(explicitStart, 2)),
      hasExplicitStart: true,
    }
  }
  return null
}

type AxisTick = { date: Date; x: number; bold: boolean; label: string; sub?: string }

const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

const buildAxisTicks = (
  rangeStart: Date,
  rangeDays: number,
  viewMode: ProjectGanttViewMode,
  dayWidth: number,
): AxisTick[] => {
  const ticks: AxisTick[] = []
  if (viewMode === 'week') {
    for (let i = 0; i <= rangeDays; i += 1) {
      const date = addDays(rangeStart, i)
      const dow = date.getDay()
      ticks.push({
        date,
        x: i * dayWidth,
        bold: dow === 1,
        label: String(date.getDate()),
        sub: i === 0 || date.getDate() === 1 ? MONTH_LABELS[date.getMonth()] : ['日', '一', '二', '三', '四', '五', '六'][dow],
      })
    }
  } else if (viewMode === 'month') {
    for (let i = 0; i <= rangeDays; i += 1) {
      const date = addDays(rangeStart, i)
      const dayOfMonth = date.getDate()
      const isMonday = date.getDay() === 1
      const isMonthStart = dayOfMonth === 1
      if (isMonthStart || isMonday || i === 0) {
        ticks.push({
          date,
          x: i * dayWidth,
          bold: isMonthStart,
          label: isMonthStart ? MONTH_LABELS[date.getMonth()] : String(dayOfMonth),
          sub: isMonthStart ? String(date.getFullYear()) : undefined,
        })
      }
    }
  } else {
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    while (diffDays(rangeStart, cursor) <= rangeDays) {
      const offset = diffDays(rangeStart, cursor)
      if (offset >= 0) {
        ticks.push({
          date: cursor,
          x: offset * dayWidth,
          bold: cursor.getMonth() === 0,
          label: MONTH_LABELS[cursor.getMonth()],
          sub: cursor.getMonth() === 0 ? String(cursor.getFullYear()) : undefined,
        })
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  }
  return ticks
}

const ProjectGantt = ({ tasks, projectColor, viewMode, onTaskClick }: ProjectGanttProps) => {
  const accent = projectColor?.trim() || '#B07830'
  const dayWidth = DAY_WIDTH[viewMode]

  const today = useMemo(() => startOfDay(new Date()), [])

  const scheduled = useMemo(() => {
    return tasks
      .map((task) => ({ task, range: resolveTaskRange(task) }))
      .filter((entry): entry is { task: TaskItem; range: ResolvedRange } => entry.range !== null)
      .sort((a, b) => a.range.due.getTime() - b.range.due.getTime())
  }, [tasks])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [scrollX, setScrollX] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [stickyColWidth, setStickyColWidth] = useState(STICKY_COL)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    let frame = 0
    const measure = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nextViewportWidth = Math.round(el.clientWidth || el.getBoundingClientRect().width)
        const nextStickyColWidth = window.matchMedia('(max-width: 760px)').matches ? STICKY_COL_COMPACT : STICKY_COL
        setViewportWidth(nextViewportWidth)
        setStickyColWidth(nextStickyColWidth)
      })
    }

    measure()
    window.addEventListener('resize', measure)
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(el)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      ro?.disconnect()
    }
  }, [])

  const { rangeStart, rangeDays } = useMemo(() => {
    const minDaysForViewport = viewportWidth > 0
      ? Math.ceil(Math.max(0, viewportWidth - stickyColWidth) / dayWidth)
      : 0

    if (scheduled.length === 0) {
      const start = addDays(today, -7)
      return { rangeStart: start, rangeDays: Math.max(30, minDaysForViewport) }
    }
    const allStarts = scheduled.map((e) => e.range.start.getTime())
    const allEnds = scheduled.map((e) => e.range.due.getTime())
    const minStart = Math.min(...allStarts, today.getTime() - 7 * DAY_MS)
    const maxEnd = Math.max(...allEnds, today.getTime() + 7 * DAY_MS)
    const padDays = viewMode === 'week' ? 1 : viewMode === 'month' ? 3 : 14
    const start = addDays(new Date(minStart), -padDays)
    const contentDays = diffDays(start, new Date(maxEnd)) + padDays * 2
    const baselineMin = viewMode === 'week' ? 7 : 30
    return {
      rangeStart: startOfDay(start),
      rangeDays: Math.max(contentDays, baselineMin, minDaysForViewport),
    }
  }, [scheduled, today, viewMode, dayWidth, viewportWidth, stickyColWidth])

  const ticks = useMemo(() => buildAxisTicks(rangeStart, rangeDays, viewMode, dayWidth), [rangeStart, rangeDays, viewMode, dayWidth])
  const chartWidth = Math.max(rangeDays * dayWidth + dayWidth, Math.max(0, viewportWidth - stickyColWidth))
  const canvasWidth = chartWidth + stickyColWidth

  const todayOffset = useMemo(() => diffDays(rangeStart, today) * dayWidth + dayWidth / 2, [rangeStart, today, dayWidth])
  const showTodayLine = todayOffset >= 0 && todayOffset <= chartWidth

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (showTodayLine) {
      const target = Math.max(0, todayOffset - el.clientWidth * 0.35)
      el.scrollTo({ left: target, behavior: 'auto' })
    }
  }, [viewMode, showTodayLine, todayOffset])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => setScrollX(el.scrollLeft)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  if (scheduled.length === 0) {
    return (
      <div className="fg-timeline fg-timeline--empty">
        <p className="fg-timeline__empty-eyebrow">时间线</p>
        <p className="fg-timeline__empty-title">这里还空着</p>
        <p className="fg-timeline__empty-hint">为任务添加截止日期，它们会按时序在此显现。</p>
      </div>
    )
  }

  return (
    <div
      className="fg-timeline"
      style={{ ['--fg-accent' as string]: accent }}
    >
      <div className="fg-timeline__inner">
        <header className="fg-timeline__sticky-head">
          <div className="fg-timeline__sticky-head__title">
            <span className="fg-timeline__eyebrow">{scheduled.length} 项任务</span>
            <span className="fg-timeline__legend">
              <span className="fg-timeline__legend-dot" style={{ background: 'transparent', borderColor: accent }} />待办
              <span className="fg-timeline__legend-dot" style={{ background: accent }} />进行中
              <span className="fg-timeline__legend-dot fg-timeline__legend-dot--done" />已完成
            </span>
          </div>
        </header>

        <div className="fg-timeline__viewport" ref={scrollRef}>
          <div className="fg-timeline__canvas" style={{ width: canvasWidth, minHeight: AXIS_HEIGHT + scheduled.length * ROW_HEIGHT_BASE + 24 }}>
            <div className="fg-timeline__sticky-col" style={{ width: stickyColWidth, transform: `translateX(${scrollX}px)` }}>
              <div className="fg-timeline__sticky-col__head" />
              {scheduled.map(({ task }, i) => {
                const height = task.priority === 'high' ? ROW_HEIGHT_HIGH : ROW_HEIGHT_BASE
                const tone = STATUS_TONE[task.status]
                return (
                  <motion.button
                    key={task.id}
                    type="button"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + i * 0.04, duration: 0.32 }}
                    className="fg-timeline__row-head"
                    style={{ height }}
                    onClick={() => onTaskClick?.(task)}
                    aria-label={`${task.title} — ${tone.label}`}
                  >
                    <span className="fg-timeline__row-head__title">
                      {task.pinned ? <span className="fg-timeline__pin" aria-hidden>✦</span> : null}
                      {task.title || '(untitled)'}
                    </span>
                    <span className="fg-timeline__row-head__status">
                      <span className="fg-timeline__row-head__dot" style={{ background: tone.dot }} />
                      <span>{tone.label}</span>
                      {task.priority === 'high' ? <span className="fg-timeline__row-head__priority">高优</span> : null}
                    </span>
                  </motion.button>
                )
              })}
            </div>

            <div className="fg-timeline__chart" style={{ marginLeft: stickyColWidth, width: chartWidth }}>
              <div className="fg-timeline__axis" style={{ height: AXIS_HEIGHT, width: chartWidth }}>
                {ticks.map((tick, i) => (
                  <motion.div
                    key={tick.date.toISOString()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.04 + i * 0.012, duration: 0.4 }}
                    className={`fg-timeline__axis-tick${tick.bold ? ' is-bold' : ''}`}
                    style={{ left: tick.x }}
                  >
                    <span className="fg-timeline__axis-tick__label">{tick.label}</span>
                    {tick.sub ? <span className="fg-timeline__axis-tick__sub">{tick.sub}</span> : null}
                  </motion.div>
                ))}
              </div>

              <div className="fg-timeline__grid" style={{ width: chartWidth }}>
                {ticks.map((tick) => (
                  <span
                    key={`grid-${tick.date.toISOString()}`}
                    className={`fg-timeline__grid-line${tick.bold ? ' is-bold' : ''}`}
                    style={{ left: tick.x }}
                    aria-hidden
                  />
                ))}

                {showTodayLine ? (
                  <motion.div
                    className="fg-timeline__today"
                    initial={{ scaleY: 0, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ left: todayOffset, transformOrigin: 'top center' }}
                  >
                    <span className="fg-timeline__today-label">今</span>
                    <span className="fg-timeline__today-line" />
                  </motion.div>
                ) : null}

                <div className="fg-timeline__rows">
                  {scheduled.map(({ task, range }, i) => {
                    const startOffset = diffDays(rangeStart, range.start) * dayWidth
                    const dueOffset = diffDays(rangeStart, range.due) * dayWidth
                    const barWidth = Math.max(dayWidth * 0.9, dueOffset - startOffset + dayWidth)
                    const height = task.priority === 'high' ? ROW_HEIGHT_HIGH : ROW_HEIGHT_BASE
                    const isDone = task.status === 'done'
                    const isDoing = task.status === 'doing'
                    const fillStyle: CSSProperties = isDone
                      ? { background: 'rgba(61, 122, 78, 0.18)', borderColor: 'rgba(61, 122, 78, 0.42)' }
                      : isDoing
                        ? { background: accent, borderColor: accent, color: '#FFFCF6' }
                        : { background: 'transparent', borderColor: accent, color: 'rgba(58,55,51,0.78)' }
                    const trailGradient = !range.hasExplicitStart && !isDone
                      ? `linear-gradient(90deg, transparent 0%, ${accent}10 30%, ${accent}30 80%, ${accent}55 100%)`
                      : undefined
                    return (
                      <motion.div
                        key={task.id}
                        className="fg-timeline__row"
                        style={{ height }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.12 + i * 0.04, duration: 0.3 }}
                      >
                        {trailGradient ? (
                          <motion.div
                            className="fg-timeline__trail"
                            initial={{ scaleX: 0, opacity: 0 }}
                            animate={{ scaleX: 1, opacity: 1 }}
                            transition={{ delay: 0.18 + i * 0.04, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                              left: startOffset + dayWidth * 0.4,
                              width: Math.max(0, dueOffset - startOffset - dayWidth * 0.3),
                              backgroundImage: trailGradient,
                              transformOrigin: 'right center',
                            }}
                            aria-hidden
                          />
                        ) : null}

                        <motion.button
                          type="button"
                          className={`fg-timeline__bar fg-timeline__bar--${task.status}`}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => onTaskClick?.(task)}
                          style={{
                            left: startOffset + dayWidth * 0.2,
                            width: Math.max(dayWidth * 0.8, dueOffset - startOffset + dayWidth * 0.6),
                            ...fillStyle,
                          }}
                          aria-label={`${task.title} ${range.due.getFullYear()}-${range.due.getMonth() + 1}-${range.due.getDate()}`}
                        >
                          <span className="fg-timeline__bar-cap" style={{ background: isDone ? '#3D7A4E' : accent }} />
                          {barWidth > 90 ? (
                            <span className="fg-timeline__bar-label">
                              {isDone ? '✓ ' : ''}
                              {task.title}
                            </span>
                          ) : null}
                        </motion.button>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProjectGantt
