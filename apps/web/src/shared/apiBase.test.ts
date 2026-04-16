// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('api base helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
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
})
