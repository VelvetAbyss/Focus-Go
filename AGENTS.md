# Focus & Go — repository guide for AI agents

This monorepo ships:
- `apps/web` — the web app (React + Vite). The **shared source of truth**.
- `apps/desktop` — the Tauri v2 desktop app. **Gitignored / local-only for now — do NOT commit it.**
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

## Build / run
- Web: `npm run dev:web`, `npm run build:web` (from repo root).
- Desktop (local only): `npm run dev:desktop`, `npm run build:desktop`.
  Docs: `apps/desktop/SIGNING.md`, `apps/desktop/DESKTOP_AUTH.md`.

## Also note
- `apps/web/CLAUDE.md` covers web-specific rules: gstack `/browse` skill, **protected auth files**
  (`src/config/auth.ts`, `src/main.tsx`, `.env*` redirect URIs, Authing callback) — do not touch
  those without explicit instruction — and skill routing.

## Codex permissions

1. 权限默认：
   - 探索/审查：`read-only`。
   - 实现：`workspace-write`。
   - `danger-full-access`：必须由用户针对当前任务单独授权。

2. 同时只允许一个写入代理。未经授权不得删除文件、读取密钥、`commit` 或 `push`。
