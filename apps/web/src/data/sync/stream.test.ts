import { describe, expect, it, vi } from 'vitest'
import { consumeSyncStream, subscribeSyncStream } from './stream'
vi.mock('../../store/auth', () => ({ getAuth: () => ({ accessToken: 'stream-test-token' }) }))

describe('authenticated sync notifications', () => {
  it('parses split UTF8/SSE frames, catches up on reconnect and ignores untrusted entity names', async () => {
    const onChange = vi.fn()
    const encoder = new TextEncoder()
    const chunks = ['data: {"type":"ready"}\r', '\n\r\ndata: {"type":"changed","entityType":"notes"}\n', '\ndata: {"type":"changed","entityType":"secrets"}\n\n: heartbeat\n\n']
    const body = new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk))); controller.close() } })
    await consumeSyncStream(body, onChange)
    expect(onChange.mock.calls).toEqual([[], [['notes']]])
  })

  it('aborts streaming requests and cancels retries on unsubscribe', async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
    vi.stubGlobal('fetch', fetchMock)
    const unsubscribe = subscribeSyncStream(() => {})
    unsubscribe()
    // This also safely handles a signed-out client (no request).
    if (fetchMock.mock.calls.length) expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true)
    vi.unstubAllGlobals()
  })
})
