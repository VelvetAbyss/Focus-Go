import { Router } from 'express'
import { Readable } from 'node:stream'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { importNeteasePodcast, resolveNeteaseProgramAudioUrl, syncNeteasePodcasts } from '../services/podcasts.js'

const router = Router()

const serializePodcast = (_req, podcast) => podcast

router.get('/netease/stream', async (req, res) => {
  const programId = typeof req.query?.programId === 'string' ? req.query.programId : ''
  if (!/^\d+$/.test(programId)) {
    return res.status(400).send('programId is required')
  }
  try {
    const audioUrl = await resolveNeteaseProgramAudioUrl(programId)
    if (!audioUrl) {
      return res.status(404).send('No playable source')
    }
    const upstream = await fetch(audioUrl, {
      headers: typeof req.headers.range === 'string' ? { Range: req.headers.range } : undefined,
    })
    if (!upstream.ok) {
      return res.status(upstream.status).send('Upstream audio source failed')
    }
    res.status(upstream.status)
    res.set('Cache-Control', 'no-store')
    const contentType = upstream.headers.get('content-type')
    const contentLength = upstream.headers.get('content-length')
    const contentRange = upstream.headers.get('content-range')
    const acceptRanges = upstream.headers.get('accept-ranges')
    if (contentType) res.set('Content-Type', contentType)
    if (contentLength) res.set('Content-Length', contentLength)
    if (contentRange) res.set('Content-Range', contentRange)
    if (acceptRanges) res.set('Accept-Ranges', acceptRanges)
    if (req.method === 'HEAD') return res.end()
    if (!upstream.body) return res.end()
    Readable.fromWeb(upstream.body).pipe(res)
    return
  } catch (error) {
    console.error(error)
    return res.status(500).send(error.message)
  }
})

const isLocalhostRequest = (req) => {
  const origin = String(req.headers.origin ?? '')
  const host = String(req.headers.host ?? '')
  return origin.startsWith('http://localhost:5174')
    || origin.startsWith('http://localhost:5173')
    || /^localhost:3000$/.test(host)
    || /^127\.0\.0\.1:3000$/.test(host)
}

router.use(async (req, res, next) => {
  if (isLocalhostRequest(req) && !req.headers.authorization) {
    req.auth = { user: { id: 'local-dev-user' } }
    return next()
  }
  return requireAuth(req, res, next)
})

router.post('/netease/import', async (req, res) => {
  const userId = String(req.auth.user.id)
  const input = typeof req.body?.input === 'string' ? req.body.input : ''
  if (!input.trim()) {
    return res.status(400).json({ error: 'input is required' })
  }
  try {
    const podcast = await importNeteasePodcast(db, userId, input)
    return res.json({ podcast: serializePodcast(req, podcast) })
  } catch (error) {
    console.error(error)
    if (String(error?.message ?? '').startsWith('NETEASE_PODCAST_LIMIT:')) {
      return res.status(400).json({ error: error.message })
    }
    return res.status(500).json({ error: error.message })
  }
})

router.post('/netease/sync', async (req, res) => {
  const userId = String(req.auth.user.id)
  const sourceIds = Array.isArray(req.body?.sourceIds) ? req.body.sourceIds.map((item) => String(item)) : []
  try {
    const podcasts = await syncNeteasePodcasts(db, userId, sourceIds)
    return res.json({ podcasts: podcasts.map((podcast) => serializePodcast(req, podcast)) })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message })
  }
})

export default router
