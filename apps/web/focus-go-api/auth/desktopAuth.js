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
}

export const desktopCallbackPath = '/api/auth/desktop/callback'

// MUST be registered before the better-auth catch-all (`app.all('/api/auth/*')`).
export const registerDesktopAuthRoutes = (app, db) => {
  // Step 2: better-auth redirects here after Google auth (same origin → cookie set).
  app.get(desktopCallbackPath, async (req, res) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
      const token = session?.session?.token
      if (!token) return res.redirect(`${DEEP_LINK}?error=no_session`)

      const code = crypto.randomBytes(32).toString('hex')
      db.prepare(
        'INSERT INTO desktop_auth_code (code, session_token, expires_at) VALUES (?, ?, ?)',
      ).run(code, token, Date.now() + CODE_TTL_MS)
      return res.redirect(`${DEEP_LINK}?code=${code}`)
    } catch {
      return res.redirect(`${DEEP_LINK}?error=callback_failed`)
    }
  })

  // Step 4: the desktop app exchanges the one-time code for { token, user }.
  app.post('/api/auth/desktop/exchange', express.json(), (req, res) => {
    const code = req.body?.code
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'missing code' })
    }

    // Best-effort cleanup of stale codes.
    db.prepare('DELETE FROM desktop_auth_code WHERE expires_at < ?').run(Date.now())

    const row = db.prepare('SELECT * FROM desktop_auth_code WHERE code = ?').get(code)
    if (!row || row.used || row.expires_at < Date.now()) {
      return res.status(401).json({ error: 'invalid or expired code' })
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
