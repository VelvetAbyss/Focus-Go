import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { createRequireAuth } from './authPolicy.js'
import { requireAdmin } from './admin.js'

const fixture = (verified = false) => {
  const db = new Database(':memory:')
  db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY, authing_id TEXT, auth_user_id TEXT,
    email TEXT, plan TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE user(id TEXT, email TEXT, emailVerified INTEGER);
    CREATE TABLE session(token TEXT, userId TEXT, expiresAt TEXT);`)
  db.prepare('INSERT INTO user VALUES (?, ?, ?)').run('new-identity', 'owner@example.test', Number(verified))
  db.prepare('INSERT INTO session VALUES (?, ?, ?)').run('test-session', 'new-identity', new Date(Date.now() + 60_000).toISOString())
  const middleware = createRequireAuth({ database: db, auth: { api: { getSession: async () => ({
    user: { id: 'new-identity', email: 'owner@example.test', emailVerified: verified }, session: {},
  }) } } })
  return { db, middleware }
}
const invoke = async (middleware, headers = { authorization: 'Bearer test-session' }) => {
  const req = { headers, socket: { remoteAddress: '203.0.113.1' } }
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this }, json(body) { this.body = body; return this } }
  let next = false
  await middleware(req, res, () => { next = true })
  return { req, res, next }
}

test('unverified identity cannot bind an unmigrated legacy account (bearer or cookie)', async () => {
  const { db, middleware } = fixture()
  try {
    db.prepare('INSERT INTO users VALUES (1, ?, NULL, ?, ?, ?)').run('legacy', 'OWNER@example.test', 'free', 'active')
    for (const headers of [{ authorization: 'Bearer test-session' }, {}]) {
      const result = await invoke(middleware, headers)
      assert.equal(result.next, false)
      assert.equal(result.res.statusCode, 403)
      assert.equal(db.prepare('SELECT auth_user_id FROM users WHERE id=1').get().auth_user_id, null)
    }
  } finally { db.close() }
})

test('verified mailbox owner can migrate the active legacy account', async () => {
  const { db, middleware } = fixture(true)
  try {
    db.prepare('INSERT INTO users VALUES (1, ?, NULL, ?, ?, ?)').run('legacy', 'OWNER@example.test', 'free', 'active')
    const result = await invoke(middleware)
    assert.equal(result.next, true)
    assert.equal(result.req.auth.user.id, 1)
    assert.equal(db.prepare('SELECT auth_user_id FROM users WHERE id=1').get().auth_user_id, 'new-identity')
  } finally { db.close() }
})

test('ordinary unverified new accounts can still use protected features', async () => {
  const { db, middleware } = fixture()
  try { assert.equal((await invoke(middleware)).next, true) } finally { db.close() }
})

test('production admin authorization rejects an unverified allowlisted identity', async () => {
  const previous = { NODE_ENV: process.env.NODE_ENV, ADMIN_EMAILS: process.env.ADMIN_EMAILS }
  process.env.NODE_ENV = 'production'
  process.env.ADMIN_EMAILS = 'owner@example.test'
  try {
    const req = { headers: {}, socket: { remoteAddress: '203.0.113.1' }, auth: {
      user: { email: 'owner@example.test', status: 'active' },
      authUser: { email: 'owner@example.test', emailVerified: false },
    } }
    const result = await invoke((r, s, n) => requireAdmin({ ...r, auth: req.auth }, s, n))
    assert.equal(result.next, false)
    assert.equal(result.res.statusCode, 403)
    req.auth.authUser.emailVerified = true
    assert.equal((await invoke((r, s, n) => requireAdmin({ ...r, auth: req.auth }, s, n))).next, true)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('suspended and deletion-pending accounts are denied for both bearer and cookie sessions', async () => {
  const { db, middleware } = fixture(true)
  try {
    db.prepare('INSERT INTO users VALUES (1, ?, ?, ?, ?, ?)').run('better:new-identity', 'new-identity', 'owner@example.test', 'free', 'active')
    for (const status of ['suspended', 'deletion_pending']) {
      db.prepare('UPDATE users SET status=? WHERE id=1').run(status)
      for (const headers of [{ authorization: 'Bearer test-session' }, {}]) {
        const result = await invoke(middleware, headers)
        assert.equal(result.next, false)
        assert.equal(result.res.statusCode, 403)
        assert.equal(result.res.body.error, 'account_not_active')
      }
    }
    db.prepare("UPDATE users SET status='active' WHERE id=1").run()
    assert.equal((await invoke(middleware)).next, true)
  } finally { db.close() }
})

test('a verified signup cannot migrate a suspended legacy account', async () => {
  const { db, middleware } = fixture(true)
  try {
    db.prepare('INSERT INTO users VALUES (1, ?, NULL, ?, ?, ?)').run('legacy', 'owner@example.test', 'free', 'suspended')
    assert.equal((await invoke(middleware)).res.statusCode, 403)
    assert.equal(db.prepare('SELECT auth_user_id FROM users WHERE id=1').get().auth_user_id, null)
  } finally { db.close() }
})
