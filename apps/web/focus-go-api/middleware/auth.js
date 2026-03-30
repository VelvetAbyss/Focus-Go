import { getUserInfo } from '../services/authing.js'
import db from '../db/init.js'

const upsertUser = (authingId, email) => {
  db.prepare(`
    INSERT INTO users (authing_id, email)
    VALUES (?, ?)
    ON CONFLICT(authing_id) DO UPDATE SET email = excluded.email
  `).run(authingId, email ?? null)
  return db.prepare('SELECT * FROM users WHERE authing_id = ?').get(authingId)
}

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }

  try {
    const accessToken = authHeader.slice(7)
    const authingUser = await getUserInfo(accessToken)
    const user = upsertUser(authingUser.sub, authingUser.email)
    req.auth = { authingUser, user }
    return next()
  } catch (error) {
    console.error(error)
    return res.status(401).json({ error: error.message })
  }
}
