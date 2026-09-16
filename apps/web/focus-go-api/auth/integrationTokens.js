import crypto from 'crypto'

// Long-lived integration tokens for headless clients (the Obsidian plugin being
// the first). Unlike better-auth session tokens these never expire on their own —
// they are revoked explicitly from the app's settings page.
//
// Only the SHA-256 of the token is stored. The plaintext is returned exactly once,
// at creation time, and is unrecoverable afterwards. `token_prefix` exists purely
// so the settings UI can show a recognisable stub ("fg_1a2b3c4d…") next to each row.

const TOKEN_PREFIX = 'fg_'
const PREFIX_DISPLAY_LENGTH = 8

export const hashIntegrationToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex')

export const ensureIntegrationTokenTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS integration_token (
      id           TEXT PRIMARY KEY,
      token_hash   TEXT NOT NULL UNIQUE,
      token_prefix TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at   INTEGER
    )
  `)
  db.exec('CREATE INDEX IF NOT EXISTS idx_integration_token_user ON integration_token (user_id)')
}

export const createIntegrationToken = (db, userId, name) => {
  const token = `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`
  const id = crypto.randomUUID()
  const createdAt = Date.now()
  db.prepare(`
    INSERT INTO integration_token (id, token_hash, token_prefix, user_id, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    hashIntegrationToken(token),
    token.slice(0, TOKEN_PREFIX.length + PREFIX_DISPLAY_LENGTH),
    String(userId),
    name,
    createdAt,
  )
  // `token` is the only time the plaintext exists outside the client.
  return { id, token, name, createdAt, tokenPrefix: token.slice(0, TOKEN_PREFIX.length + PREFIX_DISPLAY_LENGTH) }
}

export const listIntegrationTokens = (db, userId) =>
  db
    .prepare(`
      SELECT id, token_prefix, name, created_at, last_used_at
      FROM integration_token
      WHERE user_id = ? AND revoked_at IS NULL
      ORDER BY created_at DESC
    `)
    .all(String(userId))
    .map((row) => ({
      id: row.id,
      tokenPrefix: row.token_prefix,
      name: row.name,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
    }))

export const revokeIntegrationToken = (db, userId, id) =>
  db
    .prepare('UPDATE integration_token SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL')
    .run(Date.now(), String(id), String(userId)).changes > 0

/**
 * Resolve a presented bearer token to a better-auth user row, or null.
 * Touches `last_used_at` on success so the settings page can show liveness.
 */
export const getUserFromIntegrationToken = (db, token) => {
  if (!token || typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) return null
  const row = db
    .prepare('SELECT * FROM integration_token WHERE token_hash = ? AND revoked_at IS NULL')
    .get(hashIntegrationToken(token))
  if (!row) return null
  const user = db.prepare('SELECT * FROM user WHERE id = ?').get(row.user_id)
  if (!user) return null
  db.prepare('UPDATE integration_token SET last_used_at = ? WHERE id = ?').run(Date.now(), row.id)
  return { user, tokenRow: row }
}
