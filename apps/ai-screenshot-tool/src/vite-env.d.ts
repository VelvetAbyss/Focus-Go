/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUTH_API_BASE_URL?: string
  readonly VITE_STORAGE_API_BASE_URL?: string
  readonly VITE_THEME_API_BASE_URL?: string
  readonly VITE_AI_API_BASE_URL?: string
  readonly VITE_ECOSYSTEM_APP_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
