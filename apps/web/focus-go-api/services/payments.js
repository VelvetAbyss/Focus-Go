import crypto from 'node:crypto'

export const ZPAY_API_URL = 'https://zpayz.cn/mapi.php'

export const PAYMENT_CHANNELS = {
  ZPAY_ALIPAY: 'zpay_alipay',
  PAYPAL_CHECKOUT: 'paypal_checkout',
}

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  ABNORMAL: 'abnormal',
  REFUNDED: 'refunded',
}

export const MEMBERSHIP_PLANS = {
  PRO_MONTHLY: {
    id: 'pro_monthly',
    legacySku: 'premium-month',
    name: 'FocusGo Pro Monthly',
    entitlementType: 'pro',
    durationMonths: 1,
    prices: {
      CNY: '15.00',
      USD: '4.99',
    },
  },
  PRO_YEARLY: {
    id: 'pro_yearly',
    legacySku: 'premium-year',
    name: 'FocusGo Pro Yearly',
    entitlementType: 'pro',
    durationMonths: 12,
    prices: {
      CNY: '150.00',
      USD: '39.99',
    },
  },
  LIFETIME: {
    id: 'lifetime',
    legacySku: 'lifetime',
    name: 'FocusGo Lifetime',
    entitlementType: 'lifetime',
    durationMonths: null,
    prices: {
      CNY: '399.00',
      USD: '129.00',
    },
  },
}

const PREMIUM_MONTH_SKU = {
  sku: 'premium-month',
  amount: '15.00',
  months: 1,
  name: 'FocusGo Pro Membership',
}

const addMonths = (timestamp, months) => {
  const date = new Date(timestamp)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.getTime()
}

const normalizeAmount = (value) => Number(value).toFixed(2)

const nowIso = () => new Date().toISOString()

const getUserColumns = (db) => db.prepare("PRAGMA table_info('users')").all().map((column) => column.name)

const getUserByPaymentUserId = (db, userId) => {
  const columns = new Set(getUserColumns(db))
  const clauses = ['CAST(id AS TEXT) = ?', 'authing_id = ?']
  const params = [userId, userId]
  if (columns.has('auth_user_id')) {
    clauses.push('auth_user_id = ?')
    params.push(userId)
  }
  return db.prepare(`SELECT * FROM users WHERE ${clauses.join(' OR ')}`).get(...params)
}

const tableColumns = (db, table) => {
  try {
    return db.prepare(`PRAGMA table_info('${table}')`).all().map((column) => column.name)
  } catch {
    return []
  }
}

const addColumnIfMissing = (db, table, columns, definition) => {
  const name = definition.trim().split(/\s+/)[0]
  if (!columns.has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
    columns.add(name)
  }
}

export const ensurePaymentTables = (db) => {
  const userColumns = new Set(getUserColumns(db))
  if (!userColumns.has('premium_expires_at')) {
    db.exec('ALTER TABLE users ADD COLUMN premium_expires_at INTEGER')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      amount TEXT NOT NULL,
      months INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      out_trade_no TEXT NOT NULL UNIQUE,
      zpay_trade_no TEXT,
      pay_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      paid_at INTEGER,
      raw_notify_payload TEXT
    )
  `)

  const orderColumns = new Set(tableColumns(db, 'payment_orders'))
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'order_no TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'plan_id TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'currency TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'channel TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'provider_order_id TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'provider_payment_id TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'gross_amount TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'fee_amount TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'net_amount TEXT')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'expired_at INTEGER')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'updated_at INTEGER')
  addColumnIfMissing(db, 'payment_orders', orderColumns, 'abnormal_reason TEXT')

  db.exec(`
    UPDATE payment_orders
    SET order_no = COALESCE(order_no, out_trade_no),
        plan_id = COALESCE(plan_id, CASE WHEN sku = 'lifetime' THEN 'lifetime' ELSE 'pro_monthly' END),
        currency = COALESCE(currency, 'CNY'),
        channel = COALESCE(channel, CASE WHEN pay_type = 'alipay' THEN 'zpay_alipay' ELSE pay_type END),
        gross_amount = COALESCE(gross_amount, amount),
        updated_at = COALESCE(updated_at, created_at)
    WHERE order_no IS NULL OR plan_id IS NULL OR currency IS NULL OR channel IS NULL OR gross_amount IS NULL OR updated_at IS NULL
  `)
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS payment_orders_order_no_idx ON payment_orders(order_no)')
  db.exec('CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders(user_id)')
  db.exec('CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders(status)')
  db.exec('CREATE INDEX IF NOT EXISTS payment_orders_channel_idx ON payment_orders(channel)')

  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id TEXT PRIMARY KEY,
      event_key TEXT NOT NULL UNIQUE,
      order_no TEXT,
      channel TEXT NOT NULL,
      event_type TEXT NOT NULL,
      raw_payload TEXT,
      created_at INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS membership_entitlements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      source TEXT NOT NULL,
      order_no TEXT,
      starts_at INTEGER NOT NULL,
      expires_at INTEGER,
      is_lifetime INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS membership_entitlements_user_idx ON membership_entitlements(user_id)')
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS membership_entitlements_order_idx ON membership_entitlements(order_no) WHERE order_no IS NOT NULL')
}

const sortEntries = (params) =>
  Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && value !== '' && value != null)
    .sort(([a], [b]) => a.localeCompare(b))

export const signZPayParams = (params, key) => {
  const query = sortEntries(params)
    .map(([paramKey, value]) => `${paramKey}=${value}`)
    .join('&')
  return crypto.createHash('md5').update(`${query}${key}`).digest('hex')
}

export const verifyZPaySignature = (params, key) => {
  if (!params.sign) return false
  return signZPayParams(params, key).toLowerCase() === String(params.sign).toLowerCase()
}

export const getPremiumSku = (sku = PREMIUM_MONTH_SKU.sku) => {
  // Support legacy test SKU for backward compatibility
  if (sku !== PREMIUM_MONTH_SKU.sku && sku !== 'premium-month-test') throw new Error('unsupported sku')
  if (sku === 'premium-month-test') return { ...PREMIUM_MONTH_SKU, sku: 'premium-month', amount: '0.01' }
  return PREMIUM_MONTH_SKU
}

export const getPlanConfig = (planId = MEMBERSHIP_PLANS.PRO_MONTHLY.id) => {
  const plan = Object.values(MEMBERSHIP_PLANS).find((item) => item.id === planId || item.legacySku === planId)
  if (!plan) throw new Error('unsupported plan')
  return plan
}

export const getPlanPrice = (planId, currency) => {
  const plan = getPlanConfig(planId)
  const amount = plan.prices[currency]
  if (!amount) throw new Error('unsupported currency for plan')
  return amount
}

export const getMembershipStatus = (db, userId) => {
  const user = getUserByPaymentUserId(db, String(userId))
  if (!user) return { plan: 'free', entitlement: 'free', expiresAt: null, isLifetime: false }

  const now = Date.now()
  const lifetime = db.prepare(`
    SELECT * FROM membership_entitlements
    WHERE user_id = ? AND is_lifetime = 1
    ORDER BY created_at DESC
    LIMIT 1
  `).get(String(user.id))
  if (lifetime || user.plan === 'lifetime') {
    return { plan: 'premium', entitlement: 'lifetime', expiresAt: null, isLifetime: true }
  }

  const active = db.prepare(`
    SELECT MAX(expires_at) as expires_at
    FROM membership_entitlements
    WHERE user_id = ? AND is_lifetime = 0 AND expires_at > ?
  `).get(String(user.id), now)
  const entitlementExpiresAt = active?.expires_at ?? null
  const legacyExpiresAt = typeof user.premium_expires_at === 'number' && user.premium_expires_at > now ? user.premium_expires_at : null
  const expiresAt = Math.max(entitlementExpiresAt ?? 0, legacyExpiresAt ?? 0)
  if (expiresAt > now) {
    return { plan: 'premium', entitlement: 'pro', expiresAt: new Date(expiresAt).toISOString(), isLifetime: false }
  }

  if (user.plan === 'premium' && user.premium_expires_at && user.premium_expires_at <= now) {
    db.prepare('UPDATE users SET plan = ?, premium_expires_at = NULL WHERE id = ?').run('free', user.id)
  }
  return { plan: 'free', entitlement: 'free', expiresAt: null, isLifetime: false }
}

export const createPaymentOrder = (db, { userId, sku, payType }) => {
  const product = getPremiumSku(sku)
  const timestamp = Date.now()
  const outTradeNo = `fg_${timestamp}_${crypto.randomBytes(4).toString('hex')}`
  const record = {
    id: crypto.randomUUID(),
    user_id: userId,
    sku: product.sku,
    amount: product.amount,
    months: product.months,
    status: 'pending',
    out_trade_no: outTradeNo,
    zpay_trade_no: null,
    pay_type: payType,
    created_at: timestamp,
    paid_at: null,
    raw_notify_payload: null,
  }
  db.prepare(`
    INSERT INTO payment_orders (
      id, user_id, sku, amount, months, status, out_trade_no, zpay_trade_no, pay_type, created_at, paid_at, raw_notify_payload
    ) VALUES (
      @id, @user_id, @sku, @amount, @months, @status, @out_trade_no, @zpay_trade_no, @pay_type, @created_at, @paid_at, @raw_notify_payload
    )
  `).run(record)
  db.prepare(`
    UPDATE payment_orders
    SET order_no = ?, plan_id = 'pro_monthly', currency = 'CNY', channel = ?, gross_amount = ?, expired_at = ?, updated_at = ?
    WHERE out_trade_no = ?
  `).run(outTradeNo, payType === 'alipay' ? PAYMENT_CHANNELS.ZPAY_ALIPAY : payType, product.amount, timestamp + 30 * 60 * 1000, timestamp, outTradeNo)
  return {
    id: record.id,
    userId,
    sku: record.sku,
    planId: 'pro_monthly',
    amount: record.amount,
    currency: 'CNY',
    months: record.months,
    payType,
    channel: payType === 'alipay' ? PAYMENT_CHANNELS.ZPAY_ALIPAY : payType,
    orderNo: outTradeNo,
    outTradeNo,
    createdAt: timestamp,
  }
}

export const getPaymentOrderByOutTradeNo = (db, outTradeNo) =>
  db.prepare('SELECT * FROM payment_orders WHERE out_trade_no = ? OR order_no = ?').get(outTradeNo, outTradeNo)

export const getPaymentOrderByOrderNo = (db, orderNo) =>
  db.prepare('SELECT * FROM payment_orders WHERE order_no = ? OR out_trade_no = ?').get(orderNo, orderNo)

export const createUnifiedPaymentOrder = (db, { userId, planId, channel }) => {
  const plan = getPlanConfig(planId)
  const currency = channel === PAYMENT_CHANNELS.PAYPAL_CHECKOUT ? 'USD' : 'CNY'
  const amount = getPlanPrice(plan.id, currency)
  const timestamp = Date.now()
  const orderNo = `fg_${timestamp}_${crypto.randomBytes(4).toString('hex')}`
  const payType = channel === PAYMENT_CHANNELS.ZPAY_ALIPAY ? 'alipay' : 'paypal'
  const record = {
    id: crypto.randomUUID(),
    user_id: String(userId),
    sku: plan.legacySku,
    amount,
    months: plan.durationMonths ?? 0,
    status: ORDER_STATUS.PENDING,
    out_trade_no: orderNo,
    zpay_trade_no: null,
    pay_type: payType,
    created_at: timestamp,
    paid_at: null,
    raw_notify_payload: null,
    order_no: orderNo,
    plan_id: plan.id,
    currency,
    channel,
    provider_order_id: null,
    provider_payment_id: null,
    gross_amount: amount,
    fee_amount: null,
    net_amount: null,
    expired_at: timestamp + 30 * 60 * 1000,
    updated_at: timestamp,
    abnormal_reason: null,
  }
  db.prepare(`
    INSERT INTO payment_orders (
      id, user_id, sku, amount, months, status, out_trade_no, zpay_trade_no, pay_type, created_at, paid_at, raw_notify_payload,
      order_no, plan_id, currency, channel, provider_order_id, provider_payment_id, gross_amount, fee_amount, net_amount, expired_at, updated_at, abnormal_reason
    ) VALUES (
      @id, @user_id, @sku, @amount, @months, @status, @out_trade_no, @zpay_trade_no, @pay_type, @created_at, @paid_at, @raw_notify_payload,
      @order_no, @plan_id, @currency, @channel, @provider_order_id, @provider_payment_id, @gross_amount, @fee_amount, @net_amount, @expired_at, @updated_at, @abnormal_reason
    )
  `).run(record)
  return { ...record, orderNo, plan, amount, currency, channel }
}

export const buildZPayRequest = ({ pid, key, notifyBaseUrl, returnBaseUrl, payType, outTradeNo, amount, name }) => {
  const baseParams = {
    pid,
    type: payType,
    out_trade_no: outTradeNo,
    notify_url: `${notifyBaseUrl}/payments/zpay/notify`,
    return_url: `${returnBaseUrl}/payments/zpay/return`,
    name,
    money: amount,
    sitename: 'Focus&go',
  }

  return {
    ...baseParams,
    sign: signZPayParams(baseParams, key),
    sign_type: 'MD5',
  }
}

export const requestZPayOrder = async (params) => {
  const response = await fetch(ZPAY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`invalid zpay response: ${text}`)
  }
  if (!response.ok || Number(data.code) !== 1) {
    throw new Error(data.msg || 'failed to create zpay order')
  }
  return data
}

const applyOrderPayment = (db, order, payload) => {
  const money = Number(payload.money)
  if (Number.isNaN(money) || money !== Number(order.amount)) {
    throw new Error('amount mismatch')
  }

  const existingUser = getUserByPaymentUserId(db, order.user_id)
  if (!existingUser) throw new Error('user not found')

  const now = Date.now()
  const plan = getPlanConfig(order.plan_id ?? order.sku)
  const isLifetime = plan.entitlementType === 'lifetime'
  const baseExpiry = typeof existingUser.premium_expires_at === 'number' && existingUser.premium_expires_at > now
    ? existingUser.premium_expires_at
    : now
  const nextExpiry = isLifetime ? null : addMonths(baseExpiry, order.months || plan.durationMonths || 1)

  db.prepare(`
    UPDATE users
    SET plan = 'premium', premium_expires_at = ?
    WHERE id = ?
  `).run(nextExpiry, existingUser.id)

  db.prepare(`
    INSERT OR IGNORE INTO membership_entitlements (
      id, user_id, plan_id, source, order_no, starts_at, expires_at, is_lifetime, note, created_at
    ) VALUES (
      ?, ?, ?, 'payment', ?, ?, ?, ?, NULL, ?
    )
  `).run(crypto.randomUUID(), String(existingUser.id), plan.id, order.order_no ?? order.out_trade_no, now, nextExpiry, isLifetime ? 1 : 0, now)

  db.prepare(`
    UPDATE payment_orders
    SET status = 'paid',
        zpay_trade_no = ?,
        provider_payment_id = COALESCE(?, provider_payment_id),
        paid_at = ?,
        raw_notify_payload = ?,
        updated_at = ?
    WHERE out_trade_no = ?
  `).run(payload.zpayTradeNo ?? null, payload.providerPaymentId ?? payload.zpayTradeNo ?? null, now, JSON.stringify(payload.rawPayload ?? {}), now, order.out_trade_no)

  return {
    plan: 'premium',
    entitlement: isLifetime ? 'lifetime' : 'pro',
    expiresAt: nextExpiry ? new Date(nextExpiry).toISOString() : null,
    isLifetime,
  }
}

export const markOrderPaid = (db, { outTradeNo, zpayTradeNo, money, payType, rawPayload }) => {
  const transaction = db.transaction((input) => {
    const order = getPaymentOrderByOutTradeNo(db, input.outTradeNo)
    if (!order) throw new Error('order not found')
    if (order.pay_type !== input.payType) throw new Error('pay type mismatch')
    if (order.status === 'paid') {
      const user = getUserByPaymentUserId(db, order.user_id)
      return {
        applied: false,
        plan: user?.plan ?? 'free',
        expiresAt: user?.premium_expires_at ? new Date(user.premium_expires_at).toISOString() : null,
      }
    }

    const status = applyOrderPayment(db, order, {
      zpayTradeNo: input.zpayTradeNo,
      money: input.money,
      rawPayload: input.rawPayload,
    })
    return { applied: true, ...status }
  })

  return transaction({ outTradeNo, zpayTradeNo, money, payType, rawPayload })
}

export const recordPaymentEvent = (db, { eventKey, orderNo, channel, eventType, rawPayload }) => {
  const result = db.prepare(`
    INSERT OR IGNORE INTO payment_events (id, event_key, order_no, channel, event_type, raw_payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), eventKey, orderNo ?? null, channel, eventType, JSON.stringify(rawPayload ?? {}), Date.now())
  return result.changes > 0
}

export const markOrderAbnormal = (db, { orderNo, reason, rawPayload }) => {
  db.prepare(`
    UPDATE payment_orders
    SET status = ?, abnormal_reason = ?, raw_notify_payload = COALESCE(?, raw_notify_payload), updated_at = ?
    WHERE order_no = ? OR out_trade_no = ?
  `).run(ORDER_STATUS.ABNORMAL, reason, rawPayload ? JSON.stringify(rawPayload) : null, Date.now(), orderNo, orderNo)
}

export const applyPaidOrder = (db, { orderNo, channel, providerOrderId, providerPaymentId, grossAmount, currency, feeAmount = null, netAmount = null, rawPayload }) => {
  const transaction = db.transaction((input) => {
    const order = getPaymentOrderByOrderNo(db, input.orderNo)
    if (!order) throw new Error('order not found')
    if (order.channel && order.channel !== input.channel) throw new Error('channel mismatch')
    if (input.currency && order.currency && order.currency !== input.currency) {
      markOrderAbnormal(db, { orderNo: input.orderNo, reason: 'currency mismatch', rawPayload: input.rawPayload })
      throw new Error('currency mismatch')
    }
    if (input.grossAmount != null && normalizeAmount(input.grossAmount) !== normalizeAmount(order.amount)) {
      markOrderAbnormal(db, { orderNo: input.orderNo, reason: 'amount mismatch', rawPayload: input.rawPayload })
      throw new Error('amount mismatch')
    }
    if (order.status === ORDER_STATUS.PAID) {
      return { applied: false, ...getMembershipStatus(db, order.user_id) }
    }
    const status = applyOrderPayment(db, order, {
      zpayTradeNo: input.providerPaymentId,
      providerPaymentId: input.providerPaymentId,
      money: order.amount,
      rawPayload: input.rawPayload,
    })
    db.prepare(`
      UPDATE payment_orders
      SET channel = ?, provider_order_id = COALESCE(?, provider_order_id), provider_payment_id = COALESCE(?, provider_payment_id),
          gross_amount = COALESCE(?, gross_amount), fee_amount = COALESCE(?, fee_amount), net_amount = COALESCE(?, net_amount), updated_at = ?
      WHERE order_no = ? OR out_trade_no = ?
    `).run(input.channel, input.providerOrderId ?? null, input.providerPaymentId ?? null, input.grossAmount ?? null, input.feeAmount ?? null, input.netAmount ?? null, Date.now(), input.orderNo, input.orderNo)
    return { applied: true, ...status }
  })

  return transaction({ orderNo, channel, providerOrderId, providerPaymentId, grossAmount, currency, feeAmount, netAmount, rawPayload })
}

const getPayPalBaseUrl = () => process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

export const getPayPalAccessToken = async () => {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('paypal is not configured')
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error_description || data.error || 'failed to get paypal access token')
  return data.access_token
}

export const createPayPalCheckoutOrder = async ({ orderNo, amount, currency, name }) => {
  const accessToken = await getPayPalAccessToken()
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': orderNo,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderNo,
        description: name,
        custom_id: orderNo,
        amount: {
          currency_code: currency,
          value: amount,
        },
      }],
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || data.name || 'failed to create paypal order')
  return data
}

export const capturePayPalCheckoutOrder = async (paypalOrderId) => {
  const accessToken = await getPayPalAccessToken()
  const response = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture_${paypalOrderId}`,
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || data.name || 'failed to capture paypal order')
  return data
}

export const verifyPayPalWebhookSignature = async ({ headers, body }) => {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID
  if (!webhookId) throw new Error('paypal webhook is not configured')
  const accessToken = await getPayPalAccessToken()
  const response = await fetch(`${getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: body,
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || data.name || 'failed to verify paypal webhook')
  return data.verification_status === 'SUCCESS'
}

export const extractPayPalCapture = (payload) => {
  const purchaseUnit = payload?.purchase_units?.[0]
  const capture = purchaseUnit?.payments?.captures?.[0]
  const orderNo = purchaseUnit?.reference_id || purchaseUnit?.custom_id
  return {
    orderNo,
    providerOrderId: payload?.id,
    providerPaymentId: capture?.id,
    status: payload?.status,
    grossAmount: capture?.amount?.value ?? purchaseUnit?.amount?.value,
    currency: capture?.amount?.currency_code ?? purchaseUnit?.amount?.currency_code,
    feeAmount: capture?.seller_receivable_breakdown?.paypal_fee?.value ?? null,
    netAmount: capture?.seller_receivable_breakdown?.net_amount?.value ?? null,
  }
}

export const grantManualEntitlement = (db, { userId, planId, months, note }) => {
  const user = getUserByPaymentUserId(db, String(userId))
  if (!user) throw new Error('user not found')
  const plan = getPlanConfig(planId)
  const now = Date.now()
  const isLifetime = plan.entitlementType === 'lifetime'
  const baseExpiry = typeof user.premium_expires_at === 'number' && user.premium_expires_at > now ? user.premium_expires_at : now
  const expiresAt = isLifetime ? null : addMonths(baseExpiry, months || plan.durationMonths || 1)
  db.prepare(`
    INSERT INTO membership_entitlements (id, user_id, plan_id, source, order_no, starts_at, expires_at, is_lifetime, note, created_at)
    VALUES (?, ?, ?, 'manual', NULL, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), String(user.id), plan.id, now, expiresAt, isLifetime ? 1 : 0, note ?? null, now)
  db.prepare('UPDATE users SET plan = ?, premium_expires_at = ? WHERE id = ?').run('premium', expiresAt, user.id)
  return getMembershipStatus(db, String(user.id))
}
