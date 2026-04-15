import { SYNC_TABLES } from './config.js'
import { collectBlobRefs, normalizePayloadForWire } from './protocol.js'

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_blobs (
      hash TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      compression TEXT NOT NULL,
      raw_byte_length INTEGER NOT NULL,
      byte_length INTEGER NOT NULL,
      data_base64 TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
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

export const upsertSyncBlob = (db, blob) => {
  const timestamp = Date.now()
  db.prepare(`
    INSERT INTO sync_blobs (hash, content_type, compression, raw_byte_length, byte_length, data_base64, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(hash) DO UPDATE SET
      content_type = excluded.content_type,
      compression = excluded.compression,
      raw_byte_length = excluded.raw_byte_length,
      byte_length = excluded.byte_length,
      data_base64 = excluded.data_base64,
      updated_at = excluded.updated_at
  `).run(
    blob.hash,
    blob.contentType,
    blob.compression,
    blob.rawByteLength,
    blob.byteLength,
    blob.dataBase64,
    timestamp,
    timestamp,
  )
}

const getSyncBlobs = (db, hashes) => {
  if (hashes.length === 0) return []
  const stmt = db.prepare(
    `SELECT hash, content_type, compression, raw_byte_length, byte_length, data_base64 FROM sync_blobs WHERE hash IN (${hashes.map(() => '?').join(',')})`,
  )
  return stmt.all(...hashes).map((row) => ({
    hash: row.hash,
    contentType: row.content_type,
    compression: row.compression,
    rawByteLength: row.raw_byte_length,
    byteLength: row.byte_length,
    dataBase64: row.data_base64,
  }))
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

const buildWireTables = (db, userId, since = null, wantBlobs = []) => {
  const tables = {}
  const requiredBlobs = new Set()
  for (const [entityType, tableName] of Object.entries(SYNC_TABLES)) {
    const rows = db
      .prepare(
        since === null
          ? `SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? ORDER BY updated_at ASC`
          : `SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? AND updated_at > ? ORDER BY updated_at ASC`,
      )
      .all(...(since === null ? [userId] : [userId, since]))
    tables[entityType] = rows.map((row) => {
      const normalized = normalizeRow(row)
      const wire = normalizePayloadForWire(entityType, normalized.payload)
      for (const hash of collectBlobRefs(entityType, wire.payload)) requiredBlobs.add(hash)
      return {
        ...normalized,
        payload: wire.payload,
      }
    })
  }
  const wanted = wantBlobs.filter((hash) => requiredBlobs.has(hash))
  const storedBlobs = getSyncBlobs(db, wanted)
  const available = new Set(storedBlobs.map((blob) => blob.hash))
  return {
    tables,
    blobs: storedBlobs,
    missingBlobs: Array.from(requiredBlobs).filter((hash) => !available.has(hash)),
  }
}

export const getBootstrapState = (db, userId, wantBlobs = []) => buildWireTables(db, userId, null, wantBlobs)

export const getChangesSince = (db, userId, since, wantBlobs = []) => buildWireTables(db, userId, since, wantBlobs)
