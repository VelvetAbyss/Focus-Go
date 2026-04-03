import { getAuth } from '../../store/auth'

export type PayType = 'alipay' | 'wxpay'

export type CreateZpayOrderResponse = {
  outTradeNo: string
  payUrl?: string
  qrcode?: string
  img?: string
}

export type PaymentOrderStatus = {
  status: 'pending' | 'paid' | 'failed'
  plan?: 'free' | 'premium'
  expiresAt?: string | null
}

const getAccessToken = () => {
  const auth = getAuth()
  if (!auth?.accessToken) throw new Error('missing access token')
  return auth.accessToken as string
}

export const createZpayOrder = async (payType: PayType): Promise<CreateZpayOrderResponse> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE}/payments/zpay/create-order`, {
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

export const fetchPaymentOrderStatus = async (outTradeNo: string): Promise<PaymentOrderStatus> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE}/payments/zpay/order/${outTradeNo}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
    },
  })
  if (!response.ok) throw new Error('failed to fetch order')
  return await response.json() as PaymentOrderStatus
}
