import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { createSyncRouter } from './sync.js'
import { ensureSyncTables } from '../sync/store.js'

const createAuthDatabase = () => {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE user (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id)
    );
    CREATE TABLE account (
      id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id), accessToken TEXT, refreshToken TEXT,
      idToken TEXT, accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT,
      scope TEXT, password TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );
    CREATE TABLE verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
      expiresAt TEXT NOT NULL, createdAt TEXT, updatedAt TEXT
    );
  `)
  ensureSyncTables(database)
  return database
}

test('real local account sessions can sync between two devices without losing a conflicting edit', async () => {
  const database = createAuthDatabase()
  const auth = betterAuth({
    database,
    secret: 'focusgo-sync-integration-test-secret-32chars',
    baseURL: 'http://127.0.0.1:3000/api/auth',
    emailAndPassword: { enabled: true },
  })
  const email = `sync-${crypto.randomUUID()}@example.test`
  const credentials = { email, password: 'test-only-password-1234' }
  const first = await auth.api.signUpEmail({ body: { ...credentials, name: 'Sync test' } })
  const second = await auth.api.signInEmail({ body: credentials })
  assert.ok(first.token)
  assert.ok(second.token)
  assert.notEqual(first.token, second.token)

  const app = express()
  app.use(express.json())
  app.use('/sync', createSyncRouter({
    database,
    authMiddleware: (req, res, next) => {
      const token = req.headers.authorization?.replace(/^Bearer /, '')
      const session = database.prepare('SELECT userId, expiresAt FROM session WHERE token = ?').get(token)
      if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
        return res.status(401).json({ error: 'invalid_session' })
      }
      req.auth = { user: { id: session.userId, plan: 'free' } }
      next()
    },
  }))
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  const send = async (token, path, body) => {
    const response = await fetch(`${baseUrl}/sync/rxdb/${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  try {
    const original = { id: 'same-note', title: 'Original', updatedAt: 1_000, _deleted: false }
    const created = await send(first.token, 'push', { entityType: 'notes', rows: [
      { newDocumentState: original, assumedMasterState: null },
    ], blobs: [] })
    assert.equal(created.status, 200)
    assert.deepEqual(created.body.conflicts, [])
    const seenBySecond = await send(second.token, 'pull', { entityType: 'notes', checkpoint: null, limit: 100 })
    assert.equal(seenBySecond.body.documents[0].title, 'Original')

    const firstEdit = { ...original, title: 'First device', updatedAt: 2_000 }
    assert.deepEqual((await send(first.token, 'push', { entityType: 'notes', rows: [
      { newDocumentState: firstEdit, assumedMasterState: original },
    ], blobs: [] })).body.conflicts, [])
    const offlineSecondEdit = { ...original, title: 'Second device offline', updatedAt: 100 }
    const conflict = await send(second.token, 'push', { entityType: 'notes', rows: [
      { newDocumentState: offlineSecondEdit, assumedMasterState: original },
    ], blobs: [] })
    assert.equal(conflict.body.conflicts[0].title, 'First device')
    const resumed = await send(second.token, 'pull', {
      entityType: 'notes', checkpoint: seenBySecond.body.checkpoint, limit: 100,
    })
    assert.equal(resumed.body.documents[0].title, 'First device')
    assert.ok(resumed.body.checkpoint.sequence > seenBySecond.body.checkpoint.sequence)
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM sync_notes').get().count, 1)
    assert.equal((await send('invalid', 'pull', { entityType: 'notes', checkpoint: null, limit: 1 })).status, 401)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    database.close()
  }
})
