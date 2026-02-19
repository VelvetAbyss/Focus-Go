import {
  createEcosystemAdapterBundle,
  type AuthToken,
  type EcosystemAdapterBundle,
  type EcosystemUser,
  type IAuthProvider,
  type IStorageProvider,
  type IThemeProvider,
  type StorageUploadResult,
  type ThemeConfig,
} from '@focus-go/core'

type Fetcher = typeof fetch

type HttpEcosystemAdapterConfig = {
  authBaseUrl: string
  storageBaseUrl: string
  themeBaseUrl: string
  fetcher?: Fetcher
}

type EcosystemEnv = {
  VITE_AUTH_API_BASE_URL?: string
  VITE_STORAGE_API_BASE_URL?: string
  VITE_THEME_API_BASE_URL?: string
}

const ensureRequiredEnv = (value: string | undefined, key: string): string => {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${key}`)
  }
  return value
}

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '')

const requestJson = async <T>(fetcher: Fetcher, input: string, init: RequestInit): Promise<T> => {
  const response = await fetcher(input, init)
  if (!response.ok) {
    throw new Error(`Adapter request failed: ${input} (${response.status})`)
  }
  return (await response.json()) as T
}

const createAuthProvider = (baseUrl: string, fetcher: Fetcher): IAuthProvider => ({
  getCurrentUser: () =>
    requestJson<EcosystemUser | null>(fetcher, `${baseUrl}/v1/me`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
  getAccessToken: () =>
    requestJson<AuthToken>(fetcher, `${baseUrl}/v1/token`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    }),
  refreshAccessToken: () =>
    requestJson<AuthToken>(fetcher, `${baseUrl}/v1/token/refresh`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    }),
})

const createStorageProvider = (baseUrl: string, fetcher: Fetcher): IStorageProvider => ({
  uploadCapture: async (input) =>
    requestJson<StorageUploadResult>(fetcher, `${baseUrl}/v1/uploads/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        captureId: input.captureId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        bytes: Array.from(input.bytes),
      }),
    }),
})

const createThemeProvider = (baseUrl: string, fetcher: Fetcher): IThemeProvider => ({
  getThemeConfig: () =>
    requestJson<ThemeConfig>(fetcher, `${baseUrl}/v1/theme`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
})

export const createHttpEcosystemAdapters = (config: HttpEcosystemAdapterConfig): EcosystemAdapterBundle => {
  const fetcher = config.fetcher ?? fetch

  return createEcosystemAdapterBundle({
    auth: createAuthProvider(normalizeBaseUrl(config.authBaseUrl), fetcher),
    storage: createStorageProvider(normalizeBaseUrl(config.storageBaseUrl), fetcher),
    theme: createThemeProvider(normalizeBaseUrl(config.themeBaseUrl), fetcher),
  })
}

export const createHttpEcosystemAdaptersFromEnv = (
  env: EcosystemEnv = import.meta.env,
  fetcher?: Fetcher,
): EcosystemAdapterBundle =>
  createHttpEcosystemAdapters({
    authBaseUrl: ensureRequiredEnv(env.VITE_AUTH_API_BASE_URL, 'VITE_AUTH_API_BASE_URL'),
    storageBaseUrl: ensureRequiredEnv(env.VITE_STORAGE_API_BASE_URL, 'VITE_STORAGE_API_BASE_URL'),
    themeBaseUrl: ensureRequiredEnv(env.VITE_THEME_API_BASE_URL, 'VITE_THEME_API_BASE_URL'),
    fetcher,
  })
