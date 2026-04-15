import { getAuth } from '../../store/auth'
import { db } from '../db'
import { encodeSyncPayload } from './content'
import type { SyncBlobCacheEntry, SyncOutboxItem, SyncPushRequest, SyncPushResponse, SyncWireBlob, SyncWireResponse } from './types'

const MAX_PUSH_OPERATIONS = 50
const MAX_PUSH_BODY_BYTES = 128 * 1024
const MAX_WANT_BLOBS = 40

const getAuthHeaders = () => {
  const auth = getAuth()
  if (!auth?.accessToken) return null
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    'Content-Type': 'application/json',
  }
}

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, init)
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sync failed: session expired, please log in again')
    throw new Error(`Sync request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

const measurePushRequest = (request: SyncPushRequest) => new TextEncoder().encode(JSON.stringify(request)).length

const splitPushOperations = (operations: SyncOutboxItem[]) => {
  const chunks: SyncOutboxItem[][] = []
  let current: SyncOutboxItem[] = []

  for (const operation of operations) {
    if (current.length > 0 && current.length >= MAX_PUSH_OPERATIONS) {
      chunks.push(current)
      current = []
    }
    current.push(operation)
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

const buildPushRequest = async (operations: SyncOutboxItem[]): Promise<{ request: SyncPushRequest; blobMap: Map<string, SyncWireBlob> }> => {
  const entities: SyncOutboxItem[] = []
  const blobMap = new Map<string, SyncWireBlob>()

  for (const operation of operations) {
    const encoded = operation.op === 'delete' ? { payload: operation.payload, blobs: [] } : await encodeSyncPayload(operation.entityType, operation.payload)
    entities.push({
      ...operation,
      payload: encoded.payload,
    })
    for (const blob of encoded.blobs) blobMap.set(blob.hash, blob)
  }

  return {
    request: {
      entities,
      blobs: Array.from(blobMap.values()),
    },
    blobMap,
  }
}

const mergeWireResponses = (base: SyncWireResponse, incoming: SyncWireResponse): SyncWireResponse => {
  const blobMap = new Map<string, SyncWireBlob>()
  for (const blob of base.blobs) blobMap.set(blob.hash, blob)
  for (const blob of incoming.blobs) blobMap.set(blob.hash, blob)
  return {
    serverTime: incoming.serverTime,
    tables: base.tables,
    blobs: Array.from(blobMap.values()),
    missingBlobs: incoming.missingBlobs,
  }
}

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

const buildWantBlobQuery = (hashes: string[]) =>
  hashes.map((hash) => `wantBlobs=${encodeURIComponent(hash)}`).join('&')

const getCachedBlobs = async (hashes: string[]) => {
  if (hashes.length === 0) return []
  const rows = await db.syncBlobCache.bulkGet(hashes)
  return rows.filter((row): row is SyncBlobCacheEntry => Boolean(row)).map((row) => ({
    hash: row.hash,
    contentType: row.contentType,
    compression: row.compression,
    rawByteLength: row.rawByteLength,
    byteLength: row.byteLength,
    dataBase64: row.dataBase64,
  }))
}

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

const fetchWireState = async (path: string, headers: Record<string, string>) => {
  let response = await fetchJson<SyncWireResponse>(path, { headers })
  await cacheBlobs(response.blobs)
  if (response.missingBlobs.length === 0) return response

  const cached = await getCachedBlobs(response.missingBlobs)
  if (cached.length > 0) {
    response = mergeWireResponses(response, {
      serverTime: response.serverTime,
      tables: response.tables,
      blobs: cached,
      missingBlobs: response.missingBlobs.filter((hash) => !cached.some((blob) => blob.hash === hash)),
    })
  }
  if (response.missingBlobs.length === 0) return response

  for (const chunk of chunkArray(response.missingBlobs, MAX_WANT_BLOBS)) {
    const separator = path.includes('?') ? '&' : '?'
    const next = await fetchJson<SyncWireResponse>(`${path}${separator}${buildWantBlobQuery(chunk)}`, { headers })
    await cacheBlobs(next.blobs)
    response = mergeWireResponses(response, next)
  }
  return response
}

export const syncApi = {
  async bootstrap(): Promise<SyncWireResponse> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    return fetchWireState('/sync/bootstrap', headers)
  },
  async pull(since: number): Promise<SyncWireResponse> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    return fetchWireState(`/sync/pull?since=${since}`, headers)
  },
  async push(operations: SyncOutboxItem[]) {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    let applied = 0
    let serverTime = Date.now()
    for (const chunk of splitPushOperations(operations)) {
      const { request, blobMap } = await buildPushRequest(chunk)
      if (measurePushRequest(request) > MAX_PUSH_BODY_BYTES && chunk.length > 1) {
        const nestedResult = await this.push(chunk.slice(0, Math.ceil(chunk.length / 2)))
        const remainderResult = await this.push(chunk.slice(Math.ceil(chunk.length / 2)))
        applied += nestedResult.applied + remainderResult.applied
        serverTime = remainderResult.serverTime
        continue
      }
      let result = await fetchJson<SyncPushResponse>('/sync/push', {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      })
      while (result.missingBlobs.length > 0) {
        const missingRequest: SyncPushRequest = {
          entities: [],
          blobs: result.missingBlobs.map((hash) => {
            const blob = blobMap.get(hash)
            if (!blob) throw new Error(`Missing local blob during sync: ${hash}`)
            return blob
          }),
        }
        result = await fetchJson<SyncPushResponse>('/sync/push', {
          method: 'POST',
          headers,
          body: JSON.stringify(missingRequest),
        })
      }
      applied += result.applied
      serverTime = result.serverTime
    }
    return { applied, serverTime }
  },
}
