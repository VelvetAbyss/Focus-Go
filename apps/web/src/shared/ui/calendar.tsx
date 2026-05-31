import * as React from 'react'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  formatters,
  ...props
}: CalendarProps) {
  const dayPickerComponents = {
    Chevron: ({ orientation = 'left', className }: { orientation?: 'left' | 'right' | 'up' | 'down'; className?: string }) => {
      const iconClass = cn('h-4 w-4 shrink-0 text-current', className)
      if (orientation === 'right') return <ChevronRight className={iconClass} />
      if (orientation === 'up') return <ChevronUp className={iconClass} />
      if (orientation === 'down') return <ChevronDown className={iconClass} />
      return <ChevronLeft className={iconClass} />
    },
  } satisfies CalendarProps['components']

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      locale={enUS}
      weekStartsOn={1}
      captionLayout="label"
      navLayout="around"
      formatters={{
        formatWeekdayName: (date) => format(date, 'EEE', { locale: enUS }),
        ...formatters,
      }}
      classNames={{
        months: 'flex flex-col gap-3',
        month: 'relative',
        month_caption: 'relative z-0 mb-3 flex h-7 items-center justify-center pt-0 pointer-events-none',
        caption: 'relative flex h-7 items-center justify-center pt-0',
        caption_label: 'text-center text-[14px] font-medium leading-none tracking-normal text-[var(--text-primary)]',
        nav: 'hidden',
        button_previous:
          'absolute left-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-0 bg-[var(--text-primary)] p-0 text-[var(--bg-muted)] opacity-100 transition hover:bg-[color-mix(in_srgb,var(--text-primary)_90%,transparent)] [&_svg]:!text-[var(--bg-muted)]',
        button_next:
          'absolute right-0 top-0 z-10 inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-0 bg-[var(--text-primary)] p-0 text-[var(--bg-muted)] opacity-100 transition hover:bg-[color-mix(in_srgb,var(--text-primary)_90%,transparent)] [&_svg]:!text-[var(--bg-muted)]',
        nav_button:
          'inline-flex h-7 w-7 items-center justify-center rounded-[6px] border-0 bg-[var(--text-primary)] p-0 text-[var(--bg-muted)] opacity-100 transition hover:bg-[color-mix(in_srgb,var(--text-primary)_90%,transparent)] [&_svg]:!text-[var(--bg-muted)]',
        nav_button_previous: 'absolute left-0 top-0',
        nav_button_next: 'absolute right-0 top-0',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex gap-1.5',
        weekday: 'w-8 text-center text-[12px] font-medium text-[#737373]',
        week: 'mt-0 flex w-full gap-1.5',
        day:
          'relative h-8 w-8 p-0 text-center text-[12px] text-[var(--text-primary)] [&.day-range-middle]:bg-[#f1f1f1] [&.day-range-start]:rounded-l-[6px] [&.day-range-end]:rounded-r-[6px] [&.day-selected>button]:bg-[var(--text-primary)] [&.day-selected>button]:text-[var(--bg-muted)] [&.day-selected>button]:font-semibold [&.day-range-start>button]:bg-[var(--text-primary)] [&.day-range-start>button]:text-[var(--bg-muted)] [&.day-range-start>button]:font-semibold [&.day-range-end>button]:bg-[var(--text-primary)] [&.day-range-end>button]:text-[var(--bg-muted)] [&.day-range-end>button]:font-semibold [&.day-range-middle>button]:bg-transparent [&.day-range-middle>button]:text-[var(--text-primary)]',
        day_button:
          'inline-flex h-8 w-8 items-center justify-center rounded-[6px] p-0 text-[12px] font-medium text-inherit transition hover:bg-[#f3f3f3]',
        range_start: 'day-range-start',
        range_end: 'day-range-end',
        selected: 'day-selected',
        range_middle: 'day-range-middle',
        today: 'bg-transparent text-[var(--text-primary)]',
        outside: 'text-[#737373]',
        ...classNames,
      }}
      components={dayPickerComponents}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
