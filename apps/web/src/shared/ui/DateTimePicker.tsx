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
  const selectedDate = React.useMemo(() => parseDateKeyToLocalDate(dateValue), [dateValue])
  const normalizedTime = normalizeTimeKey(timeValue)
  const dateLabel = selectedDate ? format(selectedDate, 'PPP') : placeholder ?? t('tasks.drawer.selectDatePlaceholder')
  const timeLabel = normalizedTime ?? t('tasks.drawer.selectTime')

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
            <ScrollArea className="h-60">
              <div className="p-1">
                {TIME_OPTIONS.map((time) => {
                  const active = time === normalizedTime
                  return (
                    <button
                      key={time}
                      type="button"
                      className={cn(
                        'hover:bg-muted w-full rounded-md px-2 py-1.5 text-left text-sm transition',
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
            <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">{t('tasks.drawer.scrollForMore')}</p>
          </PopoverContent>
        </Popover>
      </Field>
    </FieldGroup>
  )
}
