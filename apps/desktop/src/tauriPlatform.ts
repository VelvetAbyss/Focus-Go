// Desktop (Tauri) implementation of the web app's PlatformBridge. This file is the
// ONLY place the frontend touches @tauri-apps; it is injected into the desktop
// build via `virtual:platform` (see apps/web/vite.config.ts) and is never part of
// the web build. Edit desktop frontend behaviour here — it never affects web.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { PlatformBridge } from '@/platform/types'

const isDesktop =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const tauriPlatform: PlatformBridge = {
  isDesktop,

  async notify(title, body) {
    try {
      await invoke('notify', { title, body })
    } catch {
      // best-effort
    }
  },

  async saveAuthToken(token) {
    try {
      await invoke('auth_save_token', { token })
    } catch {
      // a keychain failure must not block login
    }
  },

  async loadAuthToken() {
    try {
      return (await invoke<string | null>('auth_load_token')) ?? null
    } catch {
      return null
    }
  },

  async clearAuthToken() {
    try {
      await invoke('auth_clear_token')
    } catch {
      // ignore
    }
  },

  async showAppWindow() {
    try {
      await invoke('show_main_window')
    } catch {
      // Rust safety-net timer reveals the window if this fails
    }
  },

  async checkForUpdates() {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (!update) return false
      await update.downloadAndInstall()
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
      return true
    } catch (error) {
      // Never block startup on the updater, but do not swallow the reason either:
      // an unreachable feed and a missing `updater:` capability both land here,
      // and silence is what let both ship undetected.
      console.warn('[updater] update check failed:', error)
      return false
    }
  },

  async openExternal(url) {
    await invoke('open_external', { url })
  },

  onDeepLink(handler) {
    let active = true
    let unlisten = () => {}

    void listen<string>('deep-link-url', (event) => {
      if (typeof event.payload === 'string') handler(event.payload)
    }).then((fn) => {
      if (active) unlisten = fn
      else fn()
    })

    void invoke<string | null>('get_initial_deep_link')
      .then((url) => {
        if (url) handler(url)
      })
      .catch(() => {})

    return () => {
      active = false
      unlisten()
    }
  },
}

export default tauriPlatform
