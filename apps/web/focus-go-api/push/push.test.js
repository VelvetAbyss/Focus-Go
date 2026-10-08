import test from 'node:test'
import assert from 'node:assert/strict'
import { createECDH, randomBytes } from 'node:crypto'
import express from 'express'
import Database from 'better-sqlite3'
import webpush from 'web-push'
import { ensureSyncTables } from '../sync/store.js'
import { ensurePushTables, listPushSubscriptions, upsertPushSubscription } from './store.js'
import { isAllowedPushEndpoint, parseSubscriptionBody } from './config.js'
import { buildReminderPayload, collectDueReminders, runReminderTick, REMINDER_GRACE_MS } from './scheduler.js'
import { createPushRouter } from '../routes/push.js'

const MINUTE = 60_000
const vapid = { ...webpush.generateVAPIDKeys(), subject: 'mailto:test@example.com' }

const browserKeys = () => {
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

const subscribe = (db, userId, { endpoint = `https://fcm.googleapis.com/fcm/send/${userId}-${Math.random()}`, leadMinutes = 10 } = {}) =>
  upsertPushSubscription(db, { userId, endpoint, keys: browserKeys(), leadMinutes, language: 'zh' })

const putTask = (db, userId, task, { deletedAt = null } = {}) => {
  db.prepare('INSERT OR REPLACE INTO sync_tasks (id, user_id, payload, updated_at, deleted_at, server_seq) VALUES (?, ?, ?, ?, ?, 1)')
    .run(task.id, userId, JSON.stringify(task), Date.now(), deletedAt)
}

test('only real push services are accepted as endpoints', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGz',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) assert.equal(isAllowedPushEndpoint(ok), true, ok)
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x',
    'https://evilfcm.googleapis.com/x'.replace('evilfcm.googleapis.com', 'googleapis.com.evil.example'),
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'https://fcm.googleapis.com:8443/fcm/send/abc',
    'https://user:pass@fcm.googleapis.com/x',
    'file:///etc/passwd',
    42,
  ]) assert.equal(isAllowedPushEndpoint(bad), false, String(bad))
})

test('subscription bodies are validated and clamped', () => {
  const keys = browserKeys()
  const parsed = parseSubscriptionBody({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }, leadMinutes: 99999, language: 'fr' })
  assert.deepEqual(parsed, { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys, leadMinutes: 1440, language: 'zh' })
  assert.equal(parseSubscriptionBody({ subscription: { endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'short', auth: keys.auth } } }), null)
  assert.equal(parseSubscriptionBody({ subscription: { endpoint: 'https://127.0.0.1/x', keys } }), null)
})

test('an endpoint belongs to whoever signed in last, and old devices age out', () => {
  const db = createDb()
  const endpoint = 'https://fcm.googleapis.com/fcm/send/shared-browser'
  upsertPushSubscription(db, { userId: 'alice', endpoint, keys: browserKeys(), leadMinutes: 10, language: 'zh' })
  upsertPushSubscription(db, { userId: 'bob', endpoint, keys: browserKeys(), leadMinutes: 5, language: 'en' })
  assert.equal(listPushSubscriptions(db, 'alice').length, 0)
  assert.equal(listPushSubscriptions(db, 'bob')[0].leadMinutes, 5)

  for (let i = 0; i < 12; i += 1) {
    upsertPushSubscription(db, { userId: 'carol', endpoint: `https://fcm.googleapis.com/fcm/send/c${i}`, keys: browserKeys(), leadMinutes: 10, language: 'zh', now: i })
  }
  const carol = listPushSubscriptions(db, 'carol')
  assert.equal(carol.length, 10)
  assert.ok(!carol.some((item) => item.endpoint.endsWith('/c0') || item.endpoint.endsWith('/c1')))
})

test('a reminder is sent once per device when due, honouring each device\'s lead time', async () => {
  const db = createDb()
  const now = Date.UTC(2026, 9, 8, 7, 0)
  const phone = subscribe(db, 'u1', { leadMinutes: 10 })
  const laptop = subscribe(db, 'u1', { leadMinutes: 30 })
  putTask(db, 'u1', { id: 't1', title: '交周报', status: 'todo', reminderAt: now + 10 * MINUTE })

  const sent = []
  const send = async (subscription, payload) => { sent.push({ id: subscription.id, payload }) }

  // Laptop (30 min lead) is due already; the phone (10 min) is not — and gets a grace for open apps.
  await runReminderTick({ db, vapid, send, now })
  assert.deepEqual(sent.map((item) => item.id), [laptop])
  assert.equal(sent[0].payload.title, '交周报')
  assert.equal(sent[0].payload.url, '/tasks?task=t1')

  await runReminderTick({ db, vapid, send, now: now + REMINDER_GRACE_MS + 1 })
  assert.deepEqual(sent.map((item) => item.id), [laptop, phone])

  // Nothing twice.
  await runReminderTick({ db, vapid, send, now: now + 2 * MINUTE })
  assert.equal(sent.length, 2)
})

test('a reminder set inside the lead window goes out at once', () => {
  const db = createDb()
  const now = Date.UTC(2026, 9, 8, 7, 0)
  subscribe(db, 'u1', { leadMinutes: 10 })
  putTask(db, 'u1', { id: 'soon', status: 'todo', reminderAt: now + 5 * MINUTE })
  assert.deepEqual(collectDueReminders(db, { now }).map((item) => item.task.id), ['soon'])
})

test('skips reminders already shown by an open app, finished or deleted tasks, and stale ones', () => {
  const db = createDb()
  const now = Date.UTC(2026, 9, 8, 7, 0)
  subscribe(db, 'u1', { leadMinutes: 1 })
  const at = now - 30_000
  putTask(db, 'u1', { id: 'fired', status: 'todo', reminderAt: at, reminderFiredAt: at - 60_000 })
  putTask(db, 'u1', { id: 'done', status: 'done', reminderAt: at })
  putTask(db, 'u1', { id: 'dropped', status: 'dropped', reminderAt: at })
  putTask(db, 'u1', { id: 'deleted', status: 'todo', reminderAt: at }, { deletedAt: now })
  putTask(db, 'u1', { id: 'stale', status: 'todo', reminderAt: now - 3 * 60 * MINUTE })
  putTask(db, 'u1', { id: 'waiting', status: 'waiting', reminderAt: at })
  putTask(db, 'u2', { id: 'other-user', status: 'todo', reminderAt: at })

  assert.deepEqual(collectDueReminders(db, { now }).map((item) => item.task.id), ['waiting'])
})

test('a gone subscription is forgotten; a transient failure is retried next tick', async () => {
  const db = createDb()
  const now = Date.UTC(2026, 9, 8, 7, 0)
  const gone = subscribe(db, 'u1', { leadMinutes: 1 })
  subscribe(db, 'u2', { leadMinutes: 1 })
  putTask(db, 'u1', { id: 'a', status: 'todo', reminderAt: now })
  putTask(db, 'u2', { id: 'b', status: 'todo', reminderAt: now })

  let attempt = 0
  const send = async (subscription) => {
    if (subscription.id === gone) throw Object.assign(new Error('gone'), { statusCode: 410 })
    attempt += 1
    if (attempt === 1) throw Object.assign(new Error('unavailable'), { statusCode: 503 })
  }

  assert.deepEqual(await runReminderTick({ db, vapid, send, now }), { sent: 0 })
  assert.equal(listPushSubscriptions(db, 'u1').length, 0)
  assert.equal(listPushSubscriptions(db, 'u2').length, 1)
  assert.deepEqual(await runReminderTick({ db, vapid, send, now: now + 30_000 }), { sent: 1 })
})

test('web-push can encrypt the reminder payload for a real browser key', () => {
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: browserKeys(), language: 'en' }
  const payload = buildReminderPayload({ id: 't1', title: '', reminderAt: 1, description: 'Call back' }, subscription)
  assert.equal(payload.title, 'Task reminder')
  const request = webpush.generateRequestDetails(subscription, JSON.stringify(payload), { vapidDetails: vapid, TTL: 60 })
  assert.equal(request.method, 'POST')
  assert.equal(request.headers['Content-Encoding'], 'aes128gcm')
  assert.match(request.headers.Authorization, /^vapid t=/)
  assert.ok(request.body.length > 0)
})

const createServer = async ({ userId = 'user-1', send = async () => {} } = {}) => {
  const db = createDb()
  const app = express()
  app.use(express.json())
  app.use('/push', createPushRouter({
    database: db,
    vapid,
    send,
    authMiddleware: (req, res, next) => {
      if (req.get('x-test-user') === 'none') return res.status(401).json({ error: 'unauthorized' })
      req.auth = { user: { id: req.get('x-test-user') ?? userId } }
      next()
    },
  }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const call = (method, path, body, headers = {}) => fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { db, call, close: () => new Promise((resolve) => server.close(resolve)) }
}

test('routes: public config, authenticated subscribe/test/unsubscribe', async () => {
  const sent = []
  const ctx = await createServer({ send: async (_subscription, payload) => { sent.push(payload) } })
  try {
    const config = await (await ctx.call('GET', '/push/config')).json()
    assert.deepEqual(config, { enabled: true, publicKey: vapid.publicKey })

    const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1', keys: browserKeys() }
    assert.equal((await ctx.call('POST', '/push/subscriptions', { subscription }, { 'x-test-user': 'none' })).status, 401)
    assert.equal((await ctx.call('POST', '/push/subscriptions', { subscription: { ...subscription, endpoint: 'https://10.0.0.1/x' } })).status, 400)
    const created = await ctx.call('POST', '/push/subscriptions', { subscription, leadMinutes: 15, language: 'en' })
    assert.equal(created.status, 200)
    assert.equal((await created.json()).leadMinutes, 15)

    // Someone else can't fire tests at (or remove) this device.
    assert.equal((await ctx.call('POST', '/push/test', { endpoint: subscription.endpoint }, { 'x-test-user': 'user-2' })).status, 404)
    assert.equal((await ctx.call('POST', '/push/test', { endpoint: subscription.endpoint })).status, 200)
    assert.equal(sent[0].kind, 'test')
    assert.equal((await ctx.call('POST', '/push/test', { endpoint: subscription.endpoint })).status, 429)

    const removedByOther = await (await ctx.call('DELETE', '/push/subscriptions', { endpoint: subscription.endpoint }, { 'x-test-user': 'user-2' })).json()
    assert.equal(removedByOther.removed, false)
    const removed = await (await ctx.call('DELETE', '/push/subscriptions', { endpoint: subscription.endpoint })).json()
    assert.equal(removed.removed, true)
    assert.equal(listPushSubscriptions(ctx.db, 'user-1').length, 0)
  } finally {
    await ctx.close()
  }
})
