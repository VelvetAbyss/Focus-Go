// `virtual:platform` is resolved by the platform-injection Vite plugin:
//   - web build      → `export default null`
//   - desktop build  → re-exports apps/desktop/src/tauriPlatform.ts
declare module 'virtual:platform' {
  import type { PlatformBridge } from '@/platform/types'
  const impl: PlatformBridge | null
  export default impl
}
