// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

vi.mock('../../../shared/ui/AppNumber', () => ({
  AppNumber: ({ value }: { value: number }) => <span>{value}</span>,
}))

const habit: Habit = {
  id: 'habit-1',
  userId: 'local-user',
  title: 'Drink Water',
  type: 'boolean',
  color: '#7edbc7',
  archived: false,
  freezesAllowed: 1,
  sortOrder: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

describe('HabitCard', () => {
  it('calls completion handler when complete icon is clicked', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn().mockResolvedValue(undefined)

    render(
      <HabitCard
        habit={habit}
        streak={3}
        completed={false}
        archived={false}
        onComplete={onComplete}
        onArchive={vi.fn().mockResolvedValue(undefined)}
        onRestore={vi.fn().mockResolvedValue(undefined)}
        onEdit={vi.fn()}
        onMoveUp={vi.fn().mockResolvedValue(undefined)}
        onMoveDown={vi.fn().mockResolvedValue(undefined)}
      />, 
    )

    await user.click(screen.getByRole('button', { name: /complete|完成/i }))

    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
