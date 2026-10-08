import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import Database from 'better-sqlite3'
import { ensureDesktopAuthTable, registerDesktopAuthRoutes, registerBearerSignOut } from '../auth/desktopAuth.js'

test('desktop exchange requires the initiating verifier and state, and cannot be replayed', async () => {
  const db = new Database(':memory:')
  const app = express()
  app.use(express.json())
  db.exec('CREATE TABLE session(token TEXT, userId TEXT, expiresAt TEXT); CREATE TABLE user(id TEXT, email TEXT)')
  db.prepare('INSERT INTO session VALUES (?, ?, ?)').run('session', 'owner', new Date(Date.now() + 60_000).toISOString())
  db.prepare('INSERT INTO user VALUES (?, ?)').run('owner', 'owner@example.test')
  ensureDesktopAuthTable(db)
  registerDesktopAuthRoutes(app, db, { api: { getSession: async () => ({ session: { token: 'session' } }) } })
  registerBearerSignOut(app, db)
  app.post('/api/auth/sign-out', (_req, res) => res.json({ success: true }))
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.equal((await fetch(`${base}/api/auth/desktop/callback`, { redirect: 'manual' })).status, 400)
    const state = 'a'.repeat(64), verifier = 'b'.repeat(64)
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    const callback = await fetch(`${base}/api/auth/desktop/callback?state=${state}&code_challenge=${challenge}`, { redirect: 'manual' })
    const code = new URL(callback.headers.get('location')).searchParams.get('code')
    const exchange = (body) => fetch(`${base}/api/auth/desktop/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal((await exchange({ code })).status, 400)
    assert.equal((await exchange({ code, state, verifier: 'c'.repeat(64) })).status, 401)
    assert.equal((await exchange({ code, state: 'd'.repeat(64), verifier })).status, 401)
    const success = await exchange({ code, state, verifier })
    assert.equal(success.status, 200)
    assert.equal((await success.json()).token, 'session')
    assert.equal((await exchange({ code, state, verifier })).status, 401)
    await fetch(`${base}/api/auth/sign-out`, { method: 'POST', headers: { Authorization: 'Bearer session' } })
    assert.equal(db.prepare('SELECT token FROM session WHERE token=?').get('session'), undefined)
  } finally { await new Promise((resolve) => server.close(resolve)); db.close() }
})
