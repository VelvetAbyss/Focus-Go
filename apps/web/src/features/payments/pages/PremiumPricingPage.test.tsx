// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PremiumPricingPage from './PremiumPricingPage'

const mockStartCheckout = vi.fn(async (payType: 'alipay' | 'wxpay') => {
  void payType
  return undefined
})

vi.mock('../paymentFlow', () => ({
  startPremiumCheckout: (payType: 'alipay' | 'wxpay') => mockStartCheckout(payType),
}))

describe('PremiumPricingPage', () => {
  beforeEach(() => {
    mockStartCheckout.mockReset()
  })

  it('starts checkout from the pricing page', async () => {
    render(
      <MemoryRouter>
        <PremiumPricingPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /支付宝/i }))
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalledWith('alipay'))
  })
})
