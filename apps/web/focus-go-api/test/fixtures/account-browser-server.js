import express from 'express'
import cors from 'cors'
import { betterAuth } from 'better-auth'
import { toNodeHandler } from 'better-auth/node'
process.env.NODE_ENV = 'test'
const { default: database } = await import('../../db/init.js')
const { createRequireAuth } = await import('../../middleware/authPolicy.js')
const { createPolicyAuthOptions } = await import('../../legal/policyConsent.js')
const { createUserRouter } = await import('../../routes/user.js')
const { createSyncRouter } = await import('../../routes/sync.js')
// Isolated in-memory account test, without developer credentials or .env.
const app = express()
app.use(cors({ origin: 'http://127.0.0.1:5186', credentials: true }))
let auth
app.all('/api/auth/*', (req, res) => toNodeHandler(auth)(req, res))
app.use(express.json({ limit: '2mb' }))
const server = app.listen(0, '127.0.0.1', () => {
  const port = server.address().port
  auth = betterAuth({ ...createPolicyAuthOptions(database), database, secret: 'focusgo-account-browser-test-only-secret', baseURL: `http://127.0.0.1:${port}/api/auth`, trustedOrigins: ['http://127.0.0.1:5186'], emailAndPassword: { enabled: true } })
  const authMiddleware = createRequireAuth({ database, auth })
  // Test-only reset in this isolated in-memory fixture; never mounted by the product server.
  app.post('/__test/reset-policy-confirmation', authMiddleware, (req, res) => { database.prepare('DELETE FROM policy_acceptances WHERE auth_user_id = ?').run(req.auth.authUser.id); res.json({ ok: true }) })
  app.use('/user', createUserRouter({ database, authMiddleware }))
  app.post('/seed/claim', authMiddleware, (_req, res) => res.json({ shouldSeed: false, seededAt: null }))
  app.use('/sync', createSyncRouter({ database, authMiddleware }))
  process.stdout.write(`${JSON.stringify({ port })}\n`)
})
process.on('SIGTERM', () => server.close(() => database.close()))
