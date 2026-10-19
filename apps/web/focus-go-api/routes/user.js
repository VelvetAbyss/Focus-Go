import { ensurePolicyConsentTable, getPolicyStatus, recordPolicyConfirmation } from '../legal/policyConsent.js'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { backfillRegion } from '../middleware/region.js'
import { isAdminIdentity } from '../middleware/admin.js'
import { SYNC_TABLES } from '../sync/config.js'
import { getCloudStorageUsage } from '../sync/store.js'
import { DEFAULT_CLOUD_SYNC_QUOTA_BYTES } from './sync.js'

export const createUserRouter = ({ database = db, authMiddleware = requireAuth } = {}) => {
  const db = database
  const requireAuth = authMiddleware
  const router = Router()
  ensurePolicyConsentTable(db)
  db.exec(`CREATE TABLE IF NOT EXISTS user_profiles (
    auth_user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
    profile TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL
  )`)
  const activeSession = (req) => {
    const row = db.prepare('SELECT expiresAt FROM session WHERE id=? AND userId=?').get(req.auth.session.id, req.auth.authUser.id)
    return row && new Date(row.expiresAt).getTime() > Date.now()
      && db.prepare("SELECT id FROM users WHERE id=? AND status='active'").get(req.auth.user.id)
  }
  const managed = (req, res, next) => {
    if (req.auth.session?.kind === 'integration' || !req.auth.authUser?.id) return res.status(403).json({ error: 'interactive_session_required' })
    if (req.method !== 'GET' && !req.is('application/json')) return res.status(415).json({ error: 'json_required' })
    if (!activeSession(req)) return res.status(401).json({ error: 'session_expired' })
    next()
  }
  const accountProfile = (authId) => {
    const user = db.prepare('SELECT id,name,email,emailVerified,image FROM user WHERE id=?').get(authId)
    const row = db.prepare('SELECT * FROM user_profiles WHERE auth_user_id=?').get(authId)
    return { ...user, emailVerified: Boolean(user.emailVerified), profile: row ? JSON.parse(row.profile) : {}, revision: row?.revision ?? 0 }
  }
  const attempts = new Map()
  const sensitive = (req, res, next) => {
    const key = req.auth.authUser.id, now = Date.now()
    if (attempts.size > 5000) for (const [id, value] of attempts) if (value.until < now) attempts.delete(id)
    let entry = attempts.get(key)
    if (!entry || entry.until < now) { entry = { count: 0, until: now + 10 * 60_000 }; attempts.set(key, entry) }
    if (++entry.count > 8) return res.status(429).json({ error: 'too_many_attempts' })
    next()
  }
  const credential = (id) => db.prepare("SELECT id,password FROM account WHERE userId=? AND providerId='credential'").get(id)
  const verify = async (userId, password) => {
    const row = credential(userId)
    return typeof password === 'string' && password.length <= 128 && Boolean(row?.password)
      && await verifyPassword({ hash: row.password, password })
  }

  router.get('/policy', requireAuth, managed, (req, res) => res.json(getPolicyStatus(db, req.auth.authUser.id)))
  router.post('/policy', requireAuth, managed, (req, res) => {
    try { res.json({ acceptance: recordPolicyConfirmation(db, req.auth.authUser.id, req.body, 'account-confirmation') }) }
    catch (error) { res.status(error?.statusCode === 400 ? 400 : 500).json({ error: error?.statusCode === 400 ? 'POLICY_CONFIRMATION_REQUIRED' : 'policy_confirmation_failed' }) }
  })

  router.patch('/profile', requireAuth, managed, (req, res) => {
    const { revision, patch } = req.body ?? {}
    if (!Number.isSafeInteger(revision) || revision < 0 || !patch || typeof patch !== 'object' || Array.isArray(patch)) return res.status(400).json({ error: 'invalid_profile' })
    const limits = { name: 65, pronouns: 40, role: 120, location: 120, birthday: 10, bio: 1000 }
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'avatar') {
        if (value !== null && (typeof value !== 'string' || value.length > 350_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))) return res.status(400).json({ error: 'invalid_avatar' })
      } else if (!Object.hasOwn(limits, key) || typeof value !== 'string' || value.length > limits[key] || (key === 'name' && !value.trim())) return res.status(400).json({ error: 'invalid_profile' })
    }
    const authId = req.auth.authUser.id
    const result = db.transaction(() => {
      const current = accountProfile(authId)
      if (revision !== current.revision) return null
      const profile = { ...current.profile }
      for (const [key, value] of Object.entries(patch)) if (key !== 'name') profile[key] = typeof value === 'string' ? value.trim() : value
      const timestamp = Date.now()
      db.prepare(`INSERT INTO user_profiles(auth_user_id,profile,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(auth_user_id) DO UPDATE SET profile=excluded.profile,revision=excluded.revision,updated_at=excluded.updated_at`)
        .run(authId, JSON.stringify(profile), revision + 1, timestamp)
      db.prepare('UPDATE user SET name=?,image=?,updatedAt=? WHERE id=?').run(patch.name?.trim() ?? current.name, Object.hasOwn(patch, 'avatar') ? patch.avatar : current.image, new Date(timestamp).toISOString(), authId)
      return accountProfile(authId)
    })()
    if (!result) return res.status(409).json({ error: 'profile_changed', account: accountProfile(authId) })
    res.json({ account: result })
  })

  router.get('/account', requireAuth, managed, (req, res) => {
    const id = req.auth.authUser.id
    const providers = db.prepare('SELECT DISTINCT providerId FROM account WHERE userId=?').all(id).map(row => row.providerId)
    const sessions = db.prepare('SELECT id,createdAt,updatedAt,expiresAt,ipAddress,userAgent FROM session WHERE userId=?').all(id)
      .filter(row => new Date(row.expiresAt).getTime() > Date.now()).map(row => ({ ...row, current: row.id === req.auth.session.id }))
    res.json({ providers, hasPassword: Boolean(credential(id)?.password), emailVerified: Boolean(req.auth.authUser.emailVerified), sessions, emailChangeAvailable: false, twoFactorAvailable: false })
  })
  router.post('/sessions/:id/revoke', requireAuth, managed, (req, res) => {
    if (req.params.id === req.auth.session.id) return res.status(400).json({ error: 'use_sign_out_for_current_session' })
    const result = db.prepare('DELETE FROM session WHERE id=? AND userId=?').run(req.params.id, req.auth.authUser.id)
    if (!result.changes) return res.status(404).json({ error: 'session_not_found' })
    res.json({ ok: true })
  })
  router.post('/sessions/revoke-others', requireAuth, managed, (req, res) => {
    db.prepare('DELETE FROM session WHERE userId=? AND id<>?').run(req.auth.authUser.id, req.auth.session.id)
    res.json({ ok: true })
  })
  const safely = handler => async (req, res) => {
    try { await handler(req, res) } catch { res.status(500).json({ error: 'account_operation_failed' }) }
  }
  router.post('/password', requireAuth, managed, sensitive, safely(async (req, res) => {
    const previousHash = credential(req.auth.authUser.id)?.password
    const { currentPassword, newPassword } = req.body ?? {}
    if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128 || !(await verify(req.auth.authUser.id, currentPassword))) return res.status(400).json({ error: 'invalid_password' })
    const hash = await hashPassword(newPassword)
    const changed = db.transaction(() => {
      if (!activeSession(req) || credential(req.auth.authUser.id)?.password !== previousHash) return false
      db.prepare("UPDATE account SET password=?,updatedAt=? WHERE userId=? AND providerId='credential'").run(hash, new Date().toISOString(), req.auth.authUser.id)
      db.prepare('DELETE FROM session WHERE userId=? AND id<>?').run(req.auth.authUser.id, req.auth.session.id)
      return true
    })()
    if (!changed) return res.status(409).json({ error: 'account_state_changed' })
    res.json({ ok: true })
  }))
  router.post('/account/deletion', requireAuth, managed, sensitive, safely(async (req, res) => {
    const { confirmEmail, password } = req.body ?? {}, id = req.auth.authUser.id
    if (typeof confirmEmail !== 'string' || confirmEmail.trim().toLowerCase() !== req.auth.authUser.email.toLowerCase()) return res.status(400).json({ error: 'email_confirmation_required' })
    const previousHash = credential(id)?.password
    if (previousHash) {
      if (!(await verify(id, password))) return res.status(400).json({ error: 'invalid_password' })
    } else {
      const age = Date.now() - new Date(req.auth.session.createdAt).getTime()
      if (!Number.isFinite(age) || age < 0 || age > 5 * 60_000) return res.status(403).json({ error: 'recent_login_required' })
    }
    const now = Date.now()
    const changed = db.transaction(() => {
      if (!activeSession(req) || credential(id)?.password !== previousHash) return false
      const result = db.prepare("UPDATE users SET status='deletion_pending',deletion_requested_at=?,deletion_pending_at=? WHERE id=? AND status='active'").run(now, now, req.auth.user.id)
      if (result.changes !== 1) throw new Error('account_state_changed')
      const exists = name => Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name))
      if (exists('desktop_auth_code')) db.prepare('DELETE FROM desktop_auth_code WHERE session_token IN (SELECT token FROM session WHERE userId=?)').run(id)
      if (exists('integration_token')) db.prepare('UPDATE integration_token SET revoked_at=? WHERE user_id=?').run(now, id)
      db.prepare('DELETE FROM session WHERE userId=?').run(id)
      return true
    })()
    if (!changed) return res.status(409).json({ error: 'account_state_changed' })
    res.json({ ok: true, status: 'deletion_pending', deletionEligibleAt: now + 7 * 86400_000 })
  }))

  // GET /user/profile — profile for free local-first use and optional cloud sync.
  router.get('/profile', requireAuth, backfillRegion, async (req, res) => {
    const { user } = req.auth
    const limitBytes = Number.parseInt(process.env.FREE_SYNC_QUOTA_BYTES ?? '', 10) || DEFAULT_CLOUD_SYNC_QUOTA_BYTES
    const usage = getCloudStorageUsage(db, String(user.id))
    res.json({
      id: user.id,
      email: user.email,
      isSupporter: Boolean(user.is_supporter),
      cloudSync: { ...usage, limitBytes },
      isAdmin: isAdminIdentity(req.auth),
      ...(req.auth.authUser?.id && req.auth.session?.kind !== 'integration' ? { account: accountProfile(req.auth.authUser.id) } : {}),
    })
  })

  // DELETE /user/data — wipe all sync rows + blobs for the authenticated user
  // and reset initial_seeded_at so a fresh "重置应用" returns to onboarding.
  // Keeps the user row, account, sync data, and audit logs.
  router.delete('/data', requireAuth, (req, res) => {
    try {
      // Explicit confirmation token. Prevents a stray DELETE (CSRF surface, dev
      // tools fat-finger, third-party browser extension) from nuking an account.
      // The string is intentionally specific and not derivable from the URL.
      if (req.body?.confirm !== 'wipe-my-data') {
        return res.status(400).json({ error: "missing confirmation: body must include { confirm: 'wipe-my-data' }" })
      }
      const userId = String(req.auth.user.id)
      const now = Date.now()
      let rowsDeleted = 0

      db.transaction(() => {
        for (const tableName of Object.values(SYNC_TABLES)) {
          try {
            const result = db.prepare(`DELETE FROM ${tableName} WHERE user_id = ?`).run(userId)
            rowsDeleted += result.changes ?? 0
          } catch { /* table may not exist on older deployments */ }
        }
        try {
          const result = db.prepare('DELETE FROM sync_user_blobs WHERE user_id = ?').run(userId)
          rowsDeleted += result.changes ?? 0
        } catch { /* ignore */ }
        db.prepare('UPDATE users SET initial_seeded_at = NULL WHERE id = ?').run(req.auth.user.id)
      })()

      res.json({ ok: true, wipedAt: now, rowsDeleted })
    } catch (err) {
      console.error('[user/data DELETE]', err)
      res.status(500).json({ error: err.message ?? 'Internal error' })
    }
  })

  return router
}

export default createUserRouter()
