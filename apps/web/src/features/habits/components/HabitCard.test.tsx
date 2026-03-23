// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

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

const habit: Habit = {
  id: 'habit-1',
  userId: 'local-user',
  title: 'Drink Water',
  description: 'Stay hydrated',
  icon: '💧',
  type: 'boolean',
  color: '#7edbc7',
  archived: false,
  freezesAllowed: 1,
  sortOrder: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('HabitCard', () => {
  it('calls completion handler when today button is clicked', async () => {
    const user = userEvent.setup()
    const onToggleToday = vi.fn().mockResolvedValue(undefined)

    render(
      <HabitCard
        habit={habit}
        completedDates={[]}
        onToggleToday={onToggleToday}
        onToggleDate={vi.fn().mockResolvedValue(undefined)}
        onArchive={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    await user.click(screen.getByRole('button', { name: /mark today complete|标记今日完成/i }))

    expect(onToggleToday).toHaveBeenCalledTimes(1)
  })
})
