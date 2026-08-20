import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { backfillRegion } from '../middleware/region.js'
import { isAdminEmail } from '../middleware/admin.js'
import { SYNC_TABLES } from '../sync/config.js'
import { getCloudStorageUsage } from '../sync/store.js'
import { DEFAULT_CLOUD_SYNC_QUOTA_BYTES } from './sync.js'

const router = Router()

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
    isAdmin: isAdminEmail(user.email),
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
