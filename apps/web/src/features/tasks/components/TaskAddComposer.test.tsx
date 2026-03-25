// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

import TaskAddComposer from './TaskAddComposer'

describe('TaskAddComposer', () => {
  it('submits a trimmed title and resets the field after success', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (title: string) => title === 'New task')

    render(<TaskAddComposer onSubmit={onSubmit} />)

    const input = screen.getByPlaceholderText('Add a new task...')
    await user.type(input, '  New task  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(onSubmit).toHaveBeenCalledWith('New task')
    expect(input).toHaveValue('')
  })
})
