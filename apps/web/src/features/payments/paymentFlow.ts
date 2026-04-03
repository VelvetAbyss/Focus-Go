import { prepareAuthSession } from '../../config/auth'
import { getAuth } from '../../store/auth'
import { createZpayOrder, type PayType } from './paymentApi'

const PENDING_CHECKOUT_KEY = 'focusgo.pendingCheckout'

export const startPremiumCheckout = async (payType: PayType) => {
  const auth = getAuth()
  if (!auth?.accessToken) {
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, payType)
    window.location.href = await prepareAuthSession()
    return
  }

  const order = await createZpayOrder(payType)
  const target = order.payUrl ?? order.qrcode ?? order.img
  if (!target) throw new Error('missing payment target')
  window.location.assign(target)
}

export const consumePendingCheckout = (): PayType | null => {
  if (typeof sessionStorage === 'undefined') return null
  const next = sessionStorage.getItem(PENDING_CHECKOUT_KEY)
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
  if (next === 'alipay' || next === 'wxpay') return next
  return null
}
