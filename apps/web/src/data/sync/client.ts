import { getAuth } from '../../store/auth'
import type { SyncBootstrapResponse, SyncOutboxItem } from './types'

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
    throw new Error(`Sync request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export const syncApi = {
  async bootstrap(): Promise<SyncBootstrapResponse> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    return fetchJson('/sync/bootstrap', { headers })
  },
  async pull(since: number): Promise<SyncBootstrapResponse> {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    return fetchJson(`/sync/pull?since=${since}`, { headers })
  },
  async push(operations: SyncOutboxItem[]) {
    const headers = getAuthHeaders()
    if (!headers) throw new Error('Missing auth token')
    return fetchJson<{ applied: number; serverTime: number }>('/sync/push', {
      method: 'POST',
      headers,
      body: JSON.stringify({ operations }),
    })
  },
}
