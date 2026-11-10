import { SyncAuthError } from './auth'
import { collectBlobRefs } from './content'
import { getAuth } from '../../store/auth'
import { db } from '../db'
import { buildApiUrl, fetchApi } from '../../shared/apiBase'
import type {
  RxdbPullRequest,
  RxdbPullResponse,
  RxdbPushRequest,
  RxdbPushResponse,
  SyncEntityType,
  SyncWireBlob,
} from './types'

const getAuthHeaders = () => {
  const auth = getAuth()
  if (!auth?.accessToken) return null
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    'Content-Type': 'application/json',
  }
}

const runSyncConnectivityDiagnosis = async () => {
  const base = buildApiUrl('')
  try {
    const health = await fetchApi('/health')
    if (!health.ok) return null
  } catch {
    return new Error(`Sync request blocked by browser or network: ${base}`)
  }

  try {
    const syncProbe = await fetchApi('/sync/rxdb/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'notes', checkpoint: null, limit: 1 }),
    })
    if (syncProbe.status === 401) {
      return new Error(`Sync request blocked by browser or network: ${base}`)
    }
  } catch {
    return new Error(`Sync request blocked by browser or network: ${base}`)
  }

  return new Error(`Sync request failed before reaching authenticated API flow: ${base}`)
}

export const normalizeSyncFetchError = async (error: unknown) => {
  if (error instanceof Error && error.name === 'TypeError') {
    return (await runSyncConnectivityDiagnosis()) ?? new Error(`Sync request blocked by browser or network: ${buildApiUrl('')}`)
  }
  if (error instanceof Error) return error
  return new Error('Sync request failed')
}

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetchApi(path, init)
  } catch (error) {
    throw await normalizeSyncFetchError(error)
  }
  if (!response.ok) {
    if (response.status === 401) throw new SyncAuthError()
    // Capture server body to surface in entityErrors so the user can see *why*
    // it 500'd (e.g. unknown entityType, malformed checkpoint). Without this
    // the client just retries forever against a broken endpoint.
    let body: { error?: string; usedBytes?: number; limitBytes?: number } = {}
    let bodyText = ''
    try {
      bodyText = await response.text()
      body = JSON.parse(bodyText)
    } catch { /* Proxies can return HTML instead of JSON. */ }
    if (response.status === 413 && body?.error === 'cloud_storage_quota_exceeded') {
      throw new Error(`云空间已满 / Cloud storage limit reached (${body.usedBytes ?? 0} / ${body.limitBytes ?? 0} bytes). 本地内容已保留 / Local changes retained.`)
    }
    if (response.status === 413) throw new SyncPayloadTooLargeError()
    if (body?.error === 'sync_blob_too_large' || body?.error === 'invalid_sync_blob_compression') {
      throw new Error('单条笔记或附件超过内容限制或已损坏 / Note or attachment exceeds the content limit or is invalid. 本地内容已保留 / Local changes retained.')
    }
    throw new Error(`Sync request failed: ${response.status}${body?.error ? ` body=${bodyText.slice(0, 200)}` : ''}`)
  }
  return response.json() as Promise<T>
}

// Leave headroom below nginx's default 1 MiB request-body limit.
const PUSH_TARGET_BYTES = 512 * 1024
const BLOB_CHUNK_CHARS = 256 * 1024
class SyncPayloadTooLargeError extends Error {
  constructor() { super('同步请求超过服务器大小限制 / Sync request exceeds the server size limit. 本地内容已保留 / Local changes retained.') }
}
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length
const combine = <T extends SyncEntityType>(left: RxdbPushResponse<T>, right: RxdbPushResponse<T>): RxdbPushResponse<T> => ({
  conflicts: [...left.conflicts, ...right.conflicts],
  blobs: [...new Map([...left.blobs, ...right.blobs].map(blob => [blob.hash, blob])).values()],
  quota: right.quota,
})

const cacheBlobs = async (blobs: SyncWireBlob[]) => {
  if (blobs.length === 0) return
  const timestamp = Date.now()
  await db.syncBlobCache.bulkPut(
    blobs.map((blob) => ({
      ...blob,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )
}

export const syncApi = {
  async rxdbPull<T extends SyncEntityType>(request: RxdbPullRequest): Promise<RxdbPullResponse<T>> {
    const accountId = getAuth()?.user?.id
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    const response = await fetchJson<RxdbPullResponse<T>>('/sync/rxdb/pull', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })
    if (getAuth()?.user?.id !== accountId || getAuthHeaders()?.Authorization !== headers.Authorization) throw new Error('Sync account changed')
    await cacheBlobs(response.blobs)
    return response
  },
  async rxdbPush<T extends SyncEntityType>(request: RxdbPushRequest<T>): Promise<RxdbPushResponse<T>> {
    const accountId = getAuth()?.user?.id
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    const assertAccount = () => {
      if (getAuth()?.user?.id !== accountId || getAuthHeaders()?.Authorization !== headers.Authorization) throw new Error('Sync account changed')
    }
    const post = async <R>(path: string, body: unknown): Promise<R> => {
      assertAccount()
      const response = await fetchJson<R>(path, { method: 'POST', headers, body: JSON.stringify(body) })
      assertAccount()
      return response
    }
    const uploaded = new Set<string>()
    if (request.rows.length && request.blobs.length && jsonBytes(request) > PUSH_TARGET_BYTES) {
      // Reuse immutable content already owned or fully staged by this account.
      // This keeps retries advancing after partial success/rate limiting and
      // avoids charging existing content against temporary quota twice.
      const hashes = [...new Set(request.blobs.map(blob => blob.hash))]
      for (let index = 0; index < hashes.length; index += 500) {
        const response = await post<{ hashes: string[] }>('/sync/blobs/known', { hashes: hashes.slice(index, index + 500) })
        if (!Array.isArray(response.hashes)) throw new Error('Invalid sync blob lookup; local changes retained')
        for (const hash of response.hashes) if (hashes.includes(hash)) uploaded.add(hash)
      }
    }
    const uploadBlob = async (blob: SyncWireBlob) => {
      if (uploaded.has(blob.hash)) return
      if (blob.rawByteLength > 8 * 1024 * 1024 || blob.dataBase64.length > 12 * 1024 * 1024) {
        throw new Error('单条笔记或附件超过 8 MiB 内容限制 / Note or attachment exceeds 8 MiB. 本地内容已保留，请导出备份后拆分内容 / Local changes retained; export a backup before splitting the content.')
      }
      const { dataBase64, ...metadata } = blob
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(blob)))
      const uploadId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      // Stable upload IDs let the next cycle resume staged content after a
      // network error/restart, without accumulating abandoned duplicate uploads.
      let offset = 0
      while (offset < dataBase64.length) {
        const chunk = dataBase64.slice(offset, offset + BLOB_CHUNK_CHARS)
        const ack = await post<{ received: number; complete: boolean }>('/sync/blobs/chunk', {
          uploadId, blob: metadata, totalLength: dataBase64.length, offset, dataBase64: chunk,
        })
        if (!Number.isSafeInteger(ack.received) || ack.received < offset + chunk.length || ack.received > dataBase64.length
          || ack.complete !== (ack.received === dataBase64.length)) throw new Error('Invalid sync upload acknowledgement; local changes retained')
        offset = ack.received
      }
      uploaded.add(blob.hash)
    }
    const subset = (rows: RxdbPushRequest<T>['rows']): RxdbPushRequest<T> => {
      const refs = new Set(rows.flatMap(row => [row.newDocumentState, row.assumedMasterState]
        .flatMap(state => state ? collectBlobRefs(request.entityType, state) : [])))
      return { ...request, rows, blobs: request.blobs.filter(blob => refs.has(blob.hash) && !uploaded.has(blob.hash)) }
    }
    const send = async (batch: RxdbPushRequest<T>): Promise<RxdbPushResponse<T>> => {
      try {
        return await post('/sync/rxdb/push', batch)
      } catch (error) {
        if (!(error instanceof SyncPayloadTooLargeError)) throw error
        if (!batch.rows.length) throw new Error('Blob-only sync request too large; local changes retained')
        if (batch.rows.length > 1) {
          const middle = Math.ceil(batch.rows.length / 2)
          return combine(await send(subset(batch.rows.slice(0, middle))), await send(subset(batch.rows.slice(middle))))
        }
        if (batch.blobs.length) {
          for (const blob of batch.blobs) await uploadBlob(blob)
          return send({ ...batch, blobs: [] })
        }
        throw new Error(`同步内容过大 / Sync record too large (${batch.rows[0]?.newDocumentState.id ?? request.entityType}). 本地内容已保留，请导出备份后拆分内容 / Local changes retained; export a backup before splitting the content.`)
      }
    }
    let result: RxdbPushResponse<T> | undefined
    let rows: RxdbPushRequest<T>['rows'] = []
    const flush = async () => {
      if (!rows.length) return
      let batch = subset(rows)
      if (jsonBytes(batch) > PUSH_TARGET_BYTES) {
        for (const blob of batch.blobs) await uploadBlob(blob)
        batch = subset(rows)
      }
      const response = await send(batch)
      result = result ? combine(result, response) : response
      rows = []
    }
    for (const row of request.rows) {
      if (rows.length && jsonBytes(subset([...rows, row])) > PUSH_TARGET_BYTES) await flush()
      rows.push(row)
    }
    await flush()
    // Small empty/blob-only requests retain the existing API behavior.
    if (!result) result = await send(request)
    assertAccount()
    await cacheBlobs(result.blobs)
    return result
  },
}
