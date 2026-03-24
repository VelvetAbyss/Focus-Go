import { Router } from 'express'
import { getTokenByCode, getUserInfo } from '../services/authing.js'

const router = Router()

router.post('/callback', async (req, res) => {
  const { code } = req.body
  if (!code) {
    return res.status(400).json({ error: 'code is required' })
  }
  try {
    const tokenData = await getTokenByCode(code)
    const user = await getUserInfo(tokenData.access_token)
    res.json({ accessToken: tokenData.access_token, user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router
