import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  createPaymentOrder,
  ensurePaymentTables,
  markOrderPaid,
  signZPayParams,
  verifyZPaySignature,
} from './payments.js'

const createDb = () => {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authing_id TEXT UNIQUE NOT NULL,
      email TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  ensurePaymentTables(db)
  return db
}

const insertUser = (db, authingId = 'authing-user-1') => {
  db.prepare('INSERT INTO users (authing_id, email, plan) VALUES (?, ?, ?)').run(authingId, 'test@example.com', 'free')
  return db.prepare('SELECT * FROM users WHERE authing_id = ?').get(authingId)
}

test('signZPayParams signs sorted params and verifyZPaySignature validates it', () => {
  const params = {
    pid: '1001',
    out_trade_no: 'order-1',
    money: '0.01',
    notify_url: 'https://api.nestflow.art/payments/zpay/notify',
  }
  const sign = signZPayParams(params, 'secret')

  assert.equal(sign, 'cf322ebb81e73437f50e8c5fe4907f9e')
  assert.equal(verifyZPaySignature({ ...params, sign, sign_type: 'MD5' }, 'secret'), true)
  assert.equal(verifyZPaySignature({ ...params, sign: 'bad' }, 'secret'), false)
})

test('markOrderPaid upgrades the user and ignores duplicate callbacks', () => {
  const db = createDb()
  const user = insertUser(db)
  const order = createPaymentOrder(db, {
    userId: user.authing_id,
    sku: 'premium-month-test',
    amount: '0.01',
    months: 1,
    payType: 'alipay',
  })

  const first = markOrderPaid(db, {
    outTradeNo: order.outTradeNo,
    zpayTradeNo: 'zpay-1',
    money: '0.01',
    payType: 'alipay',
    rawPayload: { trade_status: 'TRADE_SUCCESS' },
  })
  assert.equal(first.applied, true)

  const userAfterFirst = db.prepare('SELECT plan, premium_expires_at FROM users WHERE authing_id = ?').get(user.authing_id)
  assert.equal(userAfterFirst.plan, 'premium')
  assert.ok(userAfterFirst.premium_expires_at)

  const second = markOrderPaid(db, {
    outTradeNo: order.outTradeNo,
    zpayTradeNo: 'zpay-1',
    money: '0.01',
    payType: 'alipay',
    rawPayload: { trade_status: 'TRADE_SUCCESS' },
  })
  assert.equal(second.applied, false)

  const userAfterSecond = db.prepare('SELECT premium_expires_at FROM users WHERE authing_id = ?').get(user.authing_id)
  assert.equal(userAfterSecond.premium_expires_at, userAfterFirst.premium_expires_at)
})

test('markOrderPaid extends from the existing premium expiry and rejects amount mismatches', () => {
  const db = createDb()
  const user = insertUser(db)
  const baseExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000
  db.prepare('UPDATE users SET plan = ?, premium_expires_at = ? WHERE authing_id = ?').run('premium', baseExpiry, user.authing_id)

  const order = createPaymentOrder(db, {
    userId: user.authing_id,
    sku: 'premium-month-test',
    amount: '0.01',
    months: 1,
    payType: 'wxpay',
  })

  assert.throws(
    () => markOrderPaid(db, {
      outTradeNo: order.outTradeNo,
      zpayTradeNo: 'zpay-2',
      money: '9.99',
      payType: 'wxpay',
      rawPayload: {},
    }),
    /amount mismatch/,
  )

  const applied = markOrderPaid(db, {
    outTradeNo: order.outTradeNo,
    zpayTradeNo: 'zpay-2',
    money: '0.01',
    payType: 'wxpay',
    rawPayload: {},
  })
  assert.equal(applied.applied, true)

  const updated = db.prepare('SELECT premium_expires_at FROM users WHERE authing_id = ?').get(user.authing_id)
  const expected = new Date(baseExpiry)
  expected.setUTCMonth(expected.getUTCMonth() + 1)
  assert.equal(updated.premium_expires_at, expected.getTime())
})
