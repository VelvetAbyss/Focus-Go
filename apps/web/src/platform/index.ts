import platformImpl from 'virtual:platform'
import type { PlatformBridge } from './types'

export type { PlatformBridge }

// Default (web) implementation: every capability is a safe no-op.
const webPlatform: PlatformBridge = {
  isDesktop: false,
  async notify() {},
  async saveAuthToken() {},
  async loadAuthToken() {
    return null
  },
  async clearAuthToken() {},
  async showAppWindow() {},
  async checkForUpdates() {
    return false
  },
  async openExternal(url: string) {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer')
  },
  onDeepLink() {
    return () => {}
  },
}

// The desktop build injects its implementation through `virtual:platform`.
let current: PlatformBridge = platformImpl ?? webPlatform

export const getPlatform = (): PlatformBridge => current

/** Override the active platform bridge (used by tests / alternate hosts). */
export const setPlatform = (platform: PlatformBridge): void => {
  current = platform
}
