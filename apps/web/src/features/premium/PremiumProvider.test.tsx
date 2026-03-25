// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PremiumProvider, usePremiumGate } from './PremiumProvider'

const upgradeMock = vi.fn().mockResolvedValue(true)

vi.mock('../../store/auth', () => ({
  useAuthPlan: () => 'free',
  upgradeToPremium: (...args: unknown[]) => upgradeMock(...args),
}))

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
    upgradeMock.mockReset()
    upgradeMock.mockResolvedValue(true)
    window.localStorage.clear()
  })

  it('opens modal and calls upgradeToPremium after confirmation', async () => {
    render(
      <PremiumProvider>
        <Trigger />
      </PremiumProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open upgrade' }))
    expect(await screen.findByText('Upgrade to Premium')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Upgrade now' }))
    expect(upgradeMock).toHaveBeenCalled()
  })
})
