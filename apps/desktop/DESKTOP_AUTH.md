# Desktop authentication (Tauri)

The desktop app cannot rely on the better-auth **HttpOnly session cookie**: under the
`tauri://localhost` webview origin the cookie is third-party and gets dropped (WKWebView
ITP). So the desktop app is **Bearer-token based**, with the token stored in the OS
keychain (macOS Keychain / Windows Credential Manager).

## Email / username / signup — ✅ works today (client-only)

These endpoints already return `{ token, user }` in the response body. On desktop the
client persists `token` to the keychain and restores the session on next launch by
validating it against `/user/profile`. No server changes required.

Lifecycle (all gated by `isTauri()`, no-ops on web):
- Login success → `finishBetterAuthSession()` → `saveAuthToken(token)` (keychain).
- App boot → `bootstrapAuth()` → `bootstrapDesktopSession()` → `loadAuthToken()` →
  `fetchAuthProfile(token)` → restore, or clear if invalid.
- Sign-out → `signOutBestEffort()` → `clearAuthToken()`.

## Google (social) — ✅ client AND server implemented

Google blocks OAuth inside embedded webviews, and the social cookie lands in the
**system browser**, not the app. So the OAuth `callbackURL` is routed through a
**same-origin server endpoint** (which therefore has the session cookie); that endpoint
mints a one-time code (OTC) and deep-links it back to the app, which exchanges it for the
Bearer token. No `focusgo://` entry in `trustedOrigins` is needed (the deep link is a
plain server redirect, not a better-auth callbackURL).

### Flow
1. `LoginModal.handleGoogle()` (desktop) calls `signInGoogle(desktopOAuthCallbackURL())`
   where the callback is `https://api.nestflow.art/api/auth/desktop/callback`, and opens
   the returned provider `url` in the **system browser** (`open_external`).
2. After Google auth, better-auth sets the session cookie and redirects (same origin) to
   `…/api/auth/desktop/callback`.
3. **`GET /api/auth/desktop/callback`** (server) reads the session from the cookie, mints a
   single-use 60s code bound to the session token, and `302`s to
   `focusgo://auth-callback?code=<otc>` (or `?error=<reason>`).
4. The OS hands the deep link to the app → Rust emits `deep-link-url` →
   `useDesktopAuthDeepLink()` (in `App.tsx`) extracts `code`.
5. `authClient.exchangeDesktopCode(code)` → **`POST /api/auth/desktop/exchange`** →
   validates (single-use, unexpired, live session) → returns `{ token, user }` →
   `finishBetterAuthSession()` (stores token in the OS keychain via 4a).

### Server implementation (focus-go-api) — DONE
- `auth/desktopAuth.js`: `ensureDesktopAuthTable` (the `desktop_auth_code` table) +
  `registerDesktopAuthRoutes` (callback + exchange). Registered in `index.js` **before**
  the better-auth catch-all. CORS for the `tauri://` origin is the Phase 3 change.
- `token` returned is the better-auth **session token** (the same value email sign-in
  returns and the Bearer middleware validates against the `session` table).

### Your only remaining step
**Deploy `focus-go-api`** to `api.nestflow.art` (CORS + these routes), and make sure
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set so the Google provider is enabled.

### Security notes
- OTC is single-use, 60s TTL, bound to the session; expired codes are pruned on exchange.
- The Bearer token is never placed in the deep-link URL — only the opaque OTC is.

## macOS dev limitation
On macOS the `focusgo://` scheme is registered by LaunchServices only for a **bundled**
app, so deep links are testable after `npm run build:desktop` (a packaged `.app`), not
under `tauri dev`. Windows/Linux register on install / forward via single-instance argv.
