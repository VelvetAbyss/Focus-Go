// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Circle } from 'lucide-react'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders content and action', () => {
    const onAction = vi.fn()

    render(
      <EmptyState
        icon={<Circle />}
        title="Empty"
        description="Nothing yet"
        actionLabel="Create"
        onAction={onAction}
      />,
    )

    expect(screen.getByText('Empty')).toBeInTheDocument()
    expect(screen.getByText('Nothing yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
