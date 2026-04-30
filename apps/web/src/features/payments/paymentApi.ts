import { getAuth } from '../../store/auth'
import { fetchApi } from '../../shared/apiBase'

export type PayType = 'alipay' | 'wxpay'
export type PlanId = 'pro_monthly' | 'pro_yearly' | 'lifetime'
export type PaymentChannel = 'zpay_alipay' | 'paypal_checkout'

export type CreateZpayOrderResponse = {
  orderNo?: string
  outTradeNo: string
  payUrl?: string
  qrcode?: string
  img?: string
}

export type CreatePaymentOrderResponse = {
  orderNo: string
  outTradeNo?: string
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'abnormal' | 'refunded'
  channel: PaymentChannel
  amount: string
  currency: 'CNY' | 'USD'
  payUrl?: string
  qrcode?: string
  img?: string
  paypalOrderId?: string
}

export type PaymentOrderStatus = {
  orderNo?: string
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'abnormal' | 'refunded'
  plan?: 'free' | 'premium'
  entitlement?: 'free' | 'pro' | 'lifetime'
  expiresAt?: string | null
  isLifetime?: boolean
}

export class RegionMismatchError extends Error {
  readonly preferredChannel: PaymentChannel
  constructor(preferredChannel: PaymentChannel) {
    super('channel unavailable for region')
    this.preferredChannel = preferredChannel
  }
}

const getAccessToken = () => {
  const auth = getAuth()
  if (!auth?.accessToken) throw new Error('missing access token')
  return auth.accessToken as string
}

export const createZpayOrder = async (payType: PayType): Promise<CreateZpayOrderResponse> => {
  const response = await fetchApi('/payments/zpay/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({
      sku: 'premium-month',
      payType,
    }),
  })
  if (!response.ok) throw new Error('failed to create order')
  return await response.json() as CreateZpayOrderResponse
}

export const createPaymentOrder = async (planId: PlanId, channel: PaymentChannel): Promise<CreatePaymentOrderResponse> => {
  const response = await fetchApi('/payments/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ planId, channel }),
  })
  if (!response.ok) {
    try {
      const body = await response.json() as { error?: string; preferredChannel?: string }
      if (body.preferredChannel && ['zpay_alipay', 'paypal_checkout'].includes(body.preferredChannel)) {
        throw new RegionMismatchError(body.preferredChannel as PaymentChannel)
      }
      if (body.error) throw new Error(body.error)
    } catch (e) {
      if (e instanceof RegionMismatchError) throw e
    }
    throw new Error(`failed to create order (${response.status})`)
  }
  return await response.json() as CreatePaymentOrderResponse
}

export const fetchPaymentOrderStatus = async (outTradeNo: string): Promise<PaymentOrderStatus> => {
  const response = await fetchApi(`/payments/orders/${outTradeNo}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  })
  if (!response.ok) throw new Error('failed to fetch order')
  return await response.json() as PaymentOrderStatus
}

export const capturePaypalOrder = async (orderNo: string, paypalOrderId: string) => {
  const response = await fetchApi('/payments/paypal/capture', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken()}`,
    },
    body: JSON.stringify({ orderNo, paypalOrderId }),
  })
  if (!response.ok) throw new Error('failed to capture paypal order')
  return await response.json() as { applied: boolean; plan: 'free' | 'premium'; entitlement?: 'free' | 'pro' | 'lifetime'; expiresAt?: string | null; isLifetime?: boolean }
}
