# Focus & Go — repository guide

This monorepo ships:
- `apps/web` — the web app (React + Vite). The **shared source of truth**.
- `apps/desktop` — the Tauri v2 desktop app (macOS + Windows), released from this repo.
  Its `.tauri-keys/` updater private key stays gitignored and must never be committed.
- `apps/web/focus-go-api` — the Node/Express + better-auth backend.

## Web ⇄ Desktop: the one-way rule (IMPORTANT)

`desktop` depends on `web`; **`web` MUST NEVER depend on `desktop`.**

- Edit `apps/web` → applies to **both** web and desktop (desktop is built from web).
- Edit `apps/desktop` → affects **only** desktop. Do **NOT** add desktop-only behaviour by
  editing `apps/web`.

### How it's wired
- `apps/web` reaches platform capabilities only through the seam at `apps/web/src/platform/`:
  call `getPlatform().x()`. The web default impl (`index.ts`) is all no-ops.
- The desktop frontend impl is `apps/desktop/src/tauriPlatform.ts` — the **only** frontend file
  allowed to import `@tauri-apps`. It is injected into the desktop build via the
  `virtual:platform` Vite plugin (`apps/web/vite.config.ts`); the web build resolves it to `null`.
- Native/OS features → `apps/desktop/src-tauri` (Rust).

### To add a desktop capability
1. Add a method to `PlatformBridge` in `apps/web/src/platform/types.ts`.
2. Add a no-op web default in `apps/web/src/platform/index.ts`.
3. Implement it in `apps/desktop/src/tauriPlatform.ts` (and a Rust command in `src-tauri` if needed).

Never put desktop logic in `apps/web` behind an `isDesktop` / `isTauri` check.

### Enforcement (don't bypass)
- ESLint `no-restricted-imports` forbids importing `@tauri-apps/*` anywhere in `apps/web`, and
  `virtual:platform` outside `apps/web/src/platform`. A violation fails `npm run lint`.
- The web build mechanically excludes desktop code (the virtual module resolves to `null`).

## Storage
The app is local-first (Dexie/IndexedDB) and replicates through RxDB to `focus-go-api` once signed in.
There is no account-free mode today: the per-device local/cloud switch (`storageMode.ts`, added in
95a21d1) was removed in d375667 when the web release was rolled back to the 5174 build.

- Off localhost the auth gate requires sign-in, and signing out clears local data (`AppShell` →
  `clearLocalUserData`).
- On localhost the gate is off. The macOS desktop build counts as localhost (its origin is
  `tauri://localhost`); the Windows build (`tauri.localhost`) does not, so the two behave differently.

## Build / run
- Web: `npm run dev:web`, `npm run build:web` (from repo root).
- Desktop: `npm run dev:desktop`, `npm run build:desktop`. A local build signs the updater
  artifact, so it needs `TAURI_SIGNING_PRIVATE_KEY` exported first — see `apps/desktop/SIGNING.md`.
- Release: push a `vX.Y.Z` tag → `.github/workflows/desktop-release.yml` builds macOS + Windows
  and publishes a prerelease. macOS signing requires Apple secrets; Windows installers are unsigned.
  Updater artifacts always require the Tauri signing key.
  Docs: `apps/desktop/SIGNING.md`, `apps/desktop/DESKTOP_AUTH.md`.

## Also see
`apps/web/CLAUDE.md` — web-specific rules: gstack `/browse` skill, **protected auth files**
(`src/config/auth.ts`, `src/main.tsx`, `.env*` redirect URIs, Authing callback) — do not touch
those without explicit instruction — and skill routing.

## Design System
Always read `apps/web/DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
