import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import express from 'express'
import { betterAuth } from 'better-auth'
import { toNodeHandler } from 'better-auth/node'
process.env.NODE_ENV = 'test'
const { default: db } = await import('../db/init.js')
const { createPolicyAuthOptions, getPolicyStatus } = await import('../legal/policyConsent.js')
const { POLICY_VERSION } = await import('../legal/policyManifest.js')
const { registerDesktopAuthRoutes, ensureDesktopAuthTable } = await import('../auth/desktopAuth.js')
const state = 'a'.repeat(64), verifier = 'b'.repeat(64)
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
const params = new URLSearchParams({ state, code_challenge: challenge, termsAccepted: '1', privacyAcknowledged: '1', termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale: 'zh' })
const mergeCookies = (...responses) => {
  const jar = new Map()
  for (const response of responses) for (const value of response.headers.getSetCookie()) {
    const item = value.split(';')[0], split = item.indexOf('=')
    jar.set(item.slice(0, split), item.slice(split + 1))
  }
  return [...jar].map(([key, value]) => `${key}=${value}`).join('; ')
}
for (const [startPath, scheme] of [
  ['/api/auth/desktop/start', 'focusgo:'],
  ['/api/auth/desktop/validation/start', 'focusgo-mail-validation:'],
]) test(`${scheme} Google start, state cookie, callback and PKCE exchange stay bound`, async () => {
  const app = express()
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)) })
  const base = `http://127.0.0.1:${server.address().port}`
  const auth = betterAuth({
    database: db, secret: 'desktop-google-test-only-32-character-secret', baseURL: `${base}/api/auth`, trustedOrigins: [base],
    advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    socialProviders: { google: { clientId: 'test-client', clientSecret: 'test-secret' } }, ...createPolicyAuthOptions(db),
  })
  const context = await auth.$context, provider = context.socialProviders.find(item => item.id === 'google')
  const email = `desktop-${crypto.randomUUID()}@example.test`
  // Only the external Google token/profile exchange is mocked. Browser cookies,
  // BetterAuth state validation, policy hooks and app-code exchange remain real.
  provider.validateAuthorizationCode = async () => ({ accessToken: 'test-only-access' })
  provider.getUserInfo = async () => ({ user: { id: email, name: 'Desktop Test', email, emailVerified: true }, data: { sub: email, email, email_verified: true } })
  ensureDesktopAuthTable(db)
  registerDesktopAuthRoutes(app, db, auth)
  app.all('/api/auth/*', toNodeHandler(auth))
  try {
    const invalid = new URLSearchParams(params); invalid.set('termsVersion', 'old')
    assert.equal((await fetch(`${base}${startPath}?${invalid}`, { redirect: 'manual' })).status, 400)
    assert.equal((await fetch(`${base}${startPath}`, { redirect: 'manual' })).status, 400)
    const start = await fetch(`${base}${startPath}?${params}`, { redirect: 'manual' })
    assert.equal(start.status, 302)
    assert.equal(start.headers.get('cache-control'), 'no-store')
    assert.ok(start.headers.getSetCookie().some(value => value.includes('state=')))
    const google = new URL(start.headers.get('location'))
    assert.equal(google.hostname, 'accounts.google.com')
    const googleState = google.searchParams.get('state')
    const callbackUrl = `${base}/api/auth/callback/google?code=test-code&state=${googleState}`
    // This is the reported failure: external browser has none of WKWebView's cookies.
    const missingCookie = await fetch(callbackUrl, { redirect: 'manual' })
    assert.equal(new URL(missingCookie.headers.get('location')).searchParams.get('error'), 'state_mismatch')
    // Retrying with the initiating browser's cookie passes the real state check.
    const callback = await fetch(callbackUrl, { redirect: 'manual', headers: { Cookie: mergeCookies(start) } })
    assert.equal(callback.status, 302)
    const desktopCallback = new URL(callback.headers.get('location'))
    assert.equal(desktopCallback.pathname, startPath.replace(/start$/, 'callback'))
    assert.equal(desktopCallback.searchParams.get('state'), state)
    const appRedirect = await fetch(desktopCallback, { redirect: 'manual', headers: { Cookie: mergeCookies(start, callback) } })
    assert.equal(appRedirect.status, 302)
    const appUrl = new URL(appRedirect.headers.get('location'))
    assert.equal(appUrl.protocol, scheme)
    assert.ok(appUrl.searchParams.get('code'))
    const exchange = await fetch(`${base}/api/auth/desktop/exchange`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: appUrl.searchParams.get('code'), state, verifier }) })
    assert.equal(exchange.status, 200)
    const session = await exchange.json()
    assert.equal(session.user.email, email)
    assert.equal(getPolicyStatus(db, session.user.id).acceptance.locale, 'zh')
    // An OAuth failure must not silently sign in an old browser session.
    desktopCallback.searchParams.set('error', 'access_denied')
    const failed = await fetch(desktopCallback, { redirect: 'manual', headers: { Cookie: mergeCookies(start, callback) } })
    const failedUrl = new URL(failed.headers.get('location'))
    assert.equal(failedUrl.searchParams.get('error'), 'google_login_failed')
    assert.equal(failedUrl.searchParams.has('code'), false)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
