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
      return new Error('Sync auth token invalid or expired — please log in again')
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
    if (response.status === 401) throw new Error('Sync failed: session expired, please log in again')
    // Capture server body to surface in entityErrors so the user can see *why*
    // it 500'd (e.g. unknown entityType, malformed checkpoint). Without this
    // the client just retries forever against a broken endpoint.
    let bodyHint = ''
    try {
      const bodyText = await response.text()
      if (bodyText) {
        const body = JSON.parse(bodyText) as { error?: string; usedBytes?: number; limitBytes?: number }
        if (response.status === 413 && body.error === 'cloud_storage_quota_exceeded') {
          throw new Error(`Cloud sync storage limit reached (${body.usedBytes ?? 0} / ${body.limitBytes ?? 0} bytes). Delete synced content or use a self-hosted server, then try again.`)
        }
        const entityType = (() => {
          try {
            return JSON.parse(String(init?.body ?? '{}'))?.entityType
          } catch {
            return undefined
          }
        })()
        bodyHint = ` body=${bodyText.slice(0, 200)}${entityType ? ` entity=${entityType}` : ''}`
      }
    } catch {
      // swallow — body may already be consumed or stream-broken
    }
    throw new Error(`Sync request failed: ${response.status}${bodyHint}`)
  }
  return response.json() as Promise<T>
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

export const syncApi = {
  async rxdbPull<T extends SyncEntityType>(request: RxdbPullRequest): Promise<RxdbPullResponse<T>> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    const response = await fetchJson<RxdbPullResponse<T>>('/sync/rxdb/pull', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })
    await cacheBlobs(response.blobs)
    return response
  },
  async rxdbPush<T extends SyncEntityType>(request: RxdbPushRequest<T>): Promise<RxdbPushResponse<T>> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    const response = await fetchJson<RxdbPushResponse<T>>('/sync/rxdb/push', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    })
    await cacheBlobs(response.blobs)
    return response
  },
}
