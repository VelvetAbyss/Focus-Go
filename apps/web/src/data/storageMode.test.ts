// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  consumeSignInPrompt,
  readStorageMode,
  requestSignInPrompt,
  STORAGE_MODE_KEY,
  writeStorageMode,
} from './storageMode'
import { LOCAL_DATA_OWNER_KEY } from '../store/authOwnership'

const LEGACY_CLOUD_SYNC_ENABLED_KEY = 'focusgo:cloud-sync-enabled'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('storage mode', () => {
  it('has no mode until a device chooses one', () => {
    expect(readStorageMode()).toBeNull()
  })

  it('round-trips an explicit choice', () => {
    writeStorageMode('local')
    expect(readStorageMode()).toBe('local')
    writeStorageMode('cloud')
    expect(readStorageMode()).toBe('cloud')
  })

  it('keeps the legacy cloud-sync flag coherent for any code still reading it', () => {
    writeStorageMode('local')
    expect(localStorage.getItem(LEGACY_CLOUD_SYNC_ENABLED_KEY)).toBe('0')
    writeStorageMode('cloud')
    expect(localStorage.getItem(LEGACY_CLOUD_SYNC_ENABLED_KEY)).toBe('1')
  })

  it('ignores a corrupted value rather than trusting it', () => {
    localStorage.setItem(STORAGE_MODE_KEY, 'sideways')
    expect(readStorageMode()).toBeNull()
  })

  describe('migrating devices that predate the setting', () => {
    it('reads a device that had turned cloud sync off as local', () => {
      localStorage.setItem(LEGACY_CLOUD_SYNC_ENABLED_KEY, '0')
      expect(readStorageMode()).toBe('local')
    })

    it('reads a device that has held an account as cloud', () => {
      localStorage.setItem(LOCAL_DATA_OWNER_KEY, 'user-1')
      expect(readStorageMode()).toBe('cloud')
    })

    it('prefers an explicit sync-off choice over the account marker', () => {
      localStorage.setItem(LOCAL_DATA_OWNER_KEY, 'user-1')
      localStorage.setItem(LEGACY_CLOUD_SYNC_ENABLED_KEY, '0')
      expect(readStorageMode()).toBe('local')
    })

    it('persists the inference so it is only made once', () => {
      localStorage.setItem(LOCAL_DATA_OWNER_KEY, 'user-1')
      readStorageMode()
      expect(localStorage.getItem(STORAGE_MODE_KEY)).toBe('cloud')
    })

    it('still asks a genuinely new device', () => {
      localStorage.setItem(LEGACY_CLOUD_SYNC_ENABLED_KEY, '1')
      expect(readStorageMode()).toBeNull()
    })
  })

  describe('sign-in prompt hand-off', () => {
    it('is not set by default', () => {
      expect(consumeSignInPrompt()).toBe(false)
    })

    it('fires exactly once', () => {
      requestSignInPrompt()
      expect(consumeSignInPrompt()).toBe(true)
      expect(consumeSignInPrompt()).toBe(false)
    })
  })
})
