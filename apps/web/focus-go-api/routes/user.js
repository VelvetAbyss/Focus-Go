import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { isAdminEmail } from '../middleware/admin.js'

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan + isAdmin
router.get('/profile', requireAuth, async (req, res) => {
  const { user } = req.auth
  const expiresAt = user.premium_expires_at ? new Date(user.premium_expires_at).toISOString() : null
  res.json({ id: user.id, email: user.email, plan: user.plan, expiresAt, isAdmin: isAdminEmail(user.email) })
})

export default router
