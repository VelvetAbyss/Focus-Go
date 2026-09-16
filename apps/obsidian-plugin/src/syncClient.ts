import { requestUrl } from 'obsidian'
import type { SyncWireBlob, WireDocument } from './types.ts'

export type Checkpoint = { updatedAt: number; id: string } | null

export type PullResponse = {
  documents: WireDocument[]
  checkpoint: Checkpoint
  blobs: SyncWireBlob[]
}

export type PushRow = {
  newDocumentState: WireDocument
  assumedMasterState: WireDocument | null
}

export type PushResponse = {
  conflicts: WireDocument[]
  blobs: SyncWireBlob[]
}

export class SyncAuthError extends Error {}
export class SyncRateLimitError extends Error {
  readonly retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(`Rate limited, retry in ${retryAfterSeconds}s`)
    this.retryAfterSeconds = retryAfterSeconds
  }
}
export class SyncQuotaError extends Error {}

const ENTITY_TYPE = 'tasks'

export class SyncClient {
  private readonly getConfig: () => { serverUrl: string; token: string }

  constructor(getConfig: () => { serverUrl: string; token: string }) {
    this.getConfig = getConfig
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const { serverUrl, token } = this.getConfig()
    if (!serverUrl || !token) throw new SyncAuthError('Server URL and token are required')

    // `requestUrl` rather than fetch: it bypasses CORS and works identically on
    // Obsidian mobile, where the app has no browser origin to be granted one.
    const response = await requestUrl({
      url: `${serverUrl.replace(/\/+$/, '')}${path}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      throw: false,
    })

    if (response.status === 401 || response.status === 403) {
      throw new SyncAuthError('Token rejected — generate a new one in Focus & Go settings')
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers?.['retry-after'] ?? '') || 60
      throw new SyncRateLimitError(retryAfter)
    }
    if (response.status === 413) {
      throw new SyncQuotaError('Cloud storage quota exceeded')
    }
    if (response.status < 200 || response.status >= 300) {
      const detail = (response.json as { error?: string } | undefined)?.error ?? response.status
      throw new Error(`Sync request failed: ${detail}`)
    }
    return response.json as T
  }

  pull(checkpoint: Checkpoint, limit = 100): Promise<PullResponse> {
    return this.post<PullResponse>('/sync/rxdb/pull', {
      entityType: ENTITY_TYPE,
      checkpoint,
      limit,
    })
  }

  push(rows: PushRow[], blobs: SyncWireBlob[]): Promise<PushResponse> {
    return this.post<PushResponse>('/sync/rxdb/push', {
      entityType: ENTITY_TYPE,
      rows,
      blobs,
    })
  }
}
