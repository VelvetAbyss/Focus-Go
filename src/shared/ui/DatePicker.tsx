import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '../lib/utils'
import { useDatePicker } from './datePicker/datePickerContext'
import './datepicker.css'

interface DatePickerProps {
  value?: string | null
  onChange: (date: string | null) => void
  placeholder?: string
  allowManualInput?: boolean
}

const parseDateKeyToLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

const isValidDateKey = (next: string) => /^\d{4}-\d{2}-\d{2}$/.test(next)

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  allowManualInput = false,
}: DatePickerProps) {
  const { open, close, isOpenFor } = useDatePicker()
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const setAnchor = React.useCallback((el: HTMLElement | null) => {
    anchorRef.current = el
    setAnchorEl((prev) => (prev === el ? prev : el))
  }, [])
  const selectedDate = React.useMemo(() => (value ? parseDateKeyToLocalDate(value) : undefined), [value])
  const isOpen = isOpenFor(anchorEl)

  const [draft, setDraft] = React.useState(value ?? '')
  React.useEffect(() => setDraft(value ?? ''), [value])

  const handleOpen = React.useCallback(() => {
    if (!anchorRef.current) return
    open({ anchorEl: anchorRef.current, value: value ?? null, onChange })
  }, [onChange, open, value])

  if (allowManualInput) {
    return (
      <div
        ref={setAnchor}
        className={cn('date-picker-trigger date-picker-trigger--input', isOpen && 'is-open')}
        role="group"
        onClick={handleOpen}
      >
        <input
          className="date-picker-trigger__input"
          value={draft}
          placeholder={placeholder}
          onFocus={handleOpen}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            if (isValidDateKey(next)) {
              onChange(next)
              close()
            }
          }}
        />
        <CalendarIcon className="date-picker-trigger__icon" size={18} />
      </div>
    )
  }

  return (
    <button
      ref={setAnchor}
      type="button"
      className={cn('date-picker-trigger', !selectedDate && 'date-picker-placeholder', isOpen && 'is-open')}
      onClick={handleOpen}
    >
      <span className="truncate">{selectedDate ? format(selectedDate, 'PPP') : placeholder}</span>
      <CalendarIcon className="date-picker-trigger__icon" size={18} />
    </button>
  )
}
