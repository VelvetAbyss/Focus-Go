import { createHash } from 'node:crypto'

// A browser can hold many subscriptions over time; keep the newest few per user.
export const MAX_SUBSCRIPTIONS_PER_USER = 10

export const subscriptionIdFor = (endpoint) => createHash('sha256').update(endpoint).digest('hex').slice(0, 32)

export const ensurePushTables = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id             TEXT PRIMARY KEY,
      user_id        TEXT NOT NULL,
      endpoint       TEXT NOT NULL UNIQUE,
      p256dh         TEXT NOT NULL,
      auth           TEXT NOT NULL,
      lead_minutes   INTEGER NOT NULL DEFAULT 10,
      language       TEXT NOT NULL DEFAULT 'zh',
      user_agent     TEXT,
      created_at     INTEGER NOT NULL,
      updated_at     INTEGER NOT NULL,
      last_success_at INTEGER,
      failure_count  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);

    -- One row per reminder sent to one device, so a reminder goes out once.
    CREATE TABLE IF NOT EXISTS push_reminder_deliveries (
      subscription_id TEXT NOT NULL,
      task_id         TEXT NOT NULL,
      reminder_at     INTEGER NOT NULL,
      sent_at         INTEGER NOT NULL,
      PRIMARY KEY (subscription_id, task_id, reminder_at)
    );
    CREATE INDEX IF NOT EXISTS push_reminder_deliveries_sent_idx ON push_reminder_deliveries(sent_at);
  `)
}

const toSubscription = (row) => row && ({
  id: row.id,
  userId: row.user_id,
  endpoint: row.endpoint,
  keys: { p256dh: row.p256dh, auth: row.auth },
  leadMinutes: row.lead_minutes,
  language: row.language,
  failureCount: row.failure_count,
})

/**
 * Saves a device's subscription for a user. The endpoint identifies the device, so signing in
 * as someone else on the same browser moves it to that user rather than duplicating it.
 */
export const upsertPushSubscription = (db, { userId, endpoint, keys, leadMinutes, language, userAgent, now = Date.now() }) => {
  const id = subscriptionIdFor(endpoint)
  db.transaction(() => {
    db.prepare(`
      INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, lead_minutes, language, user_agent, created_at, updated_at)
      VALUES (@id, @userId, @endpoint, @p256dh, @auth, @leadMinutes, @language, @userAgent, @now, @now)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        lead_minutes = excluded.lead_minutes,
        language = excluded.language,
        user_agent = excluded.user_agent,
        updated_at = excluded.updated_at,
        failure_count = 0
    `).run({ id, userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, leadMinutes, language, userAgent: userAgent ?? null, now })
    const extra = db.prepare(`
      SELECT id FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC LIMIT -1 OFFSET ?
    `).all(userId, MAX_SUBSCRIPTIONS_PER_USER)
    for (const row of extra) deletePushSubscription(db, row.id)
  })()
  return id
}

export const deletePushSubscription = (db, id) => {
  db.prepare('DELETE FROM push_reminder_deliveries WHERE subscription_id = ?').run(id)
  return db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(id).changes > 0
}

export const deletePushSubscriptionForUser = (db, userId, endpoint) => {
  const row = db.prepare('SELECT id FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').get(endpoint, userId)
  return row ? deletePushSubscription(db, row.id) : false
}

export const deleteAllPushSubscriptionsForUser = (db, userId) => {
  for (const row of db.prepare('SELECT id FROM push_subscriptions WHERE user_id = ?').all(userId)) {
    deletePushSubscription(db, row.id)
  }
}

export const listPushSubscriptions = (db, userId) =>
  db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY updated_at DESC').all(userId).map(toSubscription)

export const listUsersWithPushSubscriptions = (db) =>
  db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all().map((row) => row.user_id)

export const getPushSubscriptionByEndpoint = (db, endpoint) =>
  toSubscription(db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(endpoint))

export const wasReminderDelivered = (db, subscriptionId, taskId, reminderAt) =>
  Boolean(db.prepare('SELECT 1 FROM push_reminder_deliveries WHERE subscription_id = ? AND task_id = ? AND reminder_at = ?')
    .get(subscriptionId, taskId, reminderAt))

export const markReminderDelivered = (db, subscriptionId, taskId, reminderAt, now = Date.now()) => {
  db.prepare(`
    INSERT OR IGNORE INTO push_reminder_deliveries (subscription_id, task_id, reminder_at, sent_at) VALUES (?, ?, ?, ?)
  `).run(subscriptionId, taskId, reminderAt, now)
}

export const recordPushSuccess = (db, id, now = Date.now()) => {
  db.prepare('UPDATE push_subscriptions SET last_success_at = ?, failure_count = 0 WHERE id = ?').run(now, id)
}

export const recordPushFailure = (db, id) => {
  db.prepare('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ?').run(id)
}

export const prunePushDeliveries = (db, olderThan) =>
  db.prepare('DELETE FROM push_reminder_deliveries WHERE sent_at < ?').run(olderThan).changes
