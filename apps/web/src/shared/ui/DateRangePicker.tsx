import * as React from 'react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  normalizeDateRangeKeys,
  parseDateKeyToLocalDate,
  toDateKey,
} from './datePicker/dateKey'

type DateRangeValue = {
  startDate: string | null
  endDate: string | null
}

export interface DateRangePickerProps {
  value?: {
    startDate?: string | null
    endDate?: string | null
  }
  onChange: (next: DateRangeValue) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
  popoverClassName?: string
  allowOpenEnd?: boolean
}

export function DateRangePicker({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  popoverClassName,
  allowOpenEnd = true,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  void placeholder
  void allowOpenEnd

  const committedSelection = React.useMemo<DateRange | undefined>(() => {
    const from = parseDateKeyToLocalDate(value?.startDate)
    const to = parseDateKeyToLocalDate(value?.endDate)
    if (!from) return undefined
    if (!to) return { from, to: undefined }
    return to < from ? { from: to, to: from } : { from, to }
  }, [value?.endDate, value?.startDate])

  const [draftSelection, setDraftSelection] = React.useState<DateRange | undefined>(committedSelection)

  React.useEffect(() => {
    if (open) {
      setDraftSelection(committedSelection)
    }
  }, [open, committedSelection])

  const selected = open ? draftSelection : committedSelection

  const triggerText =
    committedSelection?.from && committedSelection.to
      ? `${format(committedSelection.from, 'LLL dd, y')} - ${format(committedSelection.to, 'LLL dd, y')}`
      : committedSelection?.from
        ? format(committedSelection.from, 'LLL dd, y')
        : 'Select range'

  const handleSelect = React.useCallback(
    (next: DateRange | undefined) => {
      if (!next?.from) {
        setDraftSelection(undefined)
        return
      }
      const normalized = next.to && next.to < next.from ? { from: next.to, to: next.from } : next
      setDraftSelection(normalized)
      if (!normalized.from || !normalized.to) {
        return
      }
      const startDate = toDateKey(normalized.from)
      const endDate = toDateKey(normalized.to)
      onChange(normalizeDateRangeKeys(startDate, endDate))
      setOpen(false)
    },
    [onChange],
  )

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setDraftSelection(committedSelection)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-empty={!committedSelection?.from}
          className={cn(
            'h-auto min-h-11 w-full min-w-0 max-w-full justify-start rounded-[6px] border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5 text-left text-[14px] font-normal text-[#3a3733] shadow-none',
            'data-[empty=true]:text-[#737373] hover:bg-[#fafafa] hover:text-[#3a3733]',
            className,
          )}
          aria-label={ariaLabel}
        >
          <span className="truncate">{triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          'overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#fafafa] p-4',
          'data-[state=open]:duration-300 data-[state=closed]:duration-200 data-[state=open]:zoom-in-90 data-[state=closed]:zoom-out-90 data-[side=bottom]:slide-in-from-top-3 data-[side=top]:slide-in-from-bottom-3',
          popoverClassName,
        )}
        align="start"
      >
        <Calendar
          mode="range"
          defaultMonth={selected?.from ?? committedSelection?.from}
          selected={selected}
          onSelect={handleSelect}
          showOutsideDays={false}
          className="p-0"
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  )
}
