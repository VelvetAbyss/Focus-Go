import * as React from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { parseDateKeyToLocalDate, toDateKey } from './datePicker/dateKey'

export interface DatePickerProps {
  value?: string | null
  onChange: (date: string | null) => void
  placeholder?: string
  allowManualInput?: boolean
  className?: string
  ariaLabel?: string
  popoverClassName?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel,
  popoverClassName,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedDate = React.useMemo(() => parseDateKeyToLocalDate(value), [value])
  void placeholder
  const emptyLabel = 'Select date'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-empty={!selectedDate}
          className={cn(
            'h-auto min-h-11 w-full min-w-0 max-w-full justify-start rounded-[6px] border-[#e5e5e5] bg-[#fafafa] px-3 py-2.5 text-left text-[14px] font-normal text-[#3a3733] shadow-none',
            'data-[empty=true]:text-[#737373] hover:bg-[#fafafa] hover:text-[#3a3733]',
            className,
          )}
          aria-label={ariaLabel}
        >
          <span className="truncate">{selectedDate ? format(selectedDate, 'PPP') : emptyLabel}</span>
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
          mode="single"
          selected={selectedDate}
          defaultMonth={selectedDate}
          showOutsideDays={false}
          className="p-0"
          onSelect={(date) => {
            if (!date) return
            onChange(toDateKey(date))
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
