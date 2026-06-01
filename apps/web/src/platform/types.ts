// Platform capability seam. The web app depends only on this interface — never on
// any desktop/Tauri code. The desktop build injects a real implementation
// (apps/desktop/src/tauriPlatform.ts) via the `virtual:platform` module; web
// builds resolve that to `null` and fall back to `webPlatform`.

export interface PlatformBridge {
  /** True only in the desktop (Tauri) build. */
  readonly isDesktop: boolean
  /** Show a native OS notification. */
  notify(title: string, body: string): Promise<void>
  /** Persist the auth token in OS-secure storage (keychain). */
  saveAuthToken(token: string): Promise<void>
  /** Load the persisted auth token, or null. */
  loadAuthToken(): Promise<string | null>
  /** Remove the persisted auth token. */
  clearAuthToken(): Promise<void>
  /** Reveal the app window (created hidden to avoid a launch flash). */
  showAppWindow(): Promise<void>
  /** Check for and apply an app update; resolves true if one was installed. */
  checkForUpdates(): Promise<boolean>
  /** Open a URL in the system browser (not the embedded webview). */
  openExternal(url: string): Promise<void>
  /** Subscribe to platform deep links (fires for cold-start + live). Returns unsubscribe. */
  onDeepLink(handler: (url: string) => void): () => void
}
