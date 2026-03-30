import { SYNC_TABLES } from './config.js'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const normalizeRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  payload: JSON.parse(row.payload),
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

const getTableName = (entityType) => {
  const tableName = SYNC_TABLES[entityType]
  if (!tableName) {
    throw new Error(`Unsupported sync entity type: ${entityType}`)
  }
  return tableName
}

export const ensureSyncTables = (db) => {
  for (const tableName of Object.values(SYNC_TABLES)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,
        PRIMARY KEY (user_id, id)
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at ON ${tableName} (user_id, updated_at)`)
  }
}

export const applySyncOperation = (db, userId, operation) => {
  const tableName = getTableName(operation.entityType)
  const current = db
    .prepare(`SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? AND id = ?`)
    .get(userId, operation.entityId)

  const currentUpdatedAt = current?.updated_at ?? -1
  if (current && currentUpdatedAt >= operation.updatedAt) {
    return false
  }

  const deletedAt =
    operation.op === 'delete'
      ? (isNumber(operation.deletedAt) ? operation.deletedAt : operation.updatedAt)
      : null

  db.prepare(`
    INSERT INTO ${tableName} (id, user_id, payload, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
  `).run(
    operation.entityId,
    userId,
    JSON.stringify(operation.payload ?? {}),
    operation.updatedAt,
    deletedAt,
  )

  return true
}

export const getBootstrapState = (db, userId) => {
  const tables = {}
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    const rows = db
      .prepare(`SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? ORDER BY updated_at ASC`)
      .all(userId)
    tables[entityType] = rows.map(normalizeRow)
  }
  return tables
}

export const getChangesSince = (db, userId, since) => {
  const tables = {}
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    const rows = db
      .prepare(
        `SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC`,
      )
      .all(userId, since)
    tables[entityType] = rows.map(normalizeRow)
  }
  return tables
}
