import { createZpayOrder, type PayType } from './paymentApi'

export const startPremiumCheckout = async (payType: PayType) => {
  const order = await createZpayOrder(payType)
  const target = order.payUrl ?? order.qrcode ?? order.img
  if (!target) throw new Error('missing payment target')
  window.location.assign(target)
}
