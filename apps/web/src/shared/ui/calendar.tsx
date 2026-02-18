import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '../lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const dayPickerComponents = {
    IconLeft: () => <ChevronLeft className="h-4 w-4" />,
    IconRight: () => <ChevronRight className="h-4 w-4" />,
  } as unknown as CalendarProps['components']

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      style={{ padding: '12px' }}
      classNames={{
        months: 'calendar-months',
        month: 'calendar-month',
        caption: 'calendar-caption',
        caption_label: 'calendar-caption-label',
        nav: 'calendar-nav',
        nav_button: 'calendar-nav-button',
        nav_button_previous: 'calendar-nav-prev',
        nav_button_next: 'calendar-nav-next',
        month_grid: 'calendar-table',
        weekdays: 'calendar-head-row',
        weekday: 'calendar-head-cell',
        week: 'calendar-row',
        day: 'calendar-cell',
        day_button: 'calendar-day',
        range_end: 'day-range-end',
        selected: 'day-selected',
        today: 'day-today',
        outside: 'day-outside',
        disabled: 'day-disabled',
        range_middle: 'day-range-middle',
        hidden: 'invisible',
        ...classNames,
      }}
      components={dayPickerComponents}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
