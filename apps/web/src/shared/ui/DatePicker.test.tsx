// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DatePicker } from './DatePicker'

vi.mock('../i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../i18n/testMock')
  return { useI18n: mockUseI18n }
})

vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ mode, onSelect }: { mode?: string; onSelect?: (value: Date | undefined) => void }) => (
    <div data-testid={`calendar-${mode ?? 'single'}`}>
      <button type="button" onClick={() => onSelect?.(new Date(2026, 0, 15, 12, 0, 0, 0))}>
        Choose date
      </button>
    </div>
  ),
}))

afterEach(() => {
  cleanup()
})

describe('DatePicker', () => {
  it('uses fixed select-date copy when empty', () => {
    render(<DatePicker value={null} onChange={vi.fn()} placeholder="Set due date" />)
    expect(screen.getByRole('button', { name: /select date/i })).toBeInTheDocument()
  })

  it('ignores placeholder copy for trigger text', () => {
    render(<DatePicker value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /select date/i })).toBeInTheDocument()
  })

  it('treats invalid date key as empty', () => {
    render(<DatePicker value="2026-99-99" onChange={vi.fn()} placeholder="Set date" />)
    expect(screen.getByRole('button', { name: /select date/i })).toBeInTheDocument()
  })

  it('uses fluid trigger width classes', () => {
    render(<DatePicker value={null} onChange={vi.fn()} placeholder="Set date" />)
    const trigger = screen.getByRole('button', { name: /select date/i })
    expect(trigger.className).toContain('w-full')
    expect(trigger.className).not.toContain('w-[212px]')
  })

  it('emits YYYY-MM-DD after selecting a date', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DatePicker value={null} onChange={onChange} placeholder="Set date" />)

    await user.click(screen.getByRole('button', { name: /select date/i }))
    await user.click(screen.getByRole('button', { name: 'Choose date' }))

    expect(onChange).toHaveBeenCalledWith('2026-01-15')
  })

  it('does not render clear action', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<DatePicker value="2026-01-15" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /jan/i }))

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalledWith(null)
  })
})
