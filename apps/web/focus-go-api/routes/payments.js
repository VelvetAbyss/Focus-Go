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
  const { payType, sku = 'premium-month-test' } = req.body ?? {}
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

    res.json({
      outTradeNo: order.outTradeNo,
      payUrl: zpay.payurl || zpay.url || undefined,
      qrcode: zpay.qrcode || undefined,
      img: zpay.img || undefined,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
})

router.get('/zpay/return', (req, res) => {
  const outTradeNo = typeof req.query.out_trade_no === 'string' ? req.query.out_trade_no : ''
  const target = new URL('/premium/success', getAppBaseUrl())
  if (outTradeNo) target.searchParams.set('out_trade_no', outTradeNo)
  res.redirect(target.toString())
})

router.get('/zpay/notify', (req, res) => {
  const key = process.env.ZPAY_KEY
  if (!key) return res.status(500).send('zpay key missing')
  if (!verifyZPaySignature(req.query, key)) return res.status(400).send('invalid sign')

  const outTradeNo = typeof req.query.out_trade_no === 'string' ? req.query.out_trade_no : ''
  const tradeNo = typeof req.query.trade_no === 'string' ? req.query.trade_no : ''
  const tradeStatus = typeof req.query.trade_status === 'string' ? req.query.trade_status : ''
  const money = typeof req.query.money === 'string' ? req.query.money : ''
  const type = typeof req.query.type === 'string' ? req.query.type : ''

  if (!outTradeNo || !tradeNo || !money || !type) return res.status(400).send('invalid payload')
  if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) return res.status(400).send('invalid trade status')

  try {
    markOrderPaid(db, {
      outTradeNo,
      zpayTradeNo: tradeNo,
      money,
      payType: type,
      rawPayload: req.query,
    })
    return res.send('success')
  } catch (error) {
    console.error(error)
    return res.status(400).send(error.message)
  }
})

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
