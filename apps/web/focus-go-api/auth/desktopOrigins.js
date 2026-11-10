// Packaged Tauri webviews use these exact origins on macOS/Linux and Windows.
// Keep CORS and BetterAuth's CSRF checks aligned without accepting wildcards.
export const DESKTOP_ORIGINS = [
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]
