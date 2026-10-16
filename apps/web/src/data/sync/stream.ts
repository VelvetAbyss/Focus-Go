import { getAuth } from '../../store/auth'
import { fetchApi } from '../../shared/apiBase'
import { SYNC_ENTITY_TYPES, type SyncEntityType } from './types'

export const consumeSyncStream = async (body: ReadableStream<Uint8Array>, onChange: (entities?: SyncEntityType[]) => void) => {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n')
      if (buffer.length > 64_000) throw new Error('Sync notification exceeds limit')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
        if (!data) continue
        try {
          const event = JSON.parse(data)
          if (event.type === 'ready') onChange()
          else if (event.type === 'changed' && SYNC_ENTITY_TYPES.includes(event.entityType)) onChange([event.entityType])
        } catch { /* Bad notification cannot advance a checkpoint or write data. */ }
      }
    }
  } finally { reader.releaseLock() }
}

export const subscribeSyncStream = (onChange: (entities?: SyncEntityType[]) => void) => {
  let stopped = false
  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  const connect = async () => {
    if (stopped) return
    controller = new AbortController()
    try {
      const token = getAuth()?.accessToken
      if (!token) return
      const response = await fetchApi('/sync/events', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      if (!response.ok || !response.body) throw new Error('Sync notification unavailable')
      failures = 0
      await consumeSyncStream(response.body, onChange)
    } catch { failures += 1 } // Periodic checkpoint pull continues independently.
    if (!stopped) timer = setTimeout(() => { void connect() }, Math.min(30_000, 3000 * 2 ** Math.min(failures, 4)))
  }
  void connect()
  return () => { stopped = true; controller?.abort(); clearTimeout(timer) }
}
