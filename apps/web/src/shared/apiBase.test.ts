// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('api base helpers', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    vi.resetModules()
  })

  it('uses same-origin proxy in production when configured api base is cross-origin', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_API_BASE', 'https://api.nestflow.art')
    const { buildApiUrl } = await import('./apiBase')
    expect(buildApiUrl('/sync/rxdb/pull')).toBe('/api/sync/rxdb/pull')
  })

  it('keeps configured base outside production', async () => {
    vi.stubEnv('MODE', 'test')
    vi.stubEnv('VITE_API_BASE', 'http://localhost:3000')
    const { buildApiUrl } = await import('./apiBase')
    expect(buildApiUrl('/auth/me')).toBe('http://localhost:3000/auth/me')
  })

  it('falls back to direct api when production proxy returns 404', async () => {
    vi.stubEnv('MODE', 'production')
    vi.stubEnv('VITE_API_BASE', 'https://api.nestflow.art')
    fetchMock
      .mockResolvedValueOnce({ status: 404 } as Response)
      .mockResolvedValueOnce({ status: 200, ok: true } as Response)
    const { fetchApi } = await import('./apiBase')
    await fetchApi('/auth/me', { headers: { Authorization: 'Bearer token' } })
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/me')
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('https://api.nestflow.art/auth/me')
  })

  it('falls back to the local dev api for localhost admin authorization failures', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_API_BASE', 'https://api.nestflow.art')
    fetchMock
      .mockResolvedValueOnce({ status: 401, ok: false } as Response)
      .mockResolvedValueOnce({ status: 200, ok: true } as Response)
    const { fetchApi } = await import('./apiBase')
    await fetchApi('/admin/overview')
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.nestflow.art/admin/overview')
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe('http://localhost:3000/admin/overview')
  })

  it('does not use the local dev api fallback for non-admin authorization failures', async () => {
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_API_BASE', 'https://api.nestflow.art')
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false } as Response)
    const { fetchApi } = await import('./apiBase')
    const response = await fetchApi('/user/profile')
    expect(response.status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
