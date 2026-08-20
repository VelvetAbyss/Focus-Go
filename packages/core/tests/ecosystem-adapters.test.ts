import { describe, expect, it } from 'vitest'
import {
  createEcosystemAdapterBundle,
  type IAuthProvider,
  type IStorageProvider,
  type IThemeProvider,
} from '../src'

const authProvider: IAuthProvider = {
  getCurrentUser: async () => ({ id: 'user-1', displayName: 'Alex' }),
  getAccessToken: async () => ({ accessToken: 'token-1' }),
  refreshAccessToken: async () => ({ accessToken: 'token-2' }),
}

const storageProvider: IStorageProvider = {
  uploadCapture: async () => ({
    url: 'https://storage.example.com/capture.png',
    provider: 'custom',
    sizeBytes: 1024,
  }),
}

const themeProvider: IThemeProvider = {
  getThemeConfig: async () => ({
    mode: 'light',
    tokens: {
      '--fg-surface': '#ffffff',
    },
    updatedAt: Date.now(),
  }),
}

describe('createEcosystemAdapterBundle', () => {
  it('returns all adapter references', () => {
    const bundle = createEcosystemAdapterBundle({
      auth: authProvider,
      storage: storageProvider,
      theme: themeProvider,
    })

    expect(bundle.auth).toBe(authProvider)
    expect(bundle.storage).toBe(storageProvider)
    expect(bundle.theme).toBe(themeProvider)
  })

  it('throws when adapter references are missing at runtime', () => {
    expect(() =>
      createEcosystemAdapterBundle({
        auth: authProvider,
        storage: undefined as unknown as IStorageProvider,
        theme: themeProvider,
      }),
    ).toThrow('storage adapter is required')
  })
})
