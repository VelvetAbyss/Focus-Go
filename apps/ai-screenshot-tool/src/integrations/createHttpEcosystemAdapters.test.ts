import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpEcosystemAdapters, createHttpEcosystemAdaptersFromEnv } from './createHttpEcosystemAdapters'

describe('createHttpEcosystemAdapters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls auth, storage, and theme endpoints with expected URLs', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'user-1', displayName: 'Alex' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'token-1' })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ url: 'https://storage.example.com/capture.png', provider: 'custom', sizeBytes: 12 })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ mode: 'light', tokens: { '--fg-surface': '#fff' }, updatedAt: Date.now() })),
      )

    const adapters = createHttpEcosystemAdapters({
      authBaseUrl: 'https://auth.example.com',
      storageBaseUrl: 'https://storage.example.com',
      themeBaseUrl: 'https://theme.example.com',
      fetcher,
    })

    await adapters.auth.getCurrentUser()
    await adapters.auth.getAccessToken()
    await adapters.storage.uploadCapture({
      captureId: 'capture-1',
      fileName: 'capture.png',
      mimeType: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })
    await adapters.theme.getThemeConfig()

    expect(fetcher).toHaveBeenCalledWith('https://auth.example.com/v1/me', expect.any(Object))
    expect(fetcher).toHaveBeenCalledWith('https://auth.example.com/v1/token', expect.any(Object))
    expect(fetcher).toHaveBeenCalledWith('https://storage.example.com/v1/uploads/capture', expect.any(Object))
    expect(fetcher).toHaveBeenCalledWith('https://theme.example.com/v1/theme', expect.any(Object))
  })

  it('throws when required env values are missing', () => {
    expect(() =>
      createHttpEcosystemAdaptersFromEnv({
        VITE_AUTH_API_BASE_URL: '',
        VITE_STORAGE_API_BASE_URL: '',
        VITE_THEME_API_BASE_URL: '',
      }),
    ).toThrow('Missing required env: VITE_AUTH_API_BASE_URL')
  })
})
