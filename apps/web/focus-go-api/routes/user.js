import { Router } from 'express'
import { getUserInfo } from '../services/authing.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '../data/plans.json')

const loadPlans = () => {
  if (!existsSync(DB_PATH)) return {}
  try {
    return JSON.parse(readFileSync(DB_PATH, 'utf8'))
  } catch {
    return {}
  }
}

const savePlans = (plans) => {
  const dir = dirname(DB_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(DB_PATH, JSON.stringify(plans, null, 2))
}

const router = Router()

// GET /user/profile — validate Bearer token, return id + email + plan
router.get('/profile', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  const accessToken = authHeader.slice(7)
  try {
    const user = await getUserInfo(accessToken)
    const plans = loadPlans()
    res.json({
      id: user.sub,
      email: user.email,
      plan: plans[user.sub] ?? 'free',
    })
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: err.message })
  }
})

// POST /user/upgrade — upgrade user to premium
router.post('/upgrade', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  const accessToken = authHeader.slice(7)
  try {
    const user = await getUserInfo(accessToken)
    const plans = loadPlans()
    plans[user.sub] = 'premium'
    savePlans(plans)
    res.json({ id: user.sub, plan: 'premium' })
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: err.message })
  }
})

export default router
