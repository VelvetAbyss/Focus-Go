import webpush from 'web-push'
import {
  deletePushSubscription,
  listPushSubscriptions,
  listUsersWithPushSubscriptions,
  markReminderDelivered,
  prunePushDeliveries,
  recordPushFailure,
  recordPushSuccess,
  wasReminderDelivered,
} from './store.js'

export const REMINDER_TICK_MS = 30_000
// A reminder this late is no use any more (the server was down, or the device subscribed after
// the time had passed); sending it would only be noise.
export const REMINDER_STALE_MS = 15 * 60_000
// An open app fires the reminder itself and syncs reminderFiredAt; give it that head start so a
// device with the app open doesn't also get a push.
export const REMINDER_GRACE_MS = 15_000
const DELIVERY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const CLOSED_STATUSES = new Set(['done', 'dropped'])

const parsePayload = (row) => {
  try {
    return JSON.parse(row.payload)
  } catch {
    return null
  }
}

/**
 * Every (device, task) pair whose reminder is due now. Reads the synced tasks directly: a task
 * qualifies while it is open, not deleted, has a reminderAt and no reminderFiredAt (a device that
 * already showed it syncs that back). Each device applies its own lead time.
 */
export const collectDueReminders = (db, { now = Date.now() } = {}) => {
  const due = []
  const selectTasks = db.prepare(`
    SELECT id, payload FROM sync_tasks
    WHERE user_id = ? AND deleted_at IS NULL
      AND json_extract(payload, '$.reminderFiredAt') IS NULL
      AND json_extract(payload, '$.reminderAt') BETWEEN ? AND ?
  `)
  for (const userId of listUsersWithPushSubscriptions(db)) {
    const subscriptions = listPushSubscriptions(db, userId)
    if (subscriptions.length === 0) continue
    const maxLeadMs = Math.max(...subscriptions.map((item) => item.leadMinutes)) * 60_000
    for (const row of selectTasks.all(userId, now - REMINDER_STALE_MS, now + maxLeadMs)) {
      const task = parsePayload(row)
      if (!task || CLOSED_STATUSES.has(task.status) || typeof task.reminderAt !== 'number') continue
      for (const subscription of subscriptions) {
        const dueAt = task.reminderAt - subscription.leadMinutes * 60_000 + REMINDER_GRACE_MS
        // Stale is judged by the reminder itself: one still ahead (set 5 minutes out with a
        // 10-minute lead) goes out at once; one long past does not.
        if (now < dueAt || now - task.reminderAt > REMINDER_STALE_MS) continue
        if (wasReminderDelivered(db, subscription.id, row.id, task.reminderAt)) continue
        due.push({ subscription, task: { ...task, id: row.id } })
      }
    }
  }
  return due
}

const fallbackTitle = (language) => (language === 'en' ? 'Task reminder' : '任务提醒')

/** The notification as the service worker receives it; the device formats times in its own zone. */
export const buildReminderPayload = (task, subscription) => ({
  kind: 'task-reminder',
  taskId: task.id,
  reminderAt: task.reminderAt,
  title: String(task.title ?? '').trim().slice(0, 120) || fallbackTitle(subscription.language),
  body: String(task.progressNote || task.description || '').trim().slice(0, 140),
  language: subscription.language,
  tag: `task-reminder-${task.id}`,
  url: `/tasks?task=${encodeURIComponent(task.id)}`,
})

export const sendWebPush = (subscription, payload, vapid) =>
  webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    JSON.stringify(payload),
    {
      TTL: 30 * 60,
      urgency: 'high',
      timeout: 10_000,
      vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    },
  )

/**
 * 404/410: the browser dropped the subscription (signed out, revoked permission, cleared data) —
 * forget it. Client errors that keep repeating mean it will never work; transient errors are
 * retried on the next tick until the reminder goes stale.
 */
export const handlePushError = (db, subscription, error) => {
  const status = Number(error?.statusCode)
  if (status === 404 || status === 410) {
    deletePushSubscription(db, subscription.id)
    return 'removed'
  }
  recordPushFailure(db, subscription.id)
  const limit = status >= 400 && status < 500 && status !== 429 ? 5 : 50
  if (subscription.failureCount + 1 >= limit) {
    deletePushSubscription(db, subscription.id)
    return 'removed'
  }
  console.warn(`[push] send failed (${Number.isFinite(status) ? status : 'network'}) for subscription ${subscription.id}`)
  return 'retry'
}

export const runReminderTick = async ({ db, vapid, send = sendWebPush, now = Date.now() }) => {
  let sent = 0
  for (const { subscription, task } of collectDueReminders(db, { now })) {
    try {
      await send(subscription, buildReminderPayload(task, subscription), vapid)
      markReminderDelivered(db, subscription.id, task.id, task.reminderAt, now)
      recordPushSuccess(db, subscription.id, now)
      sent += 1
    } catch (error) {
      handlePushError(db, subscription, error)
    }
  }
  prunePushDeliveries(db, now - DELIVERY_RETENTION_MS)
  return { sent }
}

export const startReminderScheduler = ({ db, vapid, intervalMs = REMINDER_TICK_MS }) => {
  let running = false
  const timer = setInterval(() => {
    // A slow push service must not stack ticks on top of each other.
    if (running) return
    running = true
    runReminderTick({ db, vapid })
      .catch((error) => console.error('[push] reminder tick failed', error))
      .finally(() => {
        running = false
      })
  }, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
