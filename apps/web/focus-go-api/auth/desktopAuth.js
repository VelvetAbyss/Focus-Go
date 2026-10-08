import crypto from 'crypto'
import express from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './betterAuth.js'

// Desktop (Tauri) Google sign-in: the OAuth callbackURL points at the same-origin
// `/api/auth/desktop/callback` (so it carries the better-auth session cookie). That
// endpoint mints a single-use code bound to the session and deep-links back to the
// app, which exchanges it for a Bearer token (the better-auth session token).
//
// See apps/desktop/DESKTOP_AUTH.md.

const CODE_TTL_MS = 60_000
const DEEP_LINK = 'focusgo://auth-callback'

export const ensureDesktopAuthTable = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS desktop_auth_code (
      code          TEXT PRIMARY KEY,
      session_token TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      used          INTEGER NOT NULL DEFAULT 0
    )
  `)
  const columns = db.prepare('PRAGMA table_info(desktop_auth_code)').all().map((column) => column.name)
  for (const column of ['state', 'code_challenge']) {
    if (!columns.includes(column)) db.exec(`ALTER TABLE desktop_auth_code ADD COLUMN ${column} TEXT`)
  }
}

export const desktopCallbackPath = '/api/auth/desktop/callback'

// MUST be registered before the better-auth catch-all (`app.all('/api/auth/*')`).
export const registerDesktopAuthRoutes = (app, db, authInstance = auth) => {
  // Step 2: better-auth redirects here after Google auth (same origin → cookie set).
  app.get(desktopCallbackPath, async (req, res) => {
    const state = req.query.state
    const challenge = req.query.code_challenge
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)
        || typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      return res.status(400).json({ error: 'invalid_desktop_login_binding' })
    }
    try {
      const session = await authInstance.api.getSession({ headers: fromNodeHeaders(req.headers) })
      const token = session?.session?.token
      if (!token) return res.redirect(`${DEEP_LINK}?error=no_session&state=${state}`)

      const code = crypto.randomBytes(32).toString('hex')
      db.prepare(
        'INSERT INTO desktop_auth_code (code, session_token, expires_at, state, code_challenge) VALUES (?, ?, ?, ?, ?)',
      ).run(code, token, Date.now() + CODE_TTL_MS, state, challenge)
      return res.redirect(`${DEEP_LINK}?code=${code}&state=${state}`)
    } catch {
      return res.redirect(`${DEEP_LINK}?error=callback_failed&state=${state}`)
    }
  })

  // Step 4: the desktop app exchanges the one-time code for { token, user }.
  app.post('/api/auth/desktop/exchange', express.json(), (req, res) => {
    const code = req.body?.code
    const state = req.body?.state
    const verifier = req.body?.verifier
    if (!code || typeof code !== 'string' || typeof state !== 'string'
        || typeof verifier !== 'string' || !/^[a-f0-9]{64}$/.test(verifier)) {
      return res.status(400).json({ error: 'missing code' })
    }

    // Best-effort cleanup of stale codes.
    db.prepare('DELETE FROM desktop_auth_code WHERE expires_at < ?').run(Date.now())

    const row = db.prepare('SELECT * FROM desktop_auth_code WHERE code = ?').get(code)
    if (!row || row.used || row.expires_at < Date.now()) {
      return res.status(401).json({ error: 'invalid or expired code' })
    }
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    if (row.state !== state || typeof row.code_challenge !== 'string'
        || row.code_challenge.length !== challenge.length
        || !crypto.timingSafeEqual(Buffer.from(row.code_challenge), Buffer.from(challenge))) {
      return res.status(401).json({ error: 'invalid_desktop_login_binding' })
    }
    db.prepare('UPDATE desktop_auth_code SET used = 1 WHERE code = ?').run(code)

    const sessionRow = db.prepare('SELECT * FROM session WHERE token = ?').get(row.session_token)
    if (!sessionRow || new Date(sessionRow.expiresAt).getTime() <= Date.now()) {
      return res.status(401).json({ error: 'session expired' })
    }
    const user = db.prepare('SELECT * FROM user WHERE id = ?').get(sessionRow.userId)
    if (!user) return res.status(401).json({ error: 'user not found' })

    return res.json({ token: row.session_token, user })
  })
}

// Desktop bearer sessions do not necessarily have a matching browser cookie.
// Revoke that exact session before the better-auth cookie sign-out handler.
export const registerBearerSignOut = (app, db) => {
  const revoke = (req, _res, next) => {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
    if (token) db.prepare('DELETE FROM session WHERE token = ?').run(token)
    next()
  }
  app.post('/api/auth/sign-out', revoke)
  app.post('/auth/sign-out', revoke)
}
