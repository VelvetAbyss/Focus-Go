import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import {
  PAYMENT_CHANNELS,
  applyPaidOrder,
  buildZPayRequest,
  capturePayPalCheckoutOrder,
  createPayPalCheckoutOrder,
  createPaymentOrder,
  createUnifiedPaymentOrder,
  extractPayPalCapture,
  getPaymentOrderByOutTradeNo,
  getPaymentOrderByOrderNo,
  getMembershipStatus,
  getPlanConfig,
  getPremiumSku,
  markOrderPaid,
  requestZPayOrder,
  recordPaymentEvent,
  verifyPayPalWebhookSignature,
  verifyZPaySignature,
} from '../services/payments.js'

const router = Router()

const getNotifyBaseUrl = () => process.env.ZPAY_NOTIFY_BASE_URL || 'https://api.nestflow.art'
const getReturnBaseUrl = () => process.env.ZPAY_RETURN_BASE_URL || 'https://api.nestflow.art'
const getAppBaseUrl = () => process.env.APP_BASE_URL || 'https://app.nestflow.art'

const currentUserIds = (req) => new Set([
  String(req.auth.user.id),
  req.auth.user.authing_id,
  req.auth.user.auth_user_id,
].filter(Boolean))

const serializeOrder = (order, membership) => ({
  orderNo: order.order_no ?? order.out_trade_no,
  status: order.status,
  planId: order.plan_id ?? (order.sku === 'lifetime' ? 'lifetime' : 'pro_monthly'),
  amount: order.gross_amount ?? order.amount,
  currency: order.currency ?? 'CNY',
  channel: order.channel ?? order.pay_type,
  providerOrderId: order.provider_order_id ?? null,
  providerPaymentId: order.provider_payment_id ?? order.zpay_trade_no ?? null,
  paidAt: order.paid_at ? new Date(order.paid_at).toISOString() : null,
  abnormalReason: order.abnormal_reason ?? null,
  plan: membership?.plan ?? 'free',
  entitlement: membership?.entitlement ?? 'free',
  expiresAt: membership?.expiresAt ?? null,
  isLifetime: membership?.isLifetime ?? false,
})

const buildZPayCheckout = async (order) => {
  const pid = process.env.ZPAY_PID
  const key = process.env.ZPAY_KEY
  if (!pid || !key) throw new Error('zpay is not configured')

  const product = getPlanConfig(order.plan_id ?? 'pro_monthly')
  const params = buildZPayRequest({
    pid,
    key,
    notifyBaseUrl: getNotifyBaseUrl(),
    returnBaseUrl: getReturnBaseUrl(),
    payType: 'alipay',
    outTradeNo: order.orderNo,
    amount: order.amount,
    name: product.name,
  })
  const zpay = await requestZPayOrder(params)
  return {
    orderNo: order.orderNo,
    outTradeNo: order.orderNo,
    status: order.status,
    channel: PAYMENT_CHANNELS.ZPAY_ALIPAY,
    amount: order.amount,
    currency: order.currency,
    payUrl: zpay.payurl || zpay.url || undefined,
    qrcode: zpay.qrcode || undefined,
    img: zpay.img || undefined,
  }
}

router.post('/orders', requireAuth, async (req, res) => {
  const { planId = 'pro_monthly', channel } = req.body ?? {}
  if (!['pro_monthly', 'pro_yearly', 'lifetime'].includes(planId)) return res.status(400).json({ error: 'invalid planId' })
  if (![PAYMENT_CHANNELS.ZPAY_ALIPAY, PAYMENT_CHANNELS.PAYPAL_CHECKOUT].includes(channel)) {
    return res.status(400).json({ error: 'invalid channel' })
  }

  try {
    const order = createUnifiedPaymentOrder(db, {
      userId: String(req.auth.user.id),
      planId,
      channel,
    })

    if (channel === PAYMENT_CHANNELS.ZPAY_ALIPAY) {
      return res.json(await buildZPayCheckout(order))
    }

    const paypal = await createPayPalCheckoutOrder({
      orderNo: order.orderNo,
      amount: order.amount,
      currency: order.currency,
      name: order.plan.name,
    })
    db.prepare(`
      UPDATE payment_orders
      SET provider_order_id = ?, updated_at = ?
      WHERE order_no = ?
    `).run(paypal.id, Date.now(), order.orderNo)
    return res.json({
      orderNo: order.orderNo,
      status: order.status,
      channel,
      amount: order.amount,
      currency: order.currency,
      paypalOrderId: paypal.id,
    })
  } catch (error) {
    console.error('[payment] create unified order error', error)
    return res.status(500).json({ error: error.message })
  }
})

router.post('/zpay/create-order', requireAuth, async (req, res) => {
  const { payType, sku = 'premium-month' } = req.body ?? {}
  if (!['alipay', 'wxpay'].includes(payType)) {
    return res.status(400).json({ error: 'invalid payType' })
  }

  const pid = process.env.ZPAY_PID
  const key = process.env.ZPAY_KEY
  if (!pid || !key) {
    return res.status(500).json({ error: 'zpay is not configured' })
  }

  try {
    const order = createPaymentOrder(db, {
      userId: String(req.auth.user.id),
      sku,
      payType,
    })
    console.log(`[payment] create order out_trade_no=${order.outTradeNo} user=${req.auth.user.id} sku=${order.sku} amount=${order.amount} payType=${payType}`)

    const product = getPremiumSku(order.sku)
    const params = buildZPayRequest({
      pid,
      key,
      notifyBaseUrl: getNotifyBaseUrl(),
      returnBaseUrl: getReturnBaseUrl(),
      payType,
      outTradeNo: order.outTradeNo,
      amount: order.amount,
      name: product.name,
    })
    const zpay = await requestZPayOrder(params)
    console.log(`[payment] zpay raw response:`, JSON.stringify(zpay))

    res.json({
      outTradeNo: order.outTradeNo,
      payUrl: zpay.payurl || zpay.url || undefined,
      qrcode: zpay.qrcode || undefined,
      img: zpay.img || undefined,
    })
  } catch (error) {
    console.error('[payment] create order error', error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/zpay/return', (req, res) => {
  const outTradeNo = typeof req.query.out_trade_no === 'string' ? req.query.out_trade_no : ''
  const target = new URL('/premium/success', getAppBaseUrl())
  if (outTradeNo) target.searchParams.set('out_trade_no', outTradeNo)
  res.redirect(target.toString())
})

const handleZPayNotify = (req, res) => {
  // ZPay may send notify via GET or POST
  const params = Object.keys(req.body ?? {}).length > 0 ? req.body : req.query

  const key = process.env.ZPAY_KEY
  if (!key) return res.status(500).send('zpay key missing')

  console.log(`[payment] notify received out_trade_no=${params.out_trade_no} trade_status=${params.trade_status} money=${params.money}`)

  if (!verifyZPaySignature(params, key)) {
    console.warn(`[payment] notify signature mismatch out_trade_no=${params.out_trade_no}`)
    return res.status(400).send('fail')
  }

  const outTradeNo = typeof params.out_trade_no === 'string' ? params.out_trade_no : ''
  const tradeNo = typeof params.trade_no === 'string' ? params.trade_no : ''
  const tradeStatus = typeof params.trade_status === 'string' ? params.trade_status : ''
  const money = typeof params.money === 'string' ? params.money : ''
  const type = typeof params.type === 'string' ? params.type : ''

  if (!outTradeNo || !tradeNo || !money || !type) return res.status(400).send('fail')
  if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) return res.status(400).send('fail')

  try {
    const result = markOrderPaid(db, {
      outTradeNo,
      zpayTradeNo: tradeNo,
      money,
      payType: type,
      rawPayload: params,
    })
    if (result.applied) {
      console.log(`[payment] notify processed out_trade_no=${outTradeNo} plan=${result.plan} expiresAt=${result.expiresAt}`)
    } else {
      console.log(`[payment] notify duplicate (already paid) out_trade_no=${outTradeNo}`)
    }
    return res.send('success')
  } catch (error) {
    console.error('[payment] notify processing error', error)
    return res.status(400).send('fail')
  }
}

router.get('/zpay/notify', handleZPayNotify)
router.post('/zpay/notify', handleZPayNotify)

router.get('/zpay/order/:outTradeNo', requireAuth, (req, res) => {
  const order = getPaymentOrderByOutTradeNo(db, req.params.outTradeNo)
  if (!order || !currentUserIds(req).has(order.user_id)) {
    return res.status(404).json({ error: 'order not found' })
  }
  res.json(serializeOrder(order, getMembershipStatus(db, req.auth.user.id)))
})

router.get('/orders/:orderNo', requireAuth, (req, res) => {
  const order = getPaymentOrderByOrderNo(db, req.params.orderNo)
  if (!order || !currentUserIds(req).has(order.user_id)) {
    return res.status(404).json({ error: 'order not found' })
  }
  res.json(serializeOrder(order, getMembershipStatus(db, req.auth.user.id)))
})

router.post('/paypal/capture', requireAuth, async (req, res) => {
  const { orderNo, paypalOrderId } = req.body ?? {}
  if (!orderNo || !paypalOrderId) return res.status(400).json({ error: 'missing paypal order' })
  const order = getPaymentOrderByOrderNo(db, orderNo)
  if (!order || !currentUserIds(req).has(order.user_id)) return res.status(404).json({ error: 'order not found' })
  if (order.provider_order_id && order.provider_order_id !== paypalOrderId) return res.status(400).json({ error: 'paypal order mismatch' })

  try {
    const captured = await capturePayPalCheckoutOrder(paypalOrderId)
    const details = extractPayPalCapture(captured)
    if (details.status !== 'COMPLETED') return res.status(400).json({ error: 'paypal order not completed', status: details.status })
    if (details.orderNo !== orderNo) return res.status(400).json({ error: 'paypal reference mismatch' })
    recordPaymentEvent(db, {
      eventKey: `paypal:capture:${details.providerPaymentId ?? paypalOrderId}`,
      orderNo,
      channel: PAYMENT_CHANNELS.PAYPAL_CHECKOUT,
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      rawPayload: captured,
    })
    const result = applyPaidOrder(db, {
      orderNo,
      channel: PAYMENT_CHANNELS.PAYPAL_CHECKOUT,
      providerOrderId: details.providerOrderId,
      providerPaymentId: details.providerPaymentId,
      grossAmount: details.grossAmount,
      currency: details.currency,
      feeAmount: details.feeAmount,
      netAmount: details.netAmount,
      rawPayload: captured,
    })
    return res.json(result)
  } catch (error) {
    console.error('[payment] paypal capture error', error)
    return res.status(400).json({ error: error.message })
  }
})

router.post('/paypal/webhook', async (req, res) => {
  try {
    const verified = await verifyPayPalWebhookSignature({ headers: req.headers, body: req.body })
    if (!verified) return res.status(400).send('fail')

    const eventId = req.body?.id
    const eventType = req.body?.event_type
    const resource = req.body?.resource
    const details = extractPayPalCapture(resource)
    const eventKey = `paypal:webhook:${eventId || details.providerPaymentId || crypto.randomUUID?.() || Date.now()}`
    const inserted = recordPaymentEvent(db, {
      eventKey,
      orderNo: details.orderNo,
      channel: PAYMENT_CHANNELS.PAYPAL_CHECKOUT,
      eventType: eventType || 'paypal.webhook',
      rawPayload: req.body,
    })
    if (!inserted) return res.send('success')

    if (details.orderNo && (eventType === 'PAYMENT.CAPTURE.COMPLETED' || resource?.status === 'COMPLETED')) {
      applyPaidOrder(db, {
        orderNo: details.orderNo,
        channel: PAYMENT_CHANNELS.PAYPAL_CHECKOUT,
        providerOrderId: details.providerOrderId,
        providerPaymentId: details.providerPaymentId,
        grossAmount: details.grossAmount,
        currency: details.currency,
        feeAmount: details.feeAmount,
        netAmount: details.netAmount,
        rawPayload: req.body,
      })
    }
    return res.send('success')
  } catch (error) {
    console.error('[payment] paypal webhook error', error)
    return res.status(400).send('fail')
  }
})

export default router
