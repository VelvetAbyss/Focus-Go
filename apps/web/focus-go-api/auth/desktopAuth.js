import crypto from 'crypto'
import express from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './betterAuth.js'
import { validatePolicyConfirmation } from '../legal/policyConsent.js'

// Desktop (Tauri) Google sign-in: the OAuth callbackURL points at the same-origin
// `/api/auth/desktop/callback` (so it carries the better-auth session cookie). That
// endpoint mints a single-use code bound to the session and deep-links back to the
// app, which exchanges it for a Bearer token (the better-auth session token).
//
// See apps/desktop/DESKTOP_AUTH.md.

const CODE_TTL_MS = 60_000
// Destinations are fixed server-side: a query parameter can never choose a URL.
const CALLBACK_DESTINATIONS = [
  ['/api/auth/desktop/callback', 'focusgo://auth-callback'],
  ['/api/auth/desktop/validation/callback', 'focusgo-mail-validation://auth-callback'],
]

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
  // Start OAuth in the same external browser that will receive Google's
  // callback. Starting it inside WKWebView strands the state cookie there.
  for (const [callbackPath] of CALLBACK_DESTINATIONS) app.get(callbackPath.replace(/callback$/, 'start'), async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.set('Referrer-Policy', 'no-referrer')
    const state = req.query.state, challenge = req.query.code_challenge
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)
        || typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      return res.status(400).send('登录链接已失效。请回到 FocusGO，重新点击 Google 登录。')
    }
    try {
      const policyAcceptance = validatePolicyConfirmation({
        termsAccepted: req.query.termsAccepted === '1',
        privacyAcknowledged: req.query.privacyAcknowledged === '1',
        termsVersion: req.query.termsVersion, privacyVersion: req.query.privacyVersion, locale: req.query.locale,
      })
      const { baseURL } = await authInstance.$context
      const callback = new URL(callbackPath, baseURL)
      callback.searchParams.set('state', state)
      callback.searchParams.set('code_challenge', challenge)
      const headers = fromNodeHeaders(req.headers)
      headers.set('Content-Type', 'application/json')
      // This server constructs the fixed same-origin request after validating
      // its input. Keep BetterAuth's handler, rate limit and cookie checks.
      headers.set('Origin', new URL(baseURL).origin)
      headers.delete('content-length')
      headers.delete('host')
      const response = await authInstance.handler(new Request(`${baseURL}/sign-in/social`, {
        method: 'POST', headers, body: JSON.stringify({
          provider: 'google', callbackURL: callback.href, errorCallbackURL: callback.href,
          disableRedirect: true, additionalData: { policyAcceptance },
        }),
      }))
      const payload = await response.json()
      if (!response.ok || typeof payload.url !== 'string') {
        if (response.status === 429) {
          const retry = response.headers.get('x-retry-after')
          if (retry) res.set('Retry-After', retry)
          return res.status(429).send('登录尝试过于频繁。请稍后回到 FocusGO 重试。')
        }
        return res.status(response.ok ? 502 : response.status).send('未能开始 Google 登录。请回到 FocusGO 重试。')
      }
      const providerUrl = new URL(payload.url)
      if (providerUrl.protocol !== 'https:' || providerUrl.hostname !== 'accounts.google.com') {
        return res.status(502).send('登录服务返回了无效地址。请稍后重试。')
      }
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader('Set-Cookie', cookies)
      return res.redirect(providerUrl.href)
    } catch (error) {
      const status = error?.body?.code === 'POLICY_CONFIRMATION_REQUIRED' ? 400 : 502
      return res.status(status).send(status === 400
        ? '请回到 FocusGO，阅读并确认当前条款和隐私告知后重试。'
        : '暂时无法开始 Google 登录。请回到 FocusGO 重试。')
    }
  })

  // Step 2: better-auth redirects here after Google auth (same origin → cookie set).
  // The isolated validation app uses its own scheme and credential store. Both
  // routes retain the same session, state, PKCE and one-time exchange checks.
  for (const [path, deepLink] of CALLBACK_DESTINATIONS) app.get(path, async (req, res) => {
    res.set('Cache-Control', 'no-store')
    const state = req.query.state
    const challenge = req.query.code_challenge
    if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state)
        || typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
      return res.status(400).json({ error: 'invalid_desktop_login_binding' })
    }
    if (req.query.error) return res.redirect(`${deepLink}?error=google_login_failed&state=${state}`)
    try {
      const session = await authInstance.api.getSession({ headers: fromNodeHeaders(req.headers) })
      const token = session?.session?.token
      if (!token) return res.redirect(`${deepLink}?error=no_session&state=${state}`)

      const code = crypto.randomBytes(32).toString('hex')
      db.prepare(
        'INSERT INTO desktop_auth_code (code, session_token, expires_at, state, code_challenge) VALUES (?, ?, ?, ?, ?)',
      ).run(code, token, Date.now() + CODE_TTL_MS, state, challenge)
      return res.redirect(`${deepLink}?code=${code}&state=${state}`)
    } catch {
      return res.redirect(`${deepLink}?error=callback_failed&state=${state}`)
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
