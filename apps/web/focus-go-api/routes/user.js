import { Router } from 'express'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan
router.get('/profile', requireAuth, async (req, res) => {
  const { user } = req.auth
  res.json({ id: user.id, email: user.email, plan: user.plan })
})

// POST /user/upgrade — upgrade user to premium
router.post('/upgrade', requireAuth, async (req, res) => {
  const { authingUser } = req.auth
  const result = db.prepare(
    "UPDATE users SET plan = 'premium' WHERE authing_id = ?"
  ).run(authingUser.sub)
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' })
  }
  res.json({ plan: 'premium' })
})

export default router
