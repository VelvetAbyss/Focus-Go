import crypto from 'node:crypto'

export const ZPAY_API_URL = 'https://zpayz.cn/mapi.php'

const PREMIUM_MONTH_SKU = {
  sku: 'premium-month',
  amount: '9.90',
  months: 1,
  name: 'FocusGo Pro Membership',
}

const addMonths = (timestamp, months) => {
  const date = new Date(timestamp)
  date.setUTCMonth(date.getUTCMonth() + months)
  return date.getTime()
}

const getUserColumns = (db) => db.prepare("PRAGMA table_info('users')").all().map((column) => column.name)

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
  return PREMIUM_MONTH_SKU
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
  return {
    id: record.id,
    userId,
    sku: record.sku,
    amount: record.amount,
    months: record.months,
    payType,
    outTradeNo,
    createdAt: timestamp,
  }
}

export const getPaymentOrderByOutTradeNo = (db, outTradeNo) =>
  db.prepare('SELECT * FROM payment_orders WHERE out_trade_no = ?').get(outTradeNo)

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

  const existingUser = db.prepare('SELECT * FROM users WHERE authing_id = ?').get(order.user_id)
  if (!existingUser) throw new Error('user not found')

  const now = Date.now()
  const baseExpiry = typeof existingUser.premium_expires_at === 'number' && existingUser.premium_expires_at > now
    ? existingUser.premium_expires_at
    : now
  const nextExpiry = addMonths(baseExpiry, order.months)

  db.prepare(`
    UPDATE users
    SET plan = 'premium', premium_expires_at = ?
    WHERE authing_id = ?
  `).run(nextExpiry, order.user_id)

  db.prepare(`
    UPDATE payment_orders
    SET status = 'paid',
        zpay_trade_no = ?,
        paid_at = ?,
        raw_notify_payload = ?
    WHERE out_trade_no = ?
  `).run(payload.zpayTradeNo ?? null, now, JSON.stringify(payload.rawPayload ?? {}), order.out_trade_no)

  return {
    plan: 'premium',
    expiresAt: new Date(nextExpiry).toISOString(),
  }
}

export const markOrderPaid = (db, { outTradeNo, zpayTradeNo, money, payType, rawPayload }) => {
  const transaction = db.transaction((input) => {
    const order = getPaymentOrderByOutTradeNo(db, input.outTradeNo)
    if (!order) throw new Error('order not found')
    if (order.pay_type !== input.payType) throw new Error('pay type mismatch')
    if (order.status === 'paid') {
      const user = db.prepare('SELECT plan, premium_expires_at FROM users WHERE authing_id = ?').get(order.user_id)
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
