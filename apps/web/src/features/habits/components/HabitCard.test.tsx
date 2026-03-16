// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Habit } from '../../../data/models/types'
import { HabitCard } from './HabitCard'

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
