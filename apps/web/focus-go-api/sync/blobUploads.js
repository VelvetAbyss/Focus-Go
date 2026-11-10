import { getCloudStorageUsage, upsertSyncBlob } from './store.js'
import { collectBlobRefs } from './protocol.js'

const MAX_ENCODED_BYTES = 12 * 1024 * 1024
const MAX_CHUNK_BYTES = 256 * 1024
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })

// Persist partial uploads across API restarts. They never become readable blobs
// until complete, validated and within the account's cloud quota.
export const createBlobUploader = (database, quotaBytes) => {
  database.exec(`CREATE TABLE IF NOT EXISTS sync_blob_uploads (
    user_id TEXT NOT NULL, upload_id TEXT NOT NULL, metadata TEXT NOT NULL,
    total_length INTEGER NOT NULL, data TEXT NOT NULL, updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, upload_id)
  )`)
  // The existing account/data deletion paths update or delete users. Keep
  // transient uploads under those same ownership/lifecycle boundaries.
  if (database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='users'").get()) {
    database.exec(`
      CREATE TRIGGER IF NOT EXISTS sync_uploads_user_delete AFTER DELETE ON users
      BEGIN DELETE FROM sync_blob_uploads WHERE user_id = OLD.id; END;
      CREATE TRIGGER IF NOT EXISTS sync_uploads_user_reset AFTER UPDATE OF initial_seeded_at ON users
      WHEN NEW.initial_seeded_at IS NULL
      BEGIN DELETE FROM sync_blob_uploads WHERE user_id = NEW.id; END;
      CREATE TRIGGER IF NOT EXISTS sync_uploads_user_deletion_request AFTER UPDATE OF status ON users
      WHEN NEW.status = 'deletion_pending'
      BEGIN DELETE FROM sync_blob_uploads WHERE user_id = NEW.id; END;
    `)
  }
  const removeExpired = database.prepare('DELETE FROM sync_blob_uploads WHERE updated_at < ?')
  const get = database.prepare('SELECT * FROM sync_blob_uploads WHERE user_id = ? AND upload_id = ?')
  const remove = database.prepare('DELETE FROM sync_blob_uploads WHERE user_id = ? AND upload_id = ?')
  const accept = (userId, body) => {
    const { uploadId, blob, totalLength, offset, dataBase64 } = body ?? {}
    if (typeof uploadId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(uploadId)
      || !blob || typeof blob.hash !== 'string' || !blob.hash || blob.hash.length > 200
      || typeof blob.contentType !== 'string' || blob.contentType.length > 200
      || !['gzip', 'none'].includes(blob.compression)
      || !Number.isSafeInteger(totalLength) || totalLength <= 0 || totalLength > MAX_ENCODED_BYTES
      || !Number.isSafeInteger(offset) || offset < 0 || offset % 4 !== 0
      || typeof dataBase64 !== 'string' || !dataBase64.length || dataBase64.length > MAX_CHUNK_BYTES
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dataBase64)
      || offset + dataBase64.length > totalLength) throw fail('invalid_sync_blob_chunk')
    const metadata = JSON.stringify({ hash: blob.hash, contentType: blob.contentType, compression: blob.compression })
    const timestamp = Date.now()
    removeExpired.run(timestamp - 60 * 60 * 1000)
    try {
      return database.transaction(() => {
        let upload = get.get(userId, uploadId)
        if (!upload) {
          if (offset !== 0) throw fail('sync_blob_upload_restart', 409)
          // Reserve bounded temporary storage; includes incomplete uploads so
          // repeated abandoned requests cannot grow the staging table forever.
          const reserved = database.prepare('SELECT COALESCE(SUM(MAX(total_length, 1024)), 0) AS bytes FROM sync_blob_uploads WHERE user_id = ?').get(userId)
          const global = database.prepare('SELECT COALESCE(SUM(MAX(total_length, 1024)), 0) AS bytes FROM sync_blob_uploads').get()
          const usage = getCloudStorageUsage(database, userId)
          if (usage.usedBytes + reserved.bytes + totalLength > quotaBytes) {
            throw Object.assign(fail('cloud_storage_quota_exceeded', 413), { usage })
          }
          if (global.bytes + Math.max(totalLength, 1024) > Math.max(256 * 1024 * 1024, quotaBytes * 2)) throw fail('sync_blob_upload_busy', 429)
          database.prepare('INSERT INTO sync_blob_uploads VALUES (?, ?, ?, ?, ?, ?)').run(userId, uploadId, metadata, totalLength, '', timestamp)
          upload = get.get(userId, uploadId)
        }
        if (upload.metadata !== metadata || upload.total_length !== totalLength) throw fail('sync_blob_upload_mismatch', 409)
        if (offset < upload.data.length && upload.data.slice(offset, offset + dataBase64.length) === dataBase64) {
          return { complete: upload.data.length === totalLength, received: upload.data.length }
        }
        if (offset !== upload.data.length) throw fail('sync_blob_upload_restart', 409)
        const data = upload.data + dataBase64
        database.prepare('UPDATE sync_blob_uploads SET data = ?, updated_at = ? WHERE user_id = ? AND upload_id = ?').run(data, timestamp, userId, uploadId)
        // Completion only acknowledges staging. The row push below validates and
        // publishes content and references in one transaction, avoiding cleanup races.
        return { complete: data.length === totalLength, received: data.length }
      })()
    } catch (error) {
      // No incomplete content is published after validation/quota failure.
      remove.run(userId, uploadId)
      throw error
    }
  }
  const commit = (userId, entityType, rows) => {
    const refs = new Set(rows.flatMap(row => [row?.newDocumentState, row?.assumedMasterState]
      .flatMap(state => state ? collectBlobRefs(entityType, state) : [])))
    for (const upload of database.prepare('SELECT * FROM sync_blob_uploads WHERE user_id = ? AND length(data) = total_length').all(userId)) {
      const metadata = JSON.parse(upload.metadata)
      if (!refs.has(metadata.hash)) continue
      upsertSyncBlob(database, userId, { ...metadata, dataBase64: upload.data })
      remove.run(userId, upload.upload_id)
    }
  }
  const known = (userId, hashes) => {
    if (!Array.isArray(hashes) || hashes.length > 500 || hashes.some(hash => typeof hash !== 'string' || !hash || hash.length > 200)) throw fail('invalid_sync_blob_hashes')
    removeExpired.run(Date.now() - 60 * 60 * 1000)
    const staged = new Set(database.prepare('SELECT metadata FROM sync_blob_uploads WHERE user_id = ? AND length(data) = total_length').all(userId).map(row => JSON.parse(row.metadata).hash))
    const owned = database.prepare('SELECT 1 FROM sync_user_blobs WHERE user_id = ? AND hash = ?')
    return hashes.filter(hash => staged.has(hash) || owned.get(userId, hash))
  }
  return { accept, commit, known }
}
