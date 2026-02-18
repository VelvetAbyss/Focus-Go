import * as React from 'react'
import { createPortal } from 'react-dom'
import { addMonths, format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Calendar } from '../calendar'
import type { DatePickerContextValue, OpenDatePickerParams } from './datePickerContext'
import { DatePickerContext } from './datePickerContext'
import '../datepicker.css'

const parseDateKeyToLocalDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

const toUtcDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const DatePickerProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const [value, setValue] = React.useState<string | null>(null)
  const onChangeRef = React.useRef<((dateKey: string | null) => void) | null>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [ready, setReady] = React.useState(false)
  const prevBodyOverflowRef = React.useRef<string | null>(null)

  const [month, setMonth] = React.useState<Date>(() => new Date())
  const selectedDate = React.useMemo(() => (value ? parseDateKeyToLocalDate(value) : undefined), [value])

  const [position, setPosition] = React.useState<{ top: number; left: number; width: number } | null>(null)

  const close = React.useCallback(() => {
    setOpen(false)
    setReady(false)
    setPosition(null)
  }, [])

  const updatePosition = React.useCallback((target?: HTMLElement | null) => {
    const el = target ?? anchorRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const width = rect.width
    const left = rect.left
    const top = rect.bottom + 8
    setPosition({ top, left, width })
  }, [])

  const openPicker = React.useCallback(
    (params: OpenDatePickerParams) => {
      onChangeRef.current = params.onChange
      anchorRef.current = params.anchorEl
      setAnchorEl(params.anchorEl)
      setValue(params.value ?? null)
      const nextMonth = params.value ? parseDateKeyToLocalDate(params.value) : new Date()
      setMonth(nextMonth ?? new Date())
      setReady(false)
      updatePosition(params.anchorEl)
      setOpen(true)
      requestAnimationFrame(() => setReady(true))
    },
    [updatePosition]
  )

  React.useEffect(() => {
    if (!open) return
    updatePosition()

    const onResize = () => updatePosition()
    const onScroll = () => updatePosition()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, updatePosition])

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  React.useEffect(() => {
    if (!open) return
    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorEl?.contains(target)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    return () => document.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [anchorEl, close, open])

  React.useEffect(() => {
    if (!open) return
    if (prevBodyOverflowRef.current === null) {
      prevBodyOverflowRef.current = document.body.style.overflow
    }
    document.body.style.overflow = 'hidden'
    return () => {
      if (prevBodyOverflowRef.current !== null) {
        document.body.style.overflow = prevBodyOverflowRef.current
        prevBodyOverflowRef.current = null
      }
    }
  }, [open])

  const commit = React.useCallback(
    (next: string | null) => {
      onChangeRef.current?.(next)
      close()
    },
    [close]
  )

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date) return
      commit(toUtcDateKey(date))
    },
    [commit]
  )

  const handleClear = React.useCallback(() => commit(null), [commit])
  const handleToday = React.useCallback(() => commit(toUtcDateKey(new Date())), [commit])
  const handlePrevMonth = React.useCallback(() => setMonth((prev) => addMonths(prev, -1)), [])
  const handleNextMonth = React.useCallback(() => setMonth((prev) => addMonths(prev, 1)), [])

  const valueCtx = React.useMemo<DatePickerContextValue>(
    () => ({
      open: openPicker,
      close,
      isOpenFor: (el) => Boolean(open && el && el === anchorEl),
    }),
    [anchorEl, close, open, openPicker]
  )

  const popover =
    open && anchorEl && position
      ? createPortal(
          <div
            ref={popoverRef}
            className={`date-picker-popover ${ready ? 'is-ready' : ''}`}
            style={{ top: position.top, left: position.left, width: position.width }}
            role="dialog"
            aria-label="Select date"
          >
            <div className="date-picker-popover__header">
              <div className="date-picker-popover__month">{format(month, 'MMMM yyyy')}</div>
            </div>

            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              month={month}
              onMonthChange={setMonth}
              showOutsideDays
              hideNavigation
              components={{
                Nav: () => <></>,
                MonthCaption: () => <></>,
              }}
            />

            <div className="date-picker-popover__footer">
              <button type="button" className="date-picker-popover__link" onClick={handleClear}>
                Clear
              </button>
              <div className="date-picker-popover__nav">
                <button
                  type="button"
                  className="date-picker-popover__nav-btn"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="date-picker-popover__nav-btn"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button type="button" className="date-picker-popover__link is-accent" onClick={handleToday}>
                Today
              </button>
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <DatePickerContext.Provider value={valueCtx}>
      {children}
      {popover}
    </DatePickerContext.Provider>
  )
}
