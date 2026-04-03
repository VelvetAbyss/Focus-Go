import { prepareAuthSession } from '../../config/auth'
import { getAuth } from '../../store/auth'
import { createZpayOrder, type CreateZpayOrderResponse, type PayType } from './paymentApi'

const PENDING_CHECKOUT_KEY = 'focusgo.pendingCheckout'

/**
 * Starts the premium checkout flow.
 * - If unauthenticated: saves pending checkout and redirects to login. Returns null.
 * - If authenticated + qrcode available: returns order data so the caller can show a QR modal.
 * - If authenticated + only payUrl: navigates directly to the payment URL and returns null.
 */
export const startPremiumCheckout = async (payType: PayType): Promise<CreateZpayOrderResponse | null> => {
  const auth = getAuth()
  if (!auth?.accessToken) {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, payType)
    window.location.href = await prepareAuthSession()
    return null
  }

  const order = await createZpayOrder(payType)

  // Desktop: show QR code modal so user can scan instead of landing on WAP page
  if (order.qrcode) return order

  // Mobile fallback: redirect to WAP payment URL
  const target = order.payUrl ?? order.img
  if (!target) throw new Error('missing payment target')
  window.location.assign(target)
  return null
}

export const consumePendingCheckout = (): PayType | null => {
  if (typeof sessionStorage === 'undefined') return null
  const next = sessionStorage.getItem(PENDING_CHECKOUT_KEY)
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
  if (next === 'alipay' || next === 'wxpay') return next
  return null
}
