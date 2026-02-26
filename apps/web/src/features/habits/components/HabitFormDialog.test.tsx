// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HabitFormDialog } from './HabitFormDialog'

afterEach(() => {
  cleanup()
})

describe('HabitFormDialog', () => {
  it('validates required title', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<HabitFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /save|保存/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Title is required|请输入标题/i)).toBeInTheDocument()
  })

  it('submits a valid form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<HabitFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/title|标题/i), { target: { value: 'Drink Water' } })
    await user.click(screen.getByRole('button', { name: /save|保存/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
