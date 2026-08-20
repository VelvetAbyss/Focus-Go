// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { PremiumProvider, usePremiumGate } from './PremiumProvider'

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
    window.localStorage.clear()
  })

  it('keeps legacy gate calls as no-ops while allowing the feature', async () => {
    render(
      <PremiumProvider>
        <Trigger />
      </PremiumProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open upgrade' }))
    expect(screen.queryByText('Upgrade to Premium')).not.toBeInTheDocument()
  })
})
