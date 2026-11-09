import test from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'
import { getMigrations } from 'better-auth/db/migration'

test('bearer session renewal extends active sessions but never revives expired or revoked sessions', async () => {
  const database = new Database(':memory:')
  const options = {
    database,
    secret: 'isolated-session-renewal-test-secret-32chars',
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
    plugins: [bearer()],
    session: { expiresIn: 3600, updateAge: 60 },
  }
  try {
    await (await getMigrations(options)).runMigrations()
    const auth = betterAuth(options)
    const signup = await auth.api.signUpEmail({ body: { email: 'renewal@example.test', password: 'test-password-12345', name: 'Test' } })
    const token = signup.token
    const soon = new Date(Date.now() + 30_000)
    database.prepare('UPDATE session SET expiresAt = ? WHERE token = ?').run(soon.toISOString(), token)
    const headers = new Headers({ authorization: `Bearer ${token}` })
    const renewed = await auth.api.getSession({ headers })
    assert.equal(renewed.session.token, token)
    assert.ok(new Date(renewed.session.expiresAt).getTime() > Date.now() + 3_000_000)
    database.prepare('UPDATE session SET expiresAt = ? WHERE token = ?').run(new Date(Date.now() - 1000).toISOString(), token)
    assert.equal(await auth.api.getSession({ headers }), null)
    assert.equal(await auth.api.getSession({ headers: new Headers({ authorization: 'Bearer revoked-token' }) }), null)
  } finally { database.close() }
})
