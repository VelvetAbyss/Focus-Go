import * as React from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useI18n } from '../i18n/useI18n'
import { normalizeTimeKey, parseDateKeyToLocalDate, toDateKey } from './datePicker/dateKey'

export interface DateTimePickerProps {
  dateValue?: string | null
  timeValue?: string | null
  onDateChange: (date: string | null) => void
  onTimeChange: (time: string | null) => void
  placeholder?: string
  className?: string
  triggerClassName?: string
  ariaLabel?: string
  popoverClassName?: string
}

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, idx) => {
  const totalMinutes = idx * 5
  const hours = `${Math.floor(totalMinutes / 60)}`.padStart(2, '0')
  const minutes = `${totalMinutes % 60}`.padStart(2, '0')
  return `${hours}:${minutes}`
})

const QUICK_TIME_PRESETS = ['09:00', '12:00', '14:00', '18:00', '21:00']

const FULL_TIME_KEY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// Accepts: "9" -> "09:00", "930" -> "09:30", "9:30" -> "09:30", "0930" -> "09:30"
const coerceTypedTime = (raw: string): string | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (FULL_TIME_KEY_RE.test(trimmed)) return trimmed
  const digits = trimmed.replace(/[^\d]/g, '')
  if (!digits) return null
  let hh: string
  let mm: string
  if (digits.length <= 2) {
    hh = digits.padStart(2, '0')
    mm = '00'
  } else if (digits.length === 3) {
    hh = `0${digits[0]}`
    mm = digits.slice(1)
  } else {
    hh = digits.slice(0, 2)
    mm = digits.slice(2, 4).padEnd(2, '0')
  }
  const candidate = `${hh}:${mm}`
  return FULL_TIME_KEY_RE.test(candidate) ? candidate : null
}

export function DateTimePicker({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  placeholder,
  className,
  triggerClassName,
  ariaLabel,
  popoverClassName,
}: DateTimePickerProps) {
  const { t } = useI18n()
  const [dateOpen, setDateOpen] = React.useState(false)
  const [timeOpen, setTimeOpen] = React.useState(false)
  const [showAllTimes, setShowAllTimes] = React.useState(false)
  const selectedDate = React.useMemo(() => parseDateKeyToLocalDate(dateValue), [dateValue])
  const normalizedTime = normalizeTimeKey(timeValue)
  const [typedTime, setTypedTime] = React.useState<string>(normalizedTime ?? '')
  const dateLabel = selectedDate ? format(selectedDate, 'PPP') : placeholder ?? t('tasks.drawer.selectDatePlaceholder')
  const timeLabel = normalizedTime ?? t('tasks.drawer.selectTime')

  React.useEffect(() => {
    if (timeOpen) setTypedTime(normalizedTime ?? '')
  }, [timeOpen, normalizedTime])

  const commitTyped = React.useCallback(() => {
    const coerced = coerceTypedTime(typedTime)
    if (coerced) {
      onTimeChange(coerced)
      setTimeOpen(false)
    } else if (!typedTime.trim()) {
      onTimeChange(null)
      setTimeOpen(false)
    } else {
      setTypedTime(normalizedTime ?? '')
    }
  }, [typedTime, normalizedTime, onTimeChange])

  return (
    <FieldGroup className={cn('flex-row flex-wrap items-end gap-2', className)}>
      <Field className="min-w-0 flex-1 gap-1">
        <FieldLabel>{t('tasks.drawer.date')}</FieldLabel>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-empty={!selectedDate}
              aria-label={ariaLabel}
              className={cn(
                'data-[empty=true]:text-muted-foreground w-full min-w-0 max-w-full justify-between text-left font-normal',
                triggerClassName,
              )}
            >
              <span className="truncate">{dateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              'overflow-hidden p-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-90 data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3',
              popoverClassName,
            )}
            align="start"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              showOutsideDays={false}
              onSelect={(date) => {
                if (!date) return
                onDateChange(toDateKey(date))
                setDateOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      </Field>
      <Field className="w-[148px] min-w-[132px] shrink-0 gap-1">
        <FieldLabel>{t('tasks.drawer.time')}</FieldLabel>
        <Popover open={timeOpen} onOpenChange={setTimeOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-empty={!normalizedTime}
              aria-label={t('tasks.drawer.time')}
              className={cn(
                'data-[empty=true]:text-muted-foreground w-full min-w-0 max-w-full justify-between text-left font-normal',
                triggerClassName,
              )}
            >
              <span className="truncate">{timeLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn(
              'w-[176px] max-w-[calc(100vw-2rem)] overflow-hidden p-0 data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-90 data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3',
              popoverClassName,
            )}
            align="start"
          >
            <div className="border-border border-b px-3 py-2 text-sm font-semibold">{t('tasks.drawer.time')}</div>
            <div className="space-y-2 p-2">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={typedTime}
                placeholder="HH:MM"
                aria-label={t('tasks.drawer.timeInputHint')}
                onChange={(event) => setTypedTime(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitTyped()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setTimeOpen(false)
                  }
                }}
                onBlur={commitTyped}
                className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-center text-sm tracking-wider focus-visible:outline-none focus-visible:ring-1"
              />
              <p className="text-muted-foreground px-1 text-[11px]">{t('tasks.drawer.timeInputHint')}</p>
              <div>
                <p className="text-muted-foreground mb-1 px-1 text-[11px] uppercase tracking-wide">
                  {t('tasks.drawer.timeQuickPresets')}
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {QUICK_TIME_PRESETS.map((time) => {
                    const active = time === normalizedTime
                    return (
                      <button
                        key={time}
                        type="button"
                        className={cn(
                          'hover:bg-muted rounded-md border border-transparent px-2 py-1.5 text-sm transition',
                          active && 'border-foreground/20 bg-foreground text-background hover:bg-foreground',
                        )}
                        onClick={() => {
                          onTimeChange(time)
                          setTimeOpen(false)
                        }}
                      >
                        {time}
                      </button>
                    )
                  })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAllTimes((v) => !v)}
                className="text-muted-foreground hover:text-foreground w-full rounded-md px-2 py-1 text-left text-xs underline-offset-4 hover:underline"
              >
                {showAllTimes ? t('tasks.drawer.timeHideAll') : t('tasks.drawer.timeShowAll')}
              </button>
              {showAllTimes ? (
                <ScrollArea className="h-48">
                  <div className="grid grid-cols-3 gap-1 p-1">
                    {TIME_OPTIONS.map((time) => {
                      const active = time === normalizedTime
                      return (
                        <button
                          key={time}
                          type="button"
                          className={cn(
                            'hover:bg-muted rounded-md px-2 py-1.5 text-center text-xs transition',
                            active && 'bg-foreground text-background hover:bg-foreground',
                          )}
                          onClick={() => {
                            onTimeChange(time)
                            setTimeOpen(false)
                          }}
                        >
                          {time}
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </Field>
    </FieldGroup>
  )
}
