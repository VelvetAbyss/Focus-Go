import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NODE_ENV = 'test'
const { betterAuth } = await import('better-auth')
const { auth: configuredAuth } = await import('./betterAuth.js')
// BetterAuth disables origin checks under NODE_ENV=test unless explicitly enabled.
const auth = betterAuth({ ...configuredAuth.options, advanced: { disableOriginCheck: false, disableCSRFCheck: false } })
const { DESKTOP_ORIGINS } = await import('./desktopOrigins.js')
const { POLICY_VERSION } = await import('../legal/policyManifest.js')
const call = (origin, path, body) => auth.handler(new Request(`http://localhost:3000/api/auth${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body),
}))
const credentials = () => ({ email: `desktop-${crypto.randomUUID()}@example.test`, password: 'test-only-password-123', name: 'Desktop Test' })
const policyAcceptance = { termsAccepted: true, privacyAcknowledged: true, termsVersion: POLICY_VERSION, privacyVersion: POLICY_VERSION, locale: 'zh' }
test('packaged desktop origins pass real registration and password sign-in CSRF checks', async () => {
  for (const origin of DESKTOP_ORIGINS) {
    const user = credentials()
    const signup = await call(origin, '/sign-up/email', { ...user, policyAcceptance })
    assert.equal(signup.status, 200, `${origin}: ${await signup.text()}`)
    const login = await call(origin, '/sign-in/email', user)
    assert.equal(login.status, 200, `${origin}: ${await login.text()}`)
  }
})
test('untrusted origins remain blocked before registration or sign-in', async () => {
  for (const origin of ['https://attacker.example', 'tauri://attacker', 'https://tauri.localhost.attacker.example']) {
    for (const path of ['/sign-up/email', '/sign-in/email']) {
      const response = await call(origin, path, { ...credentials(), policyAcceptance })
      assert.equal(response.status, 403)
      assert.equal((await response.json()).code, 'INVALID_ORIGIN')
    }
  }
})
