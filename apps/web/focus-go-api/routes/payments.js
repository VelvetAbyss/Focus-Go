import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import {
  buildZPayRequest,
  createPaymentOrder,
  getPaymentOrderByOutTradeNo,
  getPremiumSku,
  markOrderPaid,
  requestZPayOrder,
  verifyZPaySignature,
} from '../services/payments.js'

const router = Router()

const getNotifyBaseUrl = () => process.env.ZPAY_NOTIFY_BASE_URL || 'https://api.nestflow.art'
const getReturnBaseUrl = () => process.env.ZPAY_RETURN_BASE_URL || 'https://api.nestflow.art'
const getAppBaseUrl = () => process.env.APP_BASE_URL || 'https://app.nestflow.art'

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
      userId: req.auth.authingUser.sub,
      sku,
      payType,
    })
    console.log(`[payment] create order out_trade_no=${order.outTradeNo} user=${req.auth.authingUser.sub} sku=${order.sku} amount=${order.amount} payType=${payType}`)

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
    console.log(`[payment] zpay response out_trade_no=${order.outTradeNo} payurl=${zpay.payurl ?? zpay.url ?? 'none'} code=${zpay.code}`)

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
  if (!order || order.user_id !== req.auth.authingUser.sub) {
    return res.status(404).json({ error: 'order not found' })
  }
  const user = db.prepare('SELECT plan, premium_expires_at FROM users WHERE authing_id = ?').get(order.user_id)
  res.json({
    status: order.status,
    plan: user?.plan ?? 'free',
    expiresAt: user?.premium_expires_at ? new Date(user.premium_expires_at).toISOString() : null,
  })
})

export default router
