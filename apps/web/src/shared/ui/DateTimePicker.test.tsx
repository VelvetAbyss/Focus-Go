// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DateTimePicker } from './DateTimePicker'

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: { onSelect?: (value: Date | undefined) => void }) => (
    <div data-testid="calendar-single">
      <button type="button" onClick={() => onSelect?.(new Date(2026, 0, 20, 12, 0, 0, 0))}>
        Choose date
      </button>
    </div>
  ),
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>
      {children}
    </div>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('DateTimePicker', () => {
  it('emits date key after date selection', async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()

    render(<DateTimePicker dateValue={null} timeValue={null} onDateChange={onDateChange} onTimeChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /select date/i }))
    await user.click(screen.getByRole('button', { name: 'Choose date' }))

    expect(onDateChange).toHaveBeenCalledWith('2026-01-20')
  })

  it('emits HH:mm time value from time picker list', async () => {
    const user = userEvent.setup()
    const onTimeChange = vi.fn()

    render(<DateTimePicker dateValue={null} timeValue={null} onDateChange={vi.fn()} onTimeChange={onTimeChange} />)

    await user.click(screen.getByRole('button', { name: /^time$/i }))
    await user.click(screen.getByRole('button', { name: '10:30' }))

    expect(onTimeChange).toHaveBeenCalledWith('10:30')
  })

  it('does not render clear action', async () => {
    const user = userEvent.setup()

    render(<DateTimePicker dateValue="2026-01-20" timeValue="10:30" onDateChange={vi.fn()} onTimeChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /jan/i }))
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })

  it('uses fluid trigger width classes', () => {
    render(<DateTimePicker dateValue={null} timeValue={null} onDateChange={vi.fn()} onTimeChange={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: /select date/i })
    expect(trigger.className).toContain('w-full')
    expect(trigger.className).not.toContain('w-[212px]')
  })

  it('renders 5-minute stepping options', async () => {
    const user = userEvent.setup()
    render(<DateTimePicker dateValue={null} timeValue={null} onDateChange={vi.fn()} onTimeChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /^time$/i }))

    expect(screen.getByRole('button', { name: '00:05' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '00:01' })).not.toBeInTheDocument()
  })
})
