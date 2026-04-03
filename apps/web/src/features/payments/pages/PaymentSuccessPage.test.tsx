// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaymentSuccessPage from './PaymentSuccessPage'

const mockFetchOrderStatus = vi.fn()
const mockRefreshAuth = vi.fn(async () => ({ plan: 'premium', expiresAt: '2026-05-01T00:00:00.000Z' }))

vi.mock('../paymentApi', () => ({
  fetchPaymentOrderStatus: (outTradeNo: string) => mockFetchOrderStatus(outTradeNo),
}))

vi.mock('../../../store/auth', async () => {
  const actual = await vi.importActual('../../../store/auth')
  return {
    ...actual,
    refreshAuthProfile: () => mockRefreshAuth(),
  }
})

describe('PaymentSuccessPage', () => {
  beforeEach(() => {
    mockFetchOrderStatus.mockReset()
    mockRefreshAuth.mockReset()
    mockRefreshAuth.mockResolvedValue({ plan: 'premium', expiresAt: '2026-05-01T00:00:00.000Z' })
  })

  it('polls order status and refreshes auth when payment is confirmed', async () => {
    mockFetchOrderStatus
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'paid', plan: 'premium', expiresAt: '2026-05-01T00:00:00.000Z' })

    render(
      <MemoryRouter initialEntries={['/premium/success?out_trade_no=order-1']}>
        <Routes>
          <Route path="/premium/success" element={<PaymentSuccessPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockFetchOrderStatus).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mockRefreshAuth).toHaveBeenCalled())
    expect(await screen.findByText(/Premium 已开通|Premium activated/i)).toBeInTheDocument()
  })
})
