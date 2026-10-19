import test from 'node:test'
import assert from 'node:assert/strict'
import { betterAuth } from 'better-auth'
process.env.NODE_ENV = 'test'
const { default: db } = await import('../db/init.js')
const { createPolicyAuthOptions, getPolicyStatus, recordPolicyConfirmation } = await import('../legal/policyConsent.js')
const { POLICY_VERSION } = await import('../legal/policyManifest.js')
const confirmation = { termsAccepted: true, privacyAcknowledged: true, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale: 'zh' }
const base = 'http://localhost:3000'
const auth = betterAuth({ database: db, secret: 'policy-integration-test-only-32-character-secret', baseURL: base, emailAndPassword: { enabled: true }, socialProviders: { google: { clientId: 'test-google-client', clientSecret: 'test-google-secret' } }, ...createPolicyAuthOptions(db) })
const call = (path, body) => auth.handler(new Request(base + '/api/auth' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) }))
const credentials = () => ({ email: `policy-${crypto.randomUUID()}@example.test`, password: 'test-only-password-123', name: 'Policy Test' })
test('email registration rejects missing, false and stale confirmation before creating a user', async () => {
  for (const value of [undefined, { ...confirmation, termsAccepted: false }, { ...confirmation, privacyAcknowledged: false }, { ...confirmation, termsVersion: 'old' }]) {
    const user = credentials(), response = await call('/sign-up/email', { ...user, policyAcceptance: value })
    assert.equal(response.status, 400)
    assert.equal(db.prepare('SELECT id FROM user WHERE email=?').get(user.email), undefined)
  }
})
test('email registration records current edition, locale and server time; retries cannot rewrite history', async () => {
  const before = Date.now(), response = await call('/sign-up/email', { ...credentials(), policyAcceptance: { ...confirmation, acceptedAt: 1 } })
  assert.equal(response.status, 200)
  const { user } = await response.json(), first = getPolicyStatus(db, user.id).acceptance
  assert.equal(first.locale, 'zh'); assert.equal(first.source, 'email-registration'); assert.ok(first.acceptedAt >= before)
  recordPolicyConfirmation(db, user.id, { ...confirmation, locale: 'en' }, 'account-confirmation')
  assert.deepEqual(getPolicyStatus(db, user.id).acceptance, first)
})
const googleCallback = async (email, additionalData) => {
  const context = await auth.$context, provider = context.socialProviders.find(item => item.id === 'google')
  // Mock only the external provider exchange. State, cookies, callback,
  // account creation and policy hooks below are real BetterAuth operations.
  provider.validateAuthorizationCode = async () => ({ accessToken: 'test-only-exchange' })
  provider.getUserInfo = async () => ({ user: { id: email, name: 'Google Test', email, emailVerified: true }, data: { sub: email, email, email_verified: true } })
  const start = await call('/sign-in/social', { provider: 'google', callbackURL: base, disableRedirect: true, ...(additionalData ? { additionalData } : {}) })
  assert.equal(start.status, 200)
  const state = new URL((await start.json()).url).searchParams.get('state')
  const cookie = start.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  return auth.handler(new Request(`${base}/api/auth/callback/google?state=${encodeURIComponent(state)}&code=test-only-code`, { headers: { cookie } }))
}
test('Google redirect carries a server-validated confirmation through the real state/callback flow', async () => {
  const email = `google-${crypto.randomUUID()}@example.test`
  const response = await googleCallback(email, { policyAcceptance: confirmation })
  assert.equal(response.status, 302)
  const user = db.prepare('SELECT id FROM user WHERE email=?').get(email)
  assert.ok(user); assert.equal(getPolicyStatus(db, user.id).acceptance.source, 'google-registration')
})
test('client additionalData cannot forge trusted OAuth confirmation or create an unconfirmed Google account', async () => {
  const email = `forged-${crypto.randomUUID()}@example.test`
  await googleCallback(email, { serverContext: { focusgoPolicyConfirmation: confirmation }, focusgoPolicyConfirmation: confirmation })
  assert.equal(db.prepare('SELECT id FROM user WHERE email=?').get(email), undefined)
})
test('an existing Google sign-in without confirmation does not fabricate acceptance', async () => {
  const email = `legacy-${crypto.randomUUID()}@example.test`
  await googleCallback(email, { policyAcceptance: confirmation })
  const user = db.prepare('SELECT id FROM user WHERE email=?').get(email)
  db.prepare('DELETE FROM policy_acceptances WHERE auth_user_id=?').run(user.id)
  await googleCallback(email)
  assert.equal(getPolicyStatus(db, user.id).acceptance, null)
})
