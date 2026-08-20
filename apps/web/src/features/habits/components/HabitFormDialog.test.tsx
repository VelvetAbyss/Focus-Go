// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HabitFormDialog } from './HabitFormDialog'

vi.mock('../habitsI18n', () => ({
  useHabitsI18n: () => ({
    title: 'Habit Tracker',
    subtitle: 'Build better routines one quiet day at a time.',
    addHabit: 'Add New Habit',
    emptyTitle: 'No habits yet',
    emptyDescription: 'Add your first habit to start building momentum.',
    todayCompleted: 'Completed Today',
    markToday: 'Mark Today Complete',
    hideCalendar: 'Hide Calendar',
    showCalendar: 'View Calendar',
    progress: 'Progress',
    completed: 'Completed',
    heatmap: 'Heatmap',
    stats: 'Stats',
    activeCount: 'Active',
    streak: 'Streak',
    completionRate: 'Rate',
    total: 'Total',
    archived: 'Archived',
    restore: 'Restore',
    remove: 'Archive',
    undo: 'Undo',
    toastCompleted: 'Habit completed.',
    toastUndone: 'Completion undone.',
    toastArchived: 'Habit archived.',
    toastRestored: 'Habit restored.',
    formTitleCreate: 'Add New Habit',
    formTitleEdit: 'Edit Habit',
    formName: 'Habit Name',
    formNamePlaceholder: 'Daily Reading',
    formDescription: 'Description',
    formDescriptionPlaceholder: 'Add a short note...',
    formIcon: 'Choose Icon',
    formColor: 'Choose Color',
    formPreview: 'Preview:',
    formCancel: 'Cancel',
    formSubmitCreate: 'Add Habit',
    formSubmitSave: 'Save Habit',
    formValidationName: 'Habit name is required.',
  }),
}))

afterEach(() => {
  cleanup()
})

describe('HabitFormDialog', () => {
  it('validates required title', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<HabitFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /add habit|添加习惯/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/Habit name is required|请输入习惯名称/i)).toBeInTheDocument()
  })

  it('submits a valid form', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onOpenChange = vi.fn()

    render(<HabitFormDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/habit name|习惯名称/i), { target: { value: 'Drink Water' } })
    await user.click(screen.getByRole('button', { name: /add habit|添加习惯/i }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })
})
