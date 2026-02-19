export type EcosystemUser = {
  id: string
  displayName?: string
  email?: string
  avatarUrl?: string
}

export type AuthToken = {
  accessToken: string
  expiresAt?: number
}

export interface IAuthProvider {
  getCurrentUser(): Promise<EcosystemUser | null>
  getAccessToken(): Promise<AuthToken>
  refreshAccessToken(): Promise<AuthToken>
}

export type StorageUploadInput = {
  captureId: string
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

export type StorageProviderKind = 'custom' | 's3' | 'r2' | 'unknown'

export type StorageUploadResult = {
  url: string
  provider: StorageProviderKind
  sizeBytes: number
}

export interface IStorageProvider {
  uploadCapture(input: StorageUploadInput): Promise<StorageUploadResult>
}

export type ThemeMode = 'light' | 'dark' | 'system'

export type ThemeConfig = {
  mode: ThemeMode
  tokens: Record<string, string>
  updatedAt: number
}

export interface IThemeProvider {
  getThemeConfig(): Promise<ThemeConfig>
}

export type EcosystemAdapterBundle = {
  auth: IAuthProvider
  storage: IStorageProvider
  theme: IThemeProvider
}

const assertAdapter = (name: string, value: unknown): void => {
  if (!value) {
    throw new Error(`${name} adapter is required`)
  }
}

export const createEcosystemAdapterBundle = (bundle: EcosystemAdapterBundle): EcosystemAdapterBundle => {
  assertAdapter('auth', bundle.auth)
  assertAdapter('storage', bundle.storage)
  assertAdapter('theme', bundle.theme)
  return bundle
}
