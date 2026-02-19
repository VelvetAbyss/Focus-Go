import { isTauri } from '@tauri-apps/api/core'

const WEB_RUNTIME_LABEL = 'Web Browser'
const TAURI_RUNTIME_LABEL = 'Tauri Desktop Runtime'

export const useRuntimePlatform = (): string =>
  isTauri() ? TAURI_RUNTIME_LABEL : WEB_RUNTIME_LABEL
