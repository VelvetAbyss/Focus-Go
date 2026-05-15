import { SYNC_TABLES } from './config.js'
import { collectBlobRefs } from './protocol.js'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const normalizeRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  payload: JSON.parse(row.payload),
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
})

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`).join(',')}}`
}

const normalizeDocumentForCompare = (document) => {
  if (!document || typeof document !== 'object') return null
  const next = { ...document }
  if (next._deleted !== true) delete next._deleted
  return next
}

const buildConflictDocument = (row, fallback = null) => {
  if (!row) return fallback ? { ...fallback, _deleted: true } : null
  const normalized = normalizeRow(row)
  return {
    ...normalized.payload,
    _deleted: Boolean(normalized.deletedAt),
  }
}

const documentsMatch = (current, assumedMasterState) => {
  if (!current) return assumedMasterState == null
  if (!assumedMasterState) return false
  return stableStringify(buildConflictDocument(current)) === stableStringify(normalizeDocumentForCompare(assumedMasterState))
}

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

const getRowsForEntityType = (db, userId, entityType, checkpoint, limit) => {
  const tableName = getTableName(entityType)
  if (!checkpoint || !isNumber(checkpoint.updatedAt) || typeof checkpoint.id !== 'string') {
    return db
      .prepare(
        `SELECT id, user_id, payload, updated_at, deleted_at
         FROM ${tableName}
         WHERE user_id = ?
         ORDER BY updated_at ASC, id ASC
         LIMIT ?`,
      )
      .all(userId, limit)
  }
  return db
    .prepare(
      `SELECT id, user_id, payload, updated_at, deleted_at
       FROM ${tableName}
       WHERE user_id = ?
         AND (updated_at > ? OR (updated_at = ? AND id > ?))
       ORDER BY updated_at ASC, id ASC
       LIMIT ?`,
    )
    .all(userId, checkpoint.updatedAt, checkpoint.updatedAt, checkpoint.id, limit)
}

const collectBlobsForPayloads = (db, entityType, rows) => {
  const hashes = new Set()
  for (const row of rows) {
    if (!row || !row.payload) continue
    for (const hash of collectBlobRefs(entityType, row.payload)) hashes.add(hash)
  }
  return getSyncBlobs(db, Array.from(hashes))
}

export const getRxdbPullState = (db, userId, entityType, checkpoint, limit = 100) => {
  const rows = getRowsForEntityType(db, userId, entityType, checkpoint, Math.max(1, Math.min(500, limit)))
  const documents = rows.map((row) => {
    const normalized = normalizeRow(row)
    return {
      ...normalized.payload,
      _deleted: Boolean(normalized.deletedAt),
    }
  })
  const last = rows.at(-1)
  return {
    documents,
    checkpoint: last
      ? {
          updatedAt: last.updated_at,
          id: last.id,
        }
      : checkpoint ?? null,
    blobs: collectBlobsForPayloads(db, entityType, rows.map(normalizeRow)),
  }
}

export const pushRxdbRows = (db, userId, entityType, rows) => {
  const tableName = getTableName(entityType)
  const conflicts = []

  for (const row of rows) {
    const next = row?.newDocumentState
    if (!next || typeof next.id !== 'string' || !isNumber(next.updatedAt)) continue
    const current = db
      .prepare(`SELECT id, user_id, payload, updated_at, deleted_at FROM ${tableName} WHERE user_id = ? AND id = ?`)
      .get(userId, next.id)

    if (!documentsMatch(current, row?.assumedMasterState ?? null)) {
      const conflict = buildConflictDocument(current, row?.assumedMasterState ?? null)
      if (conflict) conflicts.push(conflict)
      continue
    }

    // Tombstone-priority sanity check: refuse to resurrect a deleted row from
    // an upsert whose updatedAt isn't strictly newer than the tombstone. Stops
    // a client with a skewed clock (or replaying a stale queued op) from
    // un-deleting a row that another device has already deleted. Idempotent
    // re-deletes (incoming _deleted=true) are allowed through.
    if (current && current.deleted_at && next._deleted !== true && next.updatedAt <= current.deleted_at) {
      const conflict = buildConflictDocument(current)
      if (conflict) conflicts.push(conflict)
      continue
    }

    const deletedAt = next._deleted === true ? next.updatedAt : null
    const payload = { ...next }
    delete payload._deleted
    db.prepare(`
      INSERT INTO ${tableName} (id, user_id, payload, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `).run(next.id, userId, JSON.stringify(payload), next.updatedAt, deletedAt)
  }

  return {
    conflicts,
    blobs: collectBlobsForPayloads(
      db,
      entityType,
      conflicts.map((document) => ({
        id: document.id,
        userId,
        payload: document,
        updatedAt: document.updatedAt,
        deletedAt: document._deleted ? document.updatedAt : null,
      })),
    ),
  }
}
