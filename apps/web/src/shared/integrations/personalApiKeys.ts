/**
 * User-supplied browser API keys for optional integrations.
 *
 * These keys deliberately stay on the current device: they are never sent to
 * Focus & Go, included in cloud sync, or included in an exported backup.
 * Browser storage is not a secrets vault, so users should only enter keys that
 * the provider explicitly supports for browser-side use.
 */
export const PERSONAL_API_KEY_STORAGE_KEYS = {
  tmdb: 'focusgo.personal-api-key.tmdb',
  twelveData: 'focusgo.personal-api-key.twelve-data',
} as const

export type PersonalApiKeyService = keyof typeof PERSONAL_API_KEY_STORAGE_KEYS

const readStorage = () => (typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage)

export const readPersonalApiKey = (service: PersonalApiKeyService) =>
  readStorage()?.getItem(PERSONAL_API_KEY_STORAGE_KEYS[service])?.trim() ?? ''

export const writePersonalApiKey = (service: PersonalApiKeyService, value: string) => {
  const storage = readStorage()
  if (!storage) return
  const normalized = value.trim()
  if (normalized) storage.setItem(PERSONAL_API_KEY_STORAGE_KEYS[service], normalized)
  else storage.removeItem(PERSONAL_API_KEY_STORAGE_KEYS[service])
}

export const clearPersonalApiKey = (service: PersonalApiKeyService) => {
  readStorage()?.removeItem(PERSONAL_API_KEY_STORAGE_KEYS[service])
}
