import { Router } from 'express'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createIpRateLimiter, createConcurrencyLimiter } from '../middleware/resourceLimits.js'
import db from '../db/init.js'
import { requireAuth } from '../middleware/auth.js'
import { importNeteasePodcast, resolveNeteaseProgramAudioUrl, syncNeteasePodcasts } from '../services/podcasts.js'

export const createPodcastRouter = ({
  database = db, authMiddleware = requireAuth, fetchImpl = fetch,
  resolveAudio = resolveNeteaseProgramAudioUrl,
  maxStreamBytes = 256 * 1024 * 1024, maxStreamMs = 15 * 60 * 1000,
  allowRequest = createIpRateLimiter({ limit: 60, windowMs: 60 * 60 * 1000 }),
  acquire = createConcurrencyLimiter(),
} = {}) => {
  const router = Router()

  const serializePodcast = (_req, podcast) => podcast

  // Hostname allowlist for Netease audio CDN. Prevents SSRF if the upstream
  // resolver ever returns an unexpected URL (compromise / redirect chain).
  const NETEASE_AUDIO_HOST_RE = /(^|\.)(music\.126\.net|music\.163\.com)$/i

  const isSafeUpstreamUrl = (raw) => {
    try {
      const u = new URL(raw)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
      if (!NETEASE_AUDIO_HOST_RE.test(u.hostname)) return false
      // Reject literal private/loopback IPs as belt-and-braces.
      if (/^(127\.|10\.|192\.168\.|169\.254\.|::1|fc00:|fd00:)/i.test(u.hostname)) return false
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return false
      return true
    } catch {
      return false
    }
  }

  router.get('/netease/stream', async (req, res) => {
    const programId = typeof req.query?.programId === 'string' ? req.query.programId : ''
    if (!/^\d+$/.test(programId)) {
      return res.status(400).send('programId is required')
    }
    if (!allowRequest(req)) return res.status(429).send('Stream rate limit exceeded')
    const release = acquire(req)
    if (!release) return res.status(429).send('Too many active streams')
    const controller = new AbortController()
    const abort = () => controller.abort()
    const timer = setTimeout(abort, maxStreamMs)
    req.once('aborted', abort)
    res.once('close', abort)
    try {
      let audioUrl = await resolveAudio(programId, controller.signal)
      if (!audioUrl) return res.status(404).send('No playable source')
      let upstream
      for (let hop = 0; hop <= 3; hop++) {
        if (!isSafeUpstreamUrl(audioUrl)) return res.status(502).send('Upstream URL not allowed')
        upstream = await fetchImpl(audioUrl, {
          redirect: 'manual', signal: controller.signal,
          headers: typeof req.headers.range === 'string' ? { Range: req.headers.range } : undefined,
        })
        if (upstream.status >= 300 && upstream.status < 400) {
          await upstream.body?.cancel()
          const location = upstream.headers.get('location')
          if (!location || hop === 3) return res.status(502).send('Invalid upstream redirect')
          audioUrl = new URL(location, audioUrl).href
          continue
        }
        break
      }
      if (!upstream.ok) { await upstream.body?.cancel(); return res.status(upstream.status).send('Upstream audio source failed') }
      const contentLength = upstream.headers.get('content-length')
      if (contentLength && Number(contentLength) > maxStreamBytes) {
        await upstream.body?.cancel()
        return res.status(413).send('Audio stream too large')
      }
      res.status(upstream.status)
      res.set('Cache-Control', 'no-store')
      for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(key)
        if (value) res.set(key, value)
      }
      if (req.method === 'HEAD' || !upstream.body) { await upstream.body?.cancel(); return res.end() }
      let bytes = 0
      const cap = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length
        if (bytes > maxStreamBytes) { controller.abort(); callback(new Error('Audio stream too large')) }
        else callback(null, chunk)
      } })
      await pipeline(Readable.fromWeb(upstream.body), cap, res)
    } catch (error) {
      if (!res.headersSent && !res.destroyed) res.status(controller.signal.aborted ? 504 : 502).send('Audio stream unavailable')
      else if (!res.destroyed) res.destroy()
    } finally {
      clearTimeout(timer)
      controller.abort()
      req.removeListener('aborted', abort)
      res.removeListener('close', abort)
      release()
    }
  })

  // Dev-only auth shortcut. Uses TCP peer address (not headers) and is
  // disabled in production.
  const isLocalhostRequest = (req) => {
    if (process.env.NODE_ENV === 'production') return false
    const ip = req.socket?.remoteAddress ?? ''
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
  }

  router.use(async (req, res, next) => {
    if (isLocalhostRequest(req) && !req.headers.authorization) {
      req.auth = { user: { id: 'local-dev-user' } }
      return next()
    }
    return authMiddleware(req, res, next)
  })

  router.post('/netease/import', async (req, res) => {
    const userId = String(req.auth.user.id)
    const input = typeof req.body?.input === 'string' ? req.body.input : ''
    if (!input.trim()) {
      return res.status(400).json({ error: 'input is required' })
    }
    try {
      const podcast = await importNeteasePodcast(database, userId, input)
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
      const podcasts = await syncNeteasePodcasts(database, userId, sourceIds)
      return res.json({ podcasts: podcasts.map((podcast) => serializePodcast(req, podcast)) })
    } catch (error) {
      console.error(error)
      return res.status(500).json({ error: error.message })
    }
  })

  return router

}

export default createPodcastRouter()
