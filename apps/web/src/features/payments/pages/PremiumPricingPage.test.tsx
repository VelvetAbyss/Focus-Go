// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PremiumPricingPage from './PremiumPricingPage'

const mockCreatePaymentOrder = vi.fn()

vi.mock('../../../store/auth', async () => {
  const actual = await vi.importActual('../../../store/auth')
  return {
    ...actual,
    getAuth: () => ({ accessToken: 'token' }),
  }
})

vi.mock('../paymentApi', () => ({
  createPaymentOrder: (planId: string, channel: string) => mockCreatePaymentOrder(planId, channel),
  fetchPaymentOrderStatus: vi.fn(),
  capturePaypalOrder: vi.fn(),
}))

describe('PremiumPricingPage', () => {
  beforeEach(() => {
    mockCreatePaymentOrder.mockReset()
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      locale: 'zh-CN',
      calendar: 'gregory',
      numberingSystem: 'latn',
      timeZone: 'Asia/Shanghai',
    } as Intl.ResolvedDateTimeFormatOptions)
    mockCreatePaymentOrder.mockResolvedValue({
      orderNo: 'order-1',
      status: 'pending',
      channel: 'zpay_alipay',
      amount: '15.00',
      currency: 'CNY',
      qrcode: 'https://pay.example/qr',
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts checkout from the pricing page', async () => {
    render(
      <MemoryRouter>
        <PremiumPricingPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getAllByRole('button', { name: /支付宝支付/i })[0])
    await waitFor(() => expect(mockCreatePaymentOrder).toHaveBeenCalledWith('pro_monthly', 'zpay_alipay'))
  })
})
