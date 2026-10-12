import test from 'node:test'
import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'
import webpush from 'web-push'
import { ensureSyncTables } from '../sync/store.js'
import { ensurePushTables, listPushSubscriptions, upsertPushSubscription } from './store.js'
import { parseSubscriptionBody, validTimeZone } from './config.js'
import { collectDueLifeReminders, nextBillingDate, nextBirthday } from './lifeReminders.js'
import { runReminderTick } from './scheduler.js'

const vapid = { ...webpush.generateVAPIDKeys(), subject: 'mailto:test@example.com' }

const keys = () => {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') }
}

const createDb = () => {
  const db = new Database(':memory:')
  ensureSyncTables(db)
  ensurePushTables(db)
  return db
}

const put = (db, table, userId, item) =>
  db.prepare(`INSERT OR REPLACE INTO ${table} (id, user_id, payload, updated_at, deleted_at, server_seq) VALUES (?, ?, ?, ?, NULL, 1)`)
    .run(item.id, userId, JSON.stringify(item), Date.now())

// 10:00 on Monday 12 October 2026 in Shanghai.
const SHANGHAI_10AM = Date.UTC(2026, 9, 12, 2, 0)

test('next billing and birthday dates, with short months and leap days', () => {
  const today = { year: 2026, month: 10, day: 12 }
  assert.deepEqual(nextBillingDate({ cycle: 'monthly', billingDay: 15 }, today), { year: 2026, month: 10, day: 15 })
  assert.deepEqual(nextBillingDate({ cycle: 'monthly', billingDay: 5 }, today), { year: 2026, month: 11, day: 5 })
  assert.deepEqual(nextBillingDate({ cycle: 'monthly', billingDay: 31 }, { year: 2026, month: 11, day: 2 }), { year: 2026, month: 11, day: 30 })
  assert.deepEqual(nextBillingDate({ cycle: 'yearly', billingDay: 1, billingMonth: 3 }, today), { year: 2027, month: 3, day: 1 })
  assert.equal(nextBillingDate({ cycle: 'monthly' }, today), null)
  assert.deepEqual(nextBirthday('1990-10-13', today), { year: 2026, month: 10, day: 13 })
  assert.deepEqual(nextBirthday('02-29', today), { year: 2027, month: 2, day: 28 })
  assert.equal(nextBirthday('soon', today), null)
})

test('the device time zone is validated and stored', () => {
  assert.equal(validTimeZone('Asia/Shanghai'), 'Asia/Shanghai')
  assert.equal(validTimeZone('America/Indiana/Indianapolis'), 'America/Indiana/Indianapolis')
  assert.equal(validTimeZone('Mars/Base'), null)
  assert.equal(validTimeZone('../etc'), null)
  const db = createDb()
  const parsed = parseSubscriptionBody(
    { subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: keys() }, timeZone: 'Asia/Shanghai' },
    { isAllowedEndpoint: () => true },
  )
  upsertPushSubscription(db, { userId: 'u1', ...parsed })
  assert.equal(listPushSubscriptions(db, 'u1')[0].timeZone, 'Asia/Shanghai')
})

test('a renewal three days out (reminder on) and a birthday tomorrow go out in the morning, once', async () => {
  const db = createDb()
  upsertPushSubscription(db, { userId: 'u1', endpoint: 'https://fcm.googleapis.com/fcm/send/a', keys: keys(), leadMinutes: 10, language: 'zh', timeZone: 'Asia/Shanghai' })
  // A device that never sent its zone is skipped.
  upsertPushSubscription(db, { userId: 'u1', endpoint: 'https://fcm.googleapis.com/fcm/send/b', keys: keys(), leadMinutes: 10, language: 'zh' })
  put(db, 'sync_life_subscriptions', 'u1', { id: 's1', name: 'Netflix', amount: 68, currency: 'CNY', cycle: 'monthly', billingDay: 15, reminder: true })
  put(db, 'sync_life_subscriptions', 'u1', { id: 's2', name: 'Muted', amount: 1, currency: 'CNY', cycle: 'monthly', billingDay: 15 })
  put(db, 'sync_life_people', 'u1', { id: 'p1', name: '小明', birthday: '1995-10-13' })

  const due = collectDueLifeReminders(db, { now: SHANGHAI_10AM })
  assert.deepEqual(due.map((item) => item.payload.title).sort(), ['Netflix 3 天后续费', '明天是小明的生日'])
  assert.equal(due.find((item) => item.key === 'life-sub:s1').payload.body, '¥68 · 月付 · 10月15日')

  const sent = []
  await runReminderTick({ db, vapid, now: SHANGHAI_10AM, send: async (_device, payload) => sent.push(payload.title) })
  assert.equal(sent.length, 2)
  // Delivered once: the next tick sends nothing.
  await runReminderTick({ db, vapid, now: SHANGHAI_10AM + 60_000, send: async (_device, payload) => sent.push(payload.title) })
  assert.equal(sent.length, 2)
})

test('nothing goes out at night, or on the wrong day', () => {
  const db = createDb()
  upsertPushSubscription(db, { userId: 'u1', endpoint: 'https://fcm.googleapis.com/fcm/send/a', keys: keys(), leadMinutes: 10, language: 'en', timeZone: 'Asia/Shanghai' })
  put(db, 'sync_life_subscriptions', 'u1', { id: 's1', name: 'Netflix', amount: 9.99, currency: 'USD', cycle: 'monthly', billingDay: 15, reminder: true })
  // 23:00 in Shanghai on the right day.
  assert.equal(collectDueLifeReminders(db, { now: Date.UTC(2026, 9, 12, 15, 0) }).length, 0)
  // Morning, but four days out.
  assert.equal(collectDueLifeReminders(db, { now: Date.UTC(2026, 9, 11, 2, 0) }).length, 0)
  const [item] = collectDueLifeReminders(db, { now: SHANGHAI_10AM })
  assert.equal(item.payload.title, 'Netflix renews in 3 days')
  assert.equal(item.payload.body, '$9.99/mo · 10/15')
})
