// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PremiumProvider, usePremiumGate } from './PremiumProvider'

const openMock = vi.fn()

vi.stubGlobal('open', openMock)

const Trigger = () => {
  const { openUpgradeModal } = usePremiumGate()
  return (
    <button type="button" onClick={() => openUpgradeModal('button', 'tasks.subtasks')}>
      Open upgrade
    </button>
  )
}

describe('PremiumProvider', () => {
  beforeEach(() => {
    openMock.mockReset()
    window.localStorage.clear()
  })

  it('opens modal and jumps to payment url after confirmation', async () => {
    render(
      <PremiumProvider>
        <Trigger />
      </PremiumProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open upgrade' }))
    expect(await screen.findByText('Upgrade to Premium')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Upgrade now' }))
    expect(openMock).toHaveBeenCalledWith('https://focus-go.app/premium', '_blank', 'noopener,noreferrer')
  })
})
