// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/i18n/useI18n', async () => {
  const { mockUseI18n } = await import('../../../shared/i18n/testMock')
  return { useI18n: mockUseI18n }
})

vi.mock('../../../shared/ui/toast/toast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/ui/toast/toast')>()
  return {
    ...actual,
    useToast: () => ({ push: vi.fn() }),
  }
})

import TaskAddComposer from './TaskAddComposer'

describe('TaskAddComposer', () => {
  it('submits a trimmed title and resets the field after success', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async (title: string) => title === 'New task')

    render(<TaskAddComposer onSubmit={onSubmit} />)

    const input = screen.getByPlaceholderText('Add a new task...')
    await user.type(input, '  New task  ')
    await user.click(screen.getByRole('button', { name: /Add/ }))

    expect(onSubmit.mock.calls[0][0]).toBe('New task')
    expect(input).toHaveValue('')
  })

  it('submits the selected project id when project picker is available', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => true)

    render(
      <TaskAddComposer
        onSubmit={onSubmit}
        projects={[
          {
            id: 'project-1',
            title: 'Lowes',
            description: '',
            goal: '',
            status: 'active',
            priority: null,
            health: 'on-track',
            progress: 0,
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        selectedProjectId="project-1"
        onProjectChange={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText('Add a new task...'), 'Project task')
    await user.click(screen.getByRole('button', { name: /Add/ }))

    expect(onSubmit).toHaveBeenCalledWith('Project task', undefined, 'project-1')
  })
})
