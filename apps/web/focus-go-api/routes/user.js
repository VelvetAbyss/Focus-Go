import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { backfillRegion } from '../middleware/region.js'
import { isAdminEmail } from '../middleware/admin.js'
import { getMembershipStatus } from '../services/payments.js'
import { SYNC_TABLES } from '../sync/config.js'

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan + isAdmin + country_code
router.get('/profile', requireAuth, backfillRegion, async (req, res) => {
  let { user } = req.auth
  const now = Date.now()

  if (user.plan === 'premium' && user.premium_expires_at && user.premium_expires_at <= now) {
    db.prepare(`
      UPDATE users
      SET plan = 'free', premium_expires_at = NULL
      WHERE id = ?
    `).run(user.id)
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
  }

  const membership = getMembershipStatus(db, user.id)
  res.json({
    id: user.id,
    email: user.email,
    ...membership,
    isAdmin: isAdminEmail(user.email),
    // country_code: ISO 3166-1 alpha-2 (e.g. 'CN', 'US'). null = not yet detected.
    // Frontend uses this to set the default payment channel.
    country_code: user.country_code ?? null,
  })
})

// DELETE /user/data — wipe all sync rows + blobs for the authenticated user
// and reset initial_seeded_at so a fresh "重置应用" returns to onboarding.
// Keeps the user row, account, entitlements, payment history, and audit logs.
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
        const result = db.prepare('DELETE FROM sync_blobs WHERE user_id = ?').run(userId)
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

export default router
