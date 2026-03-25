// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateRangePicker } from './DateRangePicker'

vi.mock('../i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../i18n/testMock')
  return { useI18n: mockUseI18n }
})

const calendarPropsSpy = vi.fn()

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({
    onSelect,
    numberOfMonths,
  }: {
    onSelect?: (value: { from?: Date; to?: Date } | undefined) => void
    numberOfMonths?: number
  }) => (
    <div
      data-testid="calendar-range"
      data-number-of-months={numberOfMonths ?? 0}
      ref={() => {
        calendarPropsSpy({ numberOfMonths })
      }}
    >
      <button
        type="button"
        onClick={() => onSelect?.({ from: new Date(2026, 0, 10, 12, 0, 0, 0), to: new Date(2026, 0, 12, 12, 0, 0, 0) })}
      >
        Choose full range
      </button>
      <button type="button" onClick={() => onSelect?.({ from: new Date(2026, 1, 2, 12, 0, 0, 0) })}>
        Choose open range
      </button>
      <button
        type="button"
        onClick={() => onSelect?.({ from: new Date(2026, 1, 10, 12, 0, 0, 0), to: new Date(2026, 1, 1, 12, 0, 0, 0) })}
      >
        Choose reversed range
      </button>
    </div>
  ),
}))

afterEach(() => {
  calendarPropsSpy.mockReset()
  cleanup()
})

describe('DateRangePicker', () => {
  it('emits start/end strings when full range selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DateRangePicker value={{ startDate: null, endDate: null }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /select range/i }))
    await user.click(screen.getByRole('button', { name: 'Choose full range' }))

    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-01-10', endDate: '2026-01-12' })
  })

  it('does not commit open end range', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DateRangePicker value={{ startDate: null, endDate: null }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /select range/i }))
    await user.click(screen.getByRole('button', { name: 'Choose open range' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('auto-corrects reversed range', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DateRangePicker value={{ startDate: null, endDate: null }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /select range/i }))
    await user.click(screen.getByRole('button', { name: 'Choose reversed range' }))

    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-02-01', endDate: '2026-02-10' })
  })

  it('does not render clear action', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DateRangePicker value={{ startDate: '2026-01-10', endDate: '2026-01-12' }} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /jan/i }))

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalledWith({ startDate: null, endDate: null })
  })

  it('uses fluid trigger width and single-month calendar by default', async () => {
    const user = userEvent.setup()

    render(<DateRangePicker value={{ startDate: null, endDate: null }} onChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /select range/i })
    expect(trigger.className).toContain('w-full')
    expect(trigger.className).not.toContain('w-[212px]')

    await user.click(trigger)
    expect(calendarPropsSpy).toHaveBeenCalledWith(expect.objectContaining({ numberOfMonths: 1 }))
  })
})
