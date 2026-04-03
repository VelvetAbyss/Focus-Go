import { Router } from 'express'
import { getTokenByCode, getUserInfo } from '../services/authing.js'

const router = Router()

// Check 1: code → Authing /oidc/token → return accessToken + user
router.post('/exchange', async (req, res) => {
  const { code, codeVerifier } = req.body
  if (!code || !codeVerifier) {
    return res.status(400).json({ error: 'code and codeVerifier are required' })
  }
  try {
    const tokenData = await getTokenByCode(code, codeVerifier)
    const user = await getUserInfo(tokenData.access_token)
    res.json({ accessToken: tokenData.access_token, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Check 2: Bearer token → Authing /oidc/me → return user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  const accessToken = authHeader.slice(7)
  try {
    const user = await getUserInfo(accessToken)
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(401).json({ error: err.message })
  }
})

export default router
