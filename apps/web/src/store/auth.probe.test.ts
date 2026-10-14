// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.fn()
vi.mock('../shared/apiBase', () => ({ fetchApi: (...args: unknown[]) => fetchApiMock(...args) }))

import { probeAuthProfile } from './auth'

const profile = { id: 'u1', email: null, isSupporter: false, isAdmin: false, cloudSync: { usedBytes: 0, payloadBytes: 0, blobBytes: 0, limitBytes: 1 } }

describe('probeAuthProfile', () => {
  beforeEach(() => fetchApiMock.mockReset())

  it('returns the profile for a valid token', async () => {
    fetchApiMock.mockResolvedValue(new Response(JSON.stringify(profile), { status: 200 }))
    await expect(probeAuthProfile('t')).resolves.toEqual({ kind: 'ok', profile })
    expect(fetchApiMock).toHaveBeenCalledWith('/user/profile', { headers: { Authorization: 'Bearer t' } })
  })

  it('calls a 401 or 403 rejected', async () => {
    fetchApiMock.mockResolvedValue(new Response('', { status: 401 }))
    await expect(probeAuthProfile('t')).resolves.toEqual({ kind: 'rejected' })
    fetchApiMock.mockResolvedValue(new Response('', { status: 403 }))
    await expect(probeAuthProfile('t')).resolves.toEqual({ kind: 'rejected' })
  })

  it('calls a network failure or a server error unreachable, never rejected', async () => {
    fetchApiMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(probeAuthProfile('t')).resolves.toEqual({ kind: 'unreachable' })
    fetchApiMock.mockResolvedValue(new Response('', { status: 502 }))
    await expect(probeAuthProfile('t')).resolves.toEqual({ kind: 'unreachable' })
  })
})
