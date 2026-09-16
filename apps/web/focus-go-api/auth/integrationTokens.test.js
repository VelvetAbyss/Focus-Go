import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import {
  createIntegrationToken,
  ensureIntegrationTokenTable,
  getUserFromIntegrationToken,
  hashIntegrationToken,
  listIntegrationTokens,
  revokeIntegrationToken,
} from './integrationTokens.js'

const createDb = () => {
  const db = new Database(':memory:')
  ensureIntegrationTokenTable(db)
  db.exec('CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT)')
  db.prepare('INSERT INTO user (id, email) VALUES (?, ?)').run('auth-user-1', 'a@example.com')
  db.prepare('INSERT INTO user (id, email) VALUES (?, ?)').run('auth-user-2', 'b@example.com')
  return db
}

test('a freshly created token resolves to its owner', () => {
  const db = createDb()
  const created = createIntegrationToken(db, 'auth-user-1', 'Obsidian — MacBook')

  const resolved = getUserFromIntegrationToken(db, created.token)
  assert.equal(resolved?.user.id, 'auth-user-1')
  assert.equal(resolved?.tokenRow.name, 'Obsidian — MacBook')
})

test('only the hash is persisted, never the plaintext token', () => {
  const db = createDb()
  const created = createIntegrationToken(db, 'auth-user-1', 'Obsidian')

  const row = db.prepare('SELECT * FROM integration_token WHERE id = ?').get(created.id)
  assert.equal(row.token_hash, hashIntegrationToken(created.token))
  // The plaintext must not appear in any stored column.
  assert.ok(!Object.values(row).some((value) => value === created.token))
  // The display stub is a strict prefix, not enough to reconstruct the token.
  assert.ok(created.token.startsWith(row.token_prefix))
  assert.ok(row.token_prefix.length < created.token.length)
})

test('a revoked token no longer authenticates and drops out of the list', () => {
  const db = createDb()
  const created = createIntegrationToken(db, 'auth-user-1', 'Obsidian')

  assert.equal(revokeIntegrationToken(db, 'auth-user-1', created.id), true)
  assert.equal(getUserFromIntegrationToken(db, created.token), null)
  assert.deepEqual(listIntegrationTokens(db, 'auth-user-1'), [])
})

test('a token cannot be revoked by a different user', () => {
  const db = createDb()
  const created = createIntegrationToken(db, 'auth-user-1', 'Obsidian')

  assert.equal(revokeIntegrationToken(db, 'auth-user-2', created.id), false)
  assert.equal(getUserFromIntegrationToken(db, created.token)?.user.id, 'auth-user-1')
})

test('unknown, malformed and non-prefixed tokens resolve to null', () => {
  const db = createDb()
  createIntegrationToken(db, 'auth-user-1', 'Obsidian')

  assert.equal(getUserFromIntegrationToken(db, 'fg_deadbeef'), null)
  assert.equal(getUserFromIntegrationToken(db, ''), null)
  assert.equal(getUserFromIntegrationToken(db, null), null)
  // A better-auth session token must fall through to the session lookup instead
  // of being consumed here.
  assert.equal(getUserFromIntegrationToken(db, 'some-better-auth-session-token'), null)
})

test('resolving a token records last_used_at', () => {
  const db = createDb()
  const created = createIntegrationToken(db, 'auth-user-1', 'Obsidian')
  assert.equal(listIntegrationTokens(db, 'auth-user-1')[0].lastUsedAt, null)

  getUserFromIntegrationToken(db, created.token)

  const [listed] = listIntegrationTokens(db, 'auth-user-1')
  assert.equal(typeof listed.lastUsedAt, 'number')
})

test('listing is scoped to the owner and hides the hash', () => {
  const db = createDb()
  createIntegrationToken(db, 'auth-user-1', 'Mine')
  createIntegrationToken(db, 'auth-user-2', 'Theirs')

  const listed = listIntegrationTokens(db, 'auth-user-1')
  assert.equal(listed.length, 1)
  assert.equal(listed[0].name, 'Mine')
  assert.deepEqual(Object.keys(listed[0]).sort(), ['createdAt', 'id', 'lastUsedAt', 'name', 'tokenPrefix'])
})
