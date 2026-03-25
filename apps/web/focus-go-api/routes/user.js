import { Router } from 'express'
import { getUserInfo } from '../services/authing.js'
import db from '../db/init.js'

const router = Router()

// Upsert user on every authenticated request — keeps email in sync
const upsertUser = (authingId, email) => {
  db.prepare(`
    INSERT INTO users (authing_id, email)
    VALUES (?, ?)
    ON CONFLICT(authing_id) DO UPDATE SET email = excluded.email
  `).run(authingId, email ?? null)
  return db.prepare('SELECT * FROM users WHERE authing_id = ?').get(authingId)
}

// GET /user/profile — validate Bearer token, return id + email + plan
router.get('/profile', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  const accessToken = authHeader.slice(7)
  try {
    const authingUser = await getUserInfo(accessToken)
    const user = upsertUser(authingUser.sub, authingUser.email)
    res.json({ id: user.id, email: user.email, plan: user.plan })
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: err.message })
  }
})

// POST /user/upgrade — upgrade user to premium
router.post('/upgrade', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  const accessToken = authHeader.slice(7)
  try {
    const authingUser = await getUserInfo(accessToken)
    const result = db.prepare(
      "UPDATE users SET plan = 'premium' WHERE authing_id = ?"
    ).run(authingUser.sub)
    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ plan: 'premium' })
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: err.message })
  }
})

export default router
