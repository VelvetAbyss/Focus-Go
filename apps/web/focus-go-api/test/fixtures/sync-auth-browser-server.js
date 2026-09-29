import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { betterAuth } from 'better-auth'
import { toNodeHandler } from 'better-auth/node'
import { createSyncRouter } from '../../routes/sync.js'
import { ensureSyncTables } from '../../sync/store.js'

// Isolated in-memory API for the two-browser sync regression. It never uses
// the developer's account, credentials, or persistent API database.
const database = new Database(':memory:')
database.exec(`
  CREATE TABLE user (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE session (
    id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id)
  );
  CREATE TABLE account (
    id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id), accessToken TEXT, refreshToken TEXT,
    idToken TEXT, accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT,
    scope TEXT, password TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  );
  CREATE TABLE verification (
    id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL,
    expiresAt TEXT NOT NULL, createdAt TEXT, updatedAt TEXT
  );
`)
ensureSyncTables(database)

const app = express()
app.use(cors({ origin: 'http://127.0.0.1:5178', credentials: true }))
let auth
app.all('/api/auth/*', (req, res) => toNodeHandler(auth)(req, res))
app.use(express.json({ limit: '8mb' }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))
const requireTestAccount = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '')
  const session = database.prepare('SELECT userId, expiresAt FROM session WHERE token = ?').get(token)
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    return res.status(401).json({ error: 'invalid_session' })
  }
  req.auth = { user: { id: session.userId, plan: 'free' } }
  next()
}
app.get('/user/profile', requireTestAccount, (req, res) => res.json({
  id: req.auth.user.id,
  email: database.prepare('SELECT email FROM user WHERE id = ?').get(req.auth.user.id)?.email ?? null,
  isSupporter: false,
  isAdmin: false,
  cloudSync: { usedBytes: 0, payloadBytes: 0, blobBytes: 0, limitBytes: 250 * 1024 * 1024 },
}))
app.post('/seed/claim', requireTestAccount, (_req, res) => res.json({ shouldSeed: false, seededAt: null }))
app.use('/sync', createSyncRouter({ database, authMiddleware: requireTestAccount }))

const server = app.listen(0, '127.0.0.1', () => {
  const port = server.address().port
  auth = betterAuth({
    database,
    secret: 'focusgo-browser-sync-test-secret-32chars',
    baseURL: `http://127.0.0.1:${port}/api/auth`,
    trustedOrigins: ['http://127.0.0.1:5178'],
    emailAndPassword: { enabled: true },
  })
  process.stdout.write(`${JSON.stringify({ port })}\n`)
})

process.on('SIGTERM', () => server.close(() => database.close()))
