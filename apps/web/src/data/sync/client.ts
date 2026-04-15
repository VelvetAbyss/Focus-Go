import { getAuth } from '../../store/auth'
import { db } from '../db'
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

export const normalizeSyncFetchError = (error: unknown) => {
  if (error instanceof Error && error.name === 'TypeError') {
    return new Error(`Sync server unreachable: ${import.meta.env.VITE_API_BASE}`)
  }
  if (error instanceof Error) return error
  return new Error('Sync request failed')
}

const fetchJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE}${path}`, init)
  } catch (error) {
    throw normalizeSyncFetchError(error)
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sync failed: session expired, please log in again')
    throw new Error(`Sync request failed: ${response.status}`)
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
