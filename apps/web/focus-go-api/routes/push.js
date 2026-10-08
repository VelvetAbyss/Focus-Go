import { Router } from 'express'
import { parseSubscriptionBody, isAllowedPushEndpoint } from '../push/config.js'
import { handlePushError, sendWebPush } from '../push/scheduler.js'
import {
  deletePushSubscriptionForUser,
  getPushSubscriptionByEndpoint,
  recordPushSuccess,
  upsertPushSubscription,
} from '../push/store.js'

const TEST_COOLDOWN_MS = 10_000

/**
 * Web Push for task reminders. A device subscribes after the user turns it on in Settings; the
 * reminder scheduler then sends to it while the app is closed.
 */
export const createPushRouter = ({ database, authMiddleware, vapid, send = sendWebPush, isAllowedEndpoint = isAllowedPushEndpoint }) => {
  const router = Router()
  const lastTestAt = new Map()

  // The public key is public by design; the client needs it before it can subscribe.
  router.get('/config', (_req, res) => {
    res.json({ enabled: Boolean(vapid?.publicKey), publicKey: vapid?.publicKey ?? null })
  })

  router.post('/subscriptions', authMiddleware, (req, res) => {
    const parsed = parseSubscriptionBody(req.body, { isAllowedEndpoint })
    if (!parsed) return res.status(400).json({ error: 'invalid_subscription' })
    const id = upsertPushSubscription(database, {
      userId: String(req.auth.user.id),
      ...parsed,
      userAgent: String(req.get('user-agent') ?? '').slice(0, 300),
    })
    res.json({ ok: true, id, leadMinutes: parsed.leadMinutes })
  })

  router.delete('/subscriptions', authMiddleware, (req, res) => {
    const endpoint = req.body?.endpoint
    if (typeof endpoint !== 'string') return res.status(400).json({ error: 'missing_endpoint' })
    res.json({ ok: true, removed: deletePushSubscriptionForUser(database, String(req.auth.user.id), endpoint) })
  })

  // Lets Settings confirm the whole chain works on this device.
  router.post('/test', authMiddleware, async (req, res) => {
    const userId = String(req.auth.user.id)
    const subscription = typeof req.body?.endpoint === 'string' ? getPushSubscriptionByEndpoint(database, req.body.endpoint) : null
    if (!subscription || subscription.userId !== userId) return res.status(404).json({ error: 'subscription_not_found' })
    const now = Date.now()
    if (now - (lastTestAt.get(subscription.id) ?? 0) < TEST_COOLDOWN_MS) return res.status(429).json({ error: 'too_many_tests' })
    lastTestAt.set(subscription.id, now)
    try {
      await send(subscription, {
        kind: 'test',
        title: 'Focus&go',
        body: subscription.language === 'en'
          ? 'Reminders will reach you here even with the app closed.'
          : '关掉页面后，任务提醒也会出现在这里。',
        language: subscription.language,
        tag: 'focusgo-push-test',
        url: '/workspace/settings',
      }, vapid)
      recordPushSuccess(database, subscription.id, now)
      res.json({ ok: true })
    } catch (error) {
      const outcome = handlePushError(database, subscription, error)
      res.status(502).json({ error: 'push_failed', removed: outcome === 'removed' })
    }
  })

  return router
}
